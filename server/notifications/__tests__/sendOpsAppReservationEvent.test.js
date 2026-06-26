'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  createEventId,
  buildOpsReservationEventPayload,
  createSignature,
  sendOpsAppReservationEvent,
} = require('../sendOpsAppReservationEvent')

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

test('createEventId is deterministic by booking id', () => {
  assert.equal(createEventId(booking), 'reservation.created:booking-1')
})

test('buildOpsReservationEventPayload includes customer operation fields and booking summary', () => {
  const payload = buildOpsReservationEventPayload({
    booking,
    bookingInput: {
      customerPhone: '01012345678',
      customerBirth: '19841115',
    },
    env: { RENTCAR00_PUBLIC_BASE_URL: 'https://example.com/' },
    now: new Date('2026-05-20T00:00:00.000Z'),
  })

  assert.equal(payload.eventType, 'reservation.created')
  assert.equal(payload.booking.reservationCode, 'R202605200001')
  assert.equal(payload.booking.customerName, '홍길동')
  assert.equal(payload.booking.customerPhone, '01012345678')
  assert.equal(payload.booking.customerBirth, '19841115')
  assert.equal(payload.booking.customerPhoneLast4, '1234')
  assert.equal(payload.booking.carName, '테스트 차량')
  assert.equal(payload.booking.deliveryAddressSummary, '서울특별시 강남구 테헤란로')
  assert.equal(payload.links.adminBookingUrl, 'https://example.com/admin/bookings?reservationNumber=R202605200001')
})

test('createSignature uses timestamp.rawBody HMAC-SHA256', () => {
  const signature = createSignature({
    secret: 'secret',
    timestamp: '1779235200000',
    rawBody: '{"ok":true}',
  })

  assert.match(signature, /^sha256=[a-f0-9]{64}$/)
  assert.equal(signature, createSignature({ secret: 'secret', timestamp: '1779235200000', rawBody: '{"ok":true}' }))
})

test('sendOpsAppReservationEvent skips when url is missing', async () => {
  const result = await sendOpsAppReservationEvent({
    booking,
    env: { OPS_APP_RESERVATION_EVENT_SECRET: 'secret' },
  })

  assert.equal(result.skipped, true)
  assert.equal(result.reason, 'missing_ops_app_reservation_event_url')
})

test('sendOpsAppReservationEvent posts signed JSON and reads dedupe response', async () => {
  const originalFetch = global.fetch
  try {
    let received = null
    global.fetch = async (url, options) => {
      received = { url, options }
      return {
        ok: true,
        status: 200,
        async json() {
          return { ok: true, deduped: true }
        },
      }
    }

    const result = await sendOpsAppReservationEvent({
      booking,
      env: {
        OPS_APP_RESERVATION_EVENT_URL: 'https://ops.example.com/api/integrations/rentcar00/reservation-events',
        OPS_APP_RESERVATION_EVENT_SECRET: 'secret',
        OPS_APP_RESERVATION_EVENT_TIMEOUT_MS: '1000',
      },
      now: new Date('2026-05-20T00:00:00.000Z'),
    })

    assert.equal(result.delivered, true)
    assert.equal(result.deduped, true)
    assert.equal(received.url, 'https://ops.example.com/api/integrations/rentcar00/reservation-events')
    assert.equal(received.options.headers['x-rentcar00-event-type'], 'reservation.created')
    assert.equal(received.options.headers['x-rentcar00-event-id'], 'reservation.created:booking-1')
    assert.equal(received.options.headers['x-rentcar00-timestamp'], '1779235200000')
    assert.match(received.options.headers['x-rentcar00-signature'], /^sha256=[a-f0-9]{64}$/)
  } finally {
    global.fetch = originalFetch
  }
})
