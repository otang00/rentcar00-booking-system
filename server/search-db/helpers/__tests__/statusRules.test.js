'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  normalizeStatus,
  resolveReservationStatus,
  isBlockingStatus,
  isReservationBlocking,
} = require('../statusRules')

test('normalizeStatus handles synonyms', () => {
  assert.equal(normalizeStatus('예약대기'), 'pending')
})

test('resolveReservationStatus prefers status over status_raw', () => {
  assert.equal(resolveReservationStatus({ status: 'confirmed', status_raw: '예약대기' }), 'confirmed')
})

test('isBlockingStatus matches canonical names', () => {
  assert.equal(isBlockingStatus('confirmed'), true)
  assert.equal(isBlockingStatus('cancelled'), false)
})

test('isReservationBlocking falls back to status_raw', () => {
  assert.equal(isReservationBlocking({ status_raw: '결제완료' }), true)
})
