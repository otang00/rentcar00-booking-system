'use strict'

const MAX_SEARCH_RETURN_DAYS = 30
const SEOUL_OFFSET = '+09:00'

const DEFAULT_SEARCH_STATE = {
  deliveryDateTime: '2026-04-02 10:00',
  returnDateTime: '2026-04-03 10:00',
  pickupOption: 'pickup',
  driverAge: 26,
  order: 'lower',
  dongId: null,
  deliveryAddress: '',
}

const PICKUP_OPTIONS = new Set(['pickup', 'delivery'])
const ORDER_OPTIONS = new Set(['lower', 'higher', 'newer'])
const DRIVER_AGE_OPTIONS = new Set([21, 26])

function normalizeDateTime(value, fallback) {
  const nextValue = typeof value === 'string' ? value.trim() : ''
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(nextValue) ? nextValue : fallback
}

function parseSearchDateTime(value) {
  const normalized = normalizeDateTime(value, '')
  if (!normalized) return null

  const parsed = new Date(`${normalized.replace(' ', 'T')}:00${SEOUL_OFFSET}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getSeoulTodayFloor(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]))
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00${SEOUL_OFFSET}`)
}

function normalizeSearchState(rawState = {}) {
  const pickupOption = PICKUP_OPTIONS.has(rawState.pickupOption)
    ? rawState.pickupOption
    : DEFAULT_SEARCH_STATE.pickupOption

  const driverAge = DRIVER_AGE_OPTIONS.has(Number(rawState.driverAge))
    ? Number(rawState.driverAge)
    : DEFAULT_SEARCH_STATE.driverAge

  const order = ORDER_OPTIONS.has(rawState.order)
    ? rawState.order
    : DEFAULT_SEARCH_STATE.order

  const dongId = rawState.dongId == null || rawState.dongId === ''
    ? null
    : Number.isInteger(Number(rawState.dongId)) && Number(rawState.dongId) > 0
      ? Number(rawState.dongId)
      : null

  const deliveryAddress = typeof rawState.deliveryAddress === 'string'
    ? rawState.deliveryAddress.trim()
    : ''

  return {
    deliveryDateTime: normalizeDateTime(rawState.deliveryDateTime, DEFAULT_SEARCH_STATE.deliveryDateTime),
    returnDateTime: normalizeDateTime(rawState.returnDateTime, DEFAULT_SEARCH_STATE.returnDateTime),
    pickupOption,
    driverAge,
    order,
    dongId: pickupOption === 'delivery' ? dongId : null,
    deliveryAddress: pickupOption === 'delivery' ? deliveryAddress : '',
  }
}

function buildSearchErrors(normalized) {
  const errors = {}

  const pickupAt = parseSearchDateTime(normalized.deliveryDateTime)
  const returnAt = parseSearchDateTime(normalized.returnDateTime)

  if (!pickupAt) {
    errors.deliveryDateTime = 'deliveryDateTime is invalid'
  }

  if (!returnAt) {
    errors.returnDateTime = 'returnDateTime is invalid'
  }

  if (pickupAt && returnAt && returnAt <= pickupAt) {
    errors.returnDateTime = 'returnDateTime must be after deliveryDateTime'
  }

  if (returnAt) {
    const latestAllowedReturnAt = getSeoulTodayFloor()
    latestAllowedReturnAt.setDate(latestAllowedReturnAt.getDate() + MAX_SEARCH_RETURN_DAYS)
    latestAllowedReturnAt.setHours(23, 59, 59, 999)

    if (returnAt > latestAllowedReturnAt) {
      errors.returnDateTime = `returnDateTime must be within ${MAX_SEARCH_RETURN_DAYS} days from today`
    }
  }

  if (normalized.pickupOption === 'delivery' && normalized.dongId == null) {
    errors.dongId = 'dongId is required for delivery search'
  }

  return errors
}

function validateSearchState(searchState) {
  const normalized = normalizeSearchState(searchState)
  const errors = buildSearchErrors(normalized)

  return {
    normalized,
    errors,
    isValid: Object.keys(errors).length === 0,
  }
}

function validateDetailSearch({ carId, searchState } = {}) {
  const normalized = normalizeSearchState(searchState)
  const errors = buildSearchErrors(normalized)

  if (!carId) {
    errors.carId = 'carId is required'
  }

  return {
    normalized,
    errors,
    isValid: Object.keys(errors).length === 0,
  }
}

module.exports = {
  DEFAULT_SEARCH_STATE,
  MAX_SEARCH_RETURN_DAYS,
  normalizeSearchState,
  validateSearchState,
  validateDetailSearch,
}
