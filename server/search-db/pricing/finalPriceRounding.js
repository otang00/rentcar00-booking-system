'use strict'

function normalizeAmount(value) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) ? amount : 0
}

function ceilToUnit(value, unit) {
  const amount = normalizeAmount(value)
  const normalizedUnit = Number(unit || 1)
  if (!(normalizedUnit > 0)) return Math.max(0, Math.ceil(amount))
  return Math.max(0, Math.ceil(amount / normalizedUnit) * normalizedUnit)
}

function getFinalPriceRoundingUnit(durationBucket) {
  return String(durationBucket || '') === 'days_15_30' ? 10000 : 1000
}

function roundFinalAppliedPrice(value, durationBucket) {
  return ceilToUnit(value, getFinalPriceRoundingUnit(durationBucket))
}

module.exports = {
  ceilToUnit,
  getFinalPriceRoundingUnit,
  roundFinalAppliedPrice,
}
