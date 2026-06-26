'use strict'

const SEOUL_OFFSET = '+09:00'

function toSeoulIsoString(dateTimeText) {
  if (typeof dateTimeText !== 'string') {
    return null
  }

  const trimmed = dateTimeText.trim()
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmed)) {
    return null
  }

  return `${trimmed.replace(' ', 'T')}:00${SEOUL_OFFSET}`
}

function parseDate(dateTimeText) {
  const iso = toSeoulIsoString(dateTimeText)
  if (!iso) return null
  const timestamp = Date.parse(iso)
  return Number.isNaN(timestamp) ? null : new Date(timestamp)
}

function buildSearchWindow(searchState = {}) {
  const startText = searchState.deliveryDateTime || searchState.startAt
  const endText = searchState.returnDateTime || searchState.endAt

  const startAt = parseDate(startText)
  const endAt = parseDate(endText)

  if (!startAt || !endAt || endAt <= startAt) {
    throw new Error('invalid search window')
  }

  return {
    requestStartText: startText,
    requestEndText: endText,
    startAt,
    endAt,
    startIso: startAt.toISOString(),
    endIso: endAt.toISOString(),
  }
}

module.exports = {
  buildSearchWindow,
  toSeoulIsoString,
  parseDate,
}
