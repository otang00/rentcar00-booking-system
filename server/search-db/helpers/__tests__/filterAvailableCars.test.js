'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { filterAvailableCars } = require('../filterAvailableCars')

const searchWindow = {
  startAt: new Date('2026-04-15T01:00:00.000Z'),
  endAt: new Date('2026-04-16T01:00:00.000Z'),
}

test('filterAvailableCars removes overlapping reservations', () => {
  const cars = [{ id: 'car_a' }, { id: 'car_b' }]
  const reservations = [
    { car_id: 'car_a', start_at: '2026-04-15T00:00:00Z', end_at: '2026-04-16T02:00:00Z' },
  ]

  const available = filterAvailableCars({ cars, reservations, searchWindow })
  assert.equal(available.length, 1)
  assert.equal(available[0].id, 'car_b')
})

test('filterAvailableCars keeps cars with non-overlapping reservations', () => {
  const cars = [{ id: 'car_a' }]
  const reservations = [
    { car_id: 'car_a', start_at: '2026-04-10T00:00:00Z', end_at: '2026-04-11T00:00:00Z' },
  ]

  const available = filterAvailableCars({ cars, reservations, searchWindow })
  assert.equal(available.length, 1)
})
