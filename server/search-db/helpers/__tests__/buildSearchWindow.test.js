'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { buildSearchWindow, toSeoulIsoString } = require('../buildSearchWindow')

test('toSeoulIsoString returns ISO string with offset', () => {
  assert.equal(
    toSeoulIsoString('2026-04-15 10:00'),
    '2026-04-15T10:00:00+09:00',
  )
})

test('buildSearchWindow returns start/end dates', () => {
  const window = buildSearchWindow({
    deliveryDateTime: '2026-04-15 10:00',
    returnDateTime: '2026-04-16 12:00',
  })

  assert.equal(window.startAt instanceof Date, true)
  assert.equal(window.endAt instanceof Date, true)
  assert.equal(window.startAt < window.endAt, true)
})

test('buildSearchWindow throws on invalid range', () => {
  assert.throws(() => buildSearchWindow({
    deliveryDateTime: '2026-04-15 10:00',
    returnDateTime: '2026-04-15 09:00',
  }))
})
