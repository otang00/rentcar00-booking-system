'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { createGuestBooking } = require('../guestBookingService')

function createQueryResult(resultFactory) {
  const state = {
    table: '',
    operation: 'select',
    filters: [],
    payload: null,
  }

  const builder = {
    select() { return builder },
    eq(column, value) {
      state.filters.push({ op: 'eq', column, value })
      return builder
    },
    in(column, value) {
      state.filters.push({ op: 'in', column, value })
      return builder
    },
    lt(column, value) {
      state.filters.push({ op: 'lt', column, value })
      return builder
    },
    gt(column, value) {
      state.filters.push({ op: 'gt', column, value })
      return builder
    },
    order() { return builder },
    limit() { return builder },
    insert(payload) {
      state.operation = 'insert'
      state.payload = payload
      return builder
    },
    maybeSingle() {
      return Promise.resolve(resultFactory({ ...state, terminal: 'maybeSingle' }))
    },
    single() {
      return Promise.resolve(resultFactory({ ...state, terminal: 'single' }))
    },
    then(resolve, reject) {
      return Promise.resolve(resultFactory({ ...state, terminal: 'then' })).then(resolve, reject)
    },
  }

  return { builder, state }
}

function createFakeSupabase({ existingOrder }) {
  const calls = []

  return {
    calls,
    from(table) {
      const query = createQueryResult((state) => {
        const snapshot = { ...state, table }
        calls.push(snapshot)

        if (table === 'cars') {
          return {
            data: {
              id: 'car-uuid-1',
              source_car_id: 101,
              car_number: '12가3456',
              name: '테스트 차량',
              display_name: '테스트 차량',
            },
            error: null,
          }
        }

        if (table === 'ims_sync_reservations') {
          return { data: [], error: null }
        }

        if (table === 'booking_orders' && state.operation === 'select') {
          const hasPaymentProviderFilter = state.filters.some((filter) => filter.column === 'payment_provider')
          if (hasPaymentProviderFilter) {
            return { data: existingOrder, error: null }
          }
          return { data: state.terminal === 'then' ? [] : null, error: null }
        }

        if (table === 'booking_orders' && state.operation === 'insert') {
          return {
            data: null,
            error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint "uq_booking_orders_payment_reference"',
            },
          }
        }

        return { data: null, error: null }
      })
      return query.builder
    },
  }
}

test('createGuestBooking returns existing booking when payment reference unique violation occurs', async () => {
  const existingOrder = {
    id: 'booking-1',
    public_reservation_code: 'R202605150001',
    customer_name: '홍길동',
    customer_phone: '01012345678',
    customer_phone_last4: '5678',
    pickup_at: '2026-05-20T01:00:00.000Z',
    return_at: '2026-05-21T01:00:00.000Z',
    pickup_method: 'pickup',
    quoted_total_amount: 100000,
    pricing_snapshot: { carName: '테스트 차량' },
    booking_status: 'confirmed',
    payment_status: 'paid',
    sync_status: 'not_required',
    manual_review_required: false,
    created_at: '2026-05-15T00:00:00.000Z',
    updated_at: '2026-05-15T00:00:00.000Z',
  }
  const supabaseClient = createFakeSupabase({ existingOrder })

  const result = await createGuestBooking({
    supabaseClient,
    bookingInput: {
      carId: 101,
      deliveryDateTime: '2026-05-20 10:00',
      returnDateTime: '2026-05-21 10:00',
      customerName: '홍길동',
      customerPhone: '01012345678',
      customerBirth: '19900101',
      pickupOption: 'pickup',
      quotedTotalAmount: 100000,
    },
    paymentProvider: 'nhn_kcp',
    paymentReferenceId: 'TNO-1',
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, 200)
  assert.equal(result.deduped, true)
  assert.equal(result.booking.id, existingOrder.id)
  assert.equal(result.booking.publicReservationCode, existingOrder.public_reservation_code)

  const lookupInserts = supabaseClient.calls.filter((call) => call.table === 'booking_lookup_keys' && call.operation === 'insert')
  const eventInserts = supabaseClient.calls.filter((call) => call.table === 'reservation_status_events' && call.operation === 'insert')
  assert.equal(lookupInserts.length, 0)
  assert.equal(eventInserts.length, 0)
})
