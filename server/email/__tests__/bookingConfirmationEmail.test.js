'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

process.env.BOOKING_ADMIN_CONFIRM_TOKEN_SECRET = process.env.BOOKING_ADMIN_CONFIRM_TOKEN_SECRET || 'test-admin-confirm-secret'

const { buildBookingConfirmationEmail } = require('../bookingConfirmationEmail')

function createBooking(overrides = {}) {
  return {
    id: 'booking-1',
    publicReservationCode: 'BB260625123456',
    customerName: '홍길동',
    customerPhone: '010-****-5678',
    customerPhoneLast4: '5678',
    customerBirth: '1990****',
    pickupAt: '2026-06-25T09:00:00.000Z',
    returnAt: '2026-06-26T09:00:00.000Z',
    pickupLocationSnapshot: { pickupOption: 'pickup' },
    pricingSnapshot: { carName: '테스트 차량', carNumber: '12가3456', paymentMethod: 'card' },
    quotedTotalAmount: 100000,
    ...overrides,
  }
}

const req = { headers: { host: 'example.com', 'x-forwarded-proto': 'https' } }

test('booking confirmation email prefers explicit full customer contact values', () => {
  const email = buildBookingConfirmationEmail({
    booking: createBooking(),
    req,
    customerPhone: '01012345678',
    customerBirth: '19900101',
  })

  assert.match(email.text, /연락처: 010-1234-5678/)
  assert.match(email.text, /생년월일: 1990-01-01/)
})

test('booking confirmation email falls back to raw contact fields before masked fields', () => {
  const email = buildBookingConfirmationEmail({
    booking: createBooking({
      customerPhoneRaw: '01012345678',
      customerBirthRaw: '19900101',
    }),
    req,
  })

  assert.match(email.text, /연락처: 010-1234-5678/)
  assert.match(email.text, /생년월일: 1990-01-01/)
  assert.doesNotMatch(email.text, /010-\*\*\*\*-5678/)
  assert.doesNotMatch(email.text, /1990\*\*\*\*/)
})
