'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  computeRetryDelayMs,
  enqueueOpsAppReservationEvent,
} = require('../opsAppReservationEventOutbox')

const booking = {
  id: 'booking-1',
  publicReservationCode: 'R202605200001',
  customerName: '홍길동',
  customerPhoneLast4: '1234',
  pickupAt: '2026-05-21T01:00:00.000Z',
  returnAt: '2026-05-22T01:00:00.000Z',
  pickupMethod: 'delivery',
  pickupLocationSnapshot: {
    deliveryAddress: '서울특별시 강남구 테헤란로 1',
  },
  pricingSnapshot: {
    carName: '테스트 차량',
    carNumber: '12가3456',
  },
  quotedTotalAmount: 123456,
  bookingStatus: 'confirmed',
  paymentStatus: 'paid',
}

function createSupabaseInsertMock({ resultData = { id: 'outbox-1', event_id: 'reservation.created:booking-1', status: 'pending' } } = {}) {
  const state = { table: null, payload: null, options: null }
  const supabaseClient = {
    from(table) {
      state.table = table
      return {
        upsert(payload, options) {
          state.payload = payload
          state.options = options
          return {
            select() {
              return {
                async maybeSingle() {
                  return { data: resultData, error: null }
                },
              }
            },
          }
        },
      }
    },
  }

  return { supabaseClient, state }
}

test('computeRetryDelayMs backs off and caps delay', () => {
  assert.equal(computeRetryDelayMs(0), 60 * 1000)
  assert.equal(computeRetryDelayMs(1), 2 * 60 * 1000)
  assert.equal(computeRetryDelayMs(99), 30 * 60 * 1000)
})

test('enqueueOpsAppReservationEvent writes deterministic pending outbox event', async () => {
  const { supabaseClient, state } = createSupabaseInsertMock()
  const result = await enqueueOpsAppReservationEvent({
    supabaseClient,
    booking,
    bookingInput: {
      customerPhone: '01012345678',
      customerBirth: '19841115',
    },
    requestedBy: 'guest_web',
    env: { RENTCAR00_PUBLIC_BASE_URL: 'https://example.com' },
    now: new Date('2026-05-20T00:00:00.000Z'),
  })

  assert.equal(result.enqueued, true)
  assert.equal(result.eventId, 'reservation.created:booking-1')
  assert.equal(state.table, 'ops_app_reservation_event_outbox')
  assert.equal(state.options.onConflict, 'event_id')
  assert.equal(state.options.ignoreDuplicates, true)
  assert.equal(state.payload.booking_order_id, 'booking-1')
  assert.equal(state.payload.event_id, 'reservation.created:booking-1')
  assert.equal(state.payload.event_type, 'reservation.created')
  assert.equal(state.payload.status, 'pending')
  assert.equal(state.payload.event_payload.booking.reservationCode, 'R202605200001')
  assert.equal(state.payload.event_payload.booking.customerPhone, '01012345678')
  assert.equal(state.payload.event_payload.booking.customerBirth, '19841115')
})

test('enqueueOpsAppReservationEvent reports dedupe when upsert returns no row', async () => {
  const { supabaseClient } = createSupabaseInsertMock({ resultData: null })
  const result = await enqueueOpsAppReservationEvent({
    supabaseClient,
    booking,
    now: new Date('2026-05-20T00:00:00.000Z'),
  })

  assert.equal(result.enqueued, true)
  assert.equal(result.deduped, true)
})
