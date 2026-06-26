'use strict'

const BLOCKING_STATUSES = new Set(['pending', 'confirmed', 'paid'])
const STATUS_SYNONYMS = new Map([
  ['예약대기', 'pending'],
  ['예약확정', 'confirmed'],
  ['결제완료', 'paid'],
])

function normalizeStatus(value) {
  if (!value) return null
  const trimmed = String(value).trim().toLowerCase()
  if (!trimmed) return null

  for (const [alias, canonical] of STATUS_SYNONYMS.entries()) {
    if (alias.toLowerCase() === trimmed) {
      return canonical
    }
  }

  return trimmed
}

function resolveReservationStatus(reservation = {}) {
  return normalizeStatus(reservation.status) || normalizeStatus(reservation.status_raw) || null
}

function isBlockingStatus(status) {
  const normalized = normalizeStatus(status)
  return normalized ? BLOCKING_STATUSES.has(normalized) : false
}

function isReservationBlocking(reservation) {
  const normalized = resolveReservationStatus(reservation)
  return normalized ? BLOCKING_STATUSES.has(normalized) : false
}

module.exports = {
  BLOCKING_STATUSES,
  normalizeStatus,
  resolveReservationStatus,
  isBlockingStatus,
  isReservationBlocking,
}
