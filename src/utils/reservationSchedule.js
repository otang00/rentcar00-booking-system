export const OPERATING_START_HOUR = 9
export const OPERATING_END_HOUR = 21
export const RESERVATION_LEAD_HOURS = 3
export const MIN_RENTAL_DAYS = 1
export const MAX_RENTAL_DAYS = 30
export const MAX_SEARCH_RETURN_DAYS = 30

function pad(value) {
  return String(value).padStart(2, '0')
}

export function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatHourLabel(hour) {
  return `${pad(hour)}:00`
}

export function parseDateTimeString(value) {
  if (typeof value !== 'string') return null

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/)
  if (!match) return null

  const [, year, month, day, hour, minute] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0)

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hour) ||
    date.getMinutes() !== Number(minute)
  ) {
    return null
  }

  return date
}

export function toDateTimeString(date) {
  return `${formatDateKey(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function splitDateTimeString(value) {
  const parsed = parseDateTimeString(value)
  if (!parsed) {
    return {
      date: '',
      time: '',
    }
  }

  return {
    date: formatDateKey(parsed),
    time: formatHourLabel(parsed.getHours()),
  }
}

function ceilToHour(date) {
  const next = new Date(date)

  if (next.getMinutes() > 0 || next.getSeconds() > 0 || next.getMilliseconds() > 0) {
    next.setHours(next.getHours() + 1, 0, 0, 0)
    return next
  }

  next.setMinutes(0, 0, 0)
  return next
}

export function getEarliestPickupDateTime(now = new Date()) {
  const next = new Date(now.getTime() + RESERVATION_LEAD_HOURS * 60 * 60 * 1000)
  const rounded = ceilToHour(next)

  if (rounded.getHours() < OPERATING_START_HOUR) {
    rounded.setHours(OPERATING_START_HOUR, 0, 0, 0)
    return rounded
  }

  if (rounded.getHours() > OPERATING_END_HOUR) {
    rounded.setDate(rounded.getDate() + 1)
    rounded.setHours(OPERATING_START_HOUR, 0, 0, 0)
    return rounded
  }

  return rounded
}

export function getHourlyOptions(minHour = OPERATING_START_HOUR, maxHour = OPERATING_END_HOUR) {
  if (minHour > maxHour) return []

  return Array.from({ length: maxHour - minHour + 1 }, (_, index) => formatHourLabel(minHour + index))
}

export function getLatestSearchReturnDateTime(now = new Date()) {
  const next = new Date(now)
  next.setDate(next.getDate() + MAX_SEARCH_RETURN_DAYS)
  next.setHours(OPERATING_END_HOUR, 0, 0, 0)
  return next
}

export function getLatestPickupDateTime(now = new Date()) {
  const next = getLatestSearchReturnDateTime(now)
  next.setDate(next.getDate() - MIN_RENTAL_DAYS)
  next.setHours(OPERATING_END_HOUR, 0, 0, 0)
  return next
}

export function getPickupTimeOptions(dateValue, now = new Date()) {
  if (!dateValue) return []

  const earliestPickup = getEarliestPickupDateTime(now)
  const earliestDateKey = formatDateKey(earliestPickup)
  const latestPickup = getLatestPickupDateTime(now)
  const latestDateKey = formatDateKey(latestPickup)

  if (dateValue < earliestDateKey || dateValue > latestDateKey) return []

  if (dateValue === earliestDateKey) {
    return getHourlyOptions(earliestPickup.getHours(), OPERATING_END_HOUR)
  }

  return getHourlyOptions()
}

export function getReturnTimeOptions(returnDateValue, pickupDateTimeValue, now = new Date()) {
  if (!returnDateValue || !pickupDateTimeValue) return []

  const pickupAt = parseDateTimeString(pickupDateTimeValue)
  if (!pickupAt) return []

  const earliestReturnAt = getEarliestReturnDateTime(pickupAt)
  const earliestReturnDateKey = formatDateKey(earliestReturnAt)
  const latestReturnAt = getLatestReturnDateTime(pickupAt)
  const latestSearchReturnAt = getLatestSearchReturnDateTime(now)
  const effectiveLatestReturnAt = latestReturnAt < latestSearchReturnAt ? latestReturnAt : latestSearchReturnAt
  const latestReturnDateKey = formatDateKey(effectiveLatestReturnAt)

  if (returnDateValue < earliestReturnDateKey || returnDateValue > latestReturnDateKey) return []

  let minHour = OPERATING_START_HOUR
  let maxHour = OPERATING_END_HOUR

  if (returnDateValue === earliestReturnDateKey) {
    minHour = Math.max(minHour, earliestReturnAt.getHours())
  }

  if (returnDateValue === latestReturnDateKey) {
    maxHour = Math.min(maxHour, effectiveLatestReturnAt.getHours())
  }

  return getHourlyOptions(minHour, maxHour)
}

export function buildDateTimeValue(dateValue, timeValue) {
  if (!dateValue || !timeValue) return ''
  return `${dateValue} ${timeValue}`
}

export function getEarliestReturnDateTime(pickupAt) {
  const next = new Date(pickupAt)
  next.setDate(next.getDate() + MIN_RENTAL_DAYS)
  next.setHours(pickupAt.getHours(), 0, 0, 0)
  return next
}

export function getLatestReturnDateTime(pickupAt) {
  const next = new Date(pickupAt)
  next.setDate(next.getDate() + MAX_RENTAL_DAYS)
  next.setHours(pickupAt.getHours(), 0, 0, 0)
  return next
}

export function getDefaultReturnDateTime(pickupAt) {
  return getEarliestReturnDateTime(pickupAt)
}

export function getDefaultSearchDateTimes(now = new Date()) {
  const pickupAt = getEarliestPickupDateTime(now)
  const returnAt = getDefaultReturnDateTime(pickupAt)

  return {
    deliveryDateTime: toDateTimeString(pickupAt),
    returnDateTime: toDateTimeString(returnAt),
  }
}

export function sanitizeSearchDateTimes({ deliveryDateTime, returnDateTime }, now = new Date()) {
  const defaults = getDefaultSearchDateTimes(now)
  let pickupAt = parseDateTimeString(deliveryDateTime) || parseDateTimeString(defaults.deliveryDateTime)
  const latestPickupAt = getLatestPickupDateTime(now)

  if (pickupAt > latestPickupAt) {
    pickupAt = latestPickupAt
  }

  const pickupDateKey = formatDateKey(pickupAt)
  const validPickupOptions = getPickupTimeOptions(pickupDateKey, now)
  const pickupHourLabel = formatHourLabel(pickupAt.getHours())

  if (!validPickupOptions.includes(pickupHourLabel)) {
    pickupAt = parseDateTimeString(defaults.deliveryDateTime)
  } else {
    pickupAt = new Date(pickupAt)
    pickupAt.setMinutes(0, 0, 0)
  }

  let returnAt = parseDateTimeString(returnDateTime)

  if (!returnAt) {
    returnAt = getDefaultReturnDateTime(pickupAt)
  } else {
    returnAt = new Date(returnAt)
    returnAt.setMinutes(0, 0, 0)
  }

  const earliestReturnAt = getEarliestReturnDateTime(pickupAt)
  const latestReturnAt = getLatestReturnDateTime(pickupAt)
  const latestSearchReturnAt = getLatestSearchReturnDateTime(now)
  const effectiveLatestReturnAt = latestReturnAt < latestSearchReturnAt ? latestReturnAt : latestSearchReturnAt

  if (returnAt < earliestReturnAt) {
    returnAt = earliestReturnAt
  }

  if (returnAt > effectiveLatestReturnAt) {
    returnAt = effectiveLatestReturnAt
  }

  const returnDateKey = formatDateKey(returnAt)
  const validReturnOptions = getReturnTimeOptions(returnDateKey, toDateTimeString(pickupAt), now)
  const returnHourLabel = formatHourLabel(returnAt.getHours())

  if (returnAt <= pickupAt || !validReturnOptions.includes(returnHourLabel)) {
    returnAt = getDefaultReturnDateTime(pickupAt)
    if (returnAt > effectiveLatestReturnAt) {
      returnAt = effectiveLatestReturnAt
    }
  }

  return {
    deliveryDateTime: toDateTimeString(pickupAt),
    returnDateTime: toDateTimeString(returnAt),
  }
}
