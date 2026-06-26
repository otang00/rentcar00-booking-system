'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  normalizeRange,
  expandRange,
  isRangeOverlapping,
} = require('../overlap')

test('normalizeRange returns null for invalid range', () => {
  assert.equal(normalizeRange({ startAt: '2026-01-01', endAt: '2025-12-31' }), null)
})

test('isRangeOverlapping detects simple overlap', () => {
  const a = { startAt: '2026-01-01T00:00:00Z', endAt: '2026-01-02T00:00:00Z' }
  const b = { startAt: '2026-01-01T12:00:00Z', endAt: '2026-01-03T00:00:00Z' }
  assert.equal(isRangeOverlapping(a, b), true)
})

test('isRangeOverlapping treats end-exclusive windows', () => {
  const a = { startAt: '2026-01-01T00:00:00Z', endAt: '2026-01-02T00:00:00Z' }
  const b = { startAt: '2026-01-02T00:00:00Z', endAt: '2026-01-03T00:00:00Z' }
  assert.equal(isRangeOverlapping(a, b), false)
})

test('expandRange applies buffers', () => {
  const range = { startAt: '2026-01-01T00:00:00Z', endAt: '2026-01-01T01:00:00Z' }
  const expanded = expandRange(range, { beforeMinutes: 30, afterMinutes: 15 })
  assert.equal(expanded.startAt.toISOString(), '2025-12-31T23:30:00.000Z')
  assert.equal(expanded.endAt.toISOString(), '2026-01-01T01:15:00.000Z')
})

test('isRangeOverlapping can apply buffer to both ranges', () => {
  const options = { applyBuffer: { beforeMinutes: 15, afterMinutes: 15 } }
  const a = { startAt: '2026-01-01T00:00:00Z', endAt: '2026-01-01T01:00:00Z' }
  const b = { startAt: '2026-01-01T01:05:00Z', endAt: '2026-01-01T02:00:00Z' }
  assert.equal(isRangeOverlapping(a, b, options), true)
})
