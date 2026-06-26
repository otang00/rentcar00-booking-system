'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createBookingConfirmToken,
  verifyBookingConfirmToken,
} = require('../bookingConfirmToken')

test('booking confirm token roundtrip works', () => {
  const { token } = createBookingConfirmToken({
    bookingOrderId: '11111111-1111-1111-1111-111111111111',
    reservationCode: 'BB260422123456',
    secret: 'test-secret',
  })

  const result = verifyBookingConfirmToken({ token, secret: 'test-secret' })
  assert.equal(result.isValid, true)
  assert.equal(result.payload.boid, '11111111-1111-1111-1111-111111111111')
  assert.equal(result.payload.rc, 'BB260422123456')
})

test('booking confirm token rejects tampering', () => {
  const { token } = createBookingConfirmToken({
    bookingOrderId: '11111111-1111-1111-1111-111111111111',
    reservationCode: 'BB260422123456',
    secret: 'test-secret',
  })

  const tampered = `${token}x`
  const result = verifyBookingConfirmToken({ token: tampered, secret: 'test-secret' })
  assert.equal(result.isValid, false)
})
