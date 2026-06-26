'use strict'

const MINUTE_MS = 60 * 1000

function ensureDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return null
  }
  return new Date(parsed)
}

function normalizeRange(range = {}) {
  const start = ensureDate(range.startAt || range.start)
  const end = ensureDate(range.endAt || range.end)

  if (!start || !end || end <= start) {
    return null
  }

  return { startAt: start, endAt: end }
}

function expandRange(range, { beforeMinutes = 0, afterMinutes = 0 } = {}) {
  const normalized = normalizeRange(range)
  if (!normalized) return null

  const beforeMs = Number(beforeMinutes) * MINUTE_MS
  const afterMs = Number(afterMinutes) * MINUTE_MS

  return {
    startAt: new Date(normalized.startAt.getTime() - beforeMs),
    endAt: new Date(normalized.endAt.getTime() + afterMs),
  }
}

function isRangeOverlapping(rangeA, rangeB, options = {}) {
  const first = options.applyBuffer ? expandRange(rangeA, options.applyBuffer) : normalizeRange(rangeA)
  const second = options.applyBuffer ? expandRange(rangeB, options.applyBuffer) : normalizeRange(rangeB)

  if (!first || !second) return false

  return first.startAt < second.endAt && first.endAt > second.startAt
}

module.exports = {
  MINUTE_MS,
  normalizeRange,
  expandRange,
  isRangeOverlapping,
}
