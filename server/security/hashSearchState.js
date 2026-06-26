'use strict'

const crypto = require('crypto')
const { normalizeSearchState } = require('../search/searchState')

const HASH_INCLUDED_FIELDS = [
  'deliveryDateTime',
  'returnDateTime',
  'pickupOption',
  'dongId',
  'driverAge',
]

function pickHashFields(normalizedSearch = {}) {
  return {
    deliveryDateTime: normalizedSearch.deliveryDateTime || '',
    returnDateTime: normalizedSearch.returnDateTime || '',
    pickupOption: normalizedSearch.pickupOption || 'pickup',
    dongId: normalizedSearch.pickupOption === 'delivery' ? normalizedSearch.dongId ?? null : null,
    driverAge: Number(normalizedSearch.driverAge || 0),
  }
}

function stableStringify(value) {
  if (value === null || value === undefined) return 'null'

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }

  return JSON.stringify(value)
}

function buildHashableSearch(searchState = {}) {
  const normalizedSearch = normalizeSearchState(searchState)
  return pickHashFields(normalizedSearch)
}

function hashSearchState(searchState = {}) {
  const hashableSearch = buildHashableSearch(searchState)
  const serialized = stableStringify(hashableSearch)
  const digest = crypto.createHash('sha256').update(serialized).digest('hex')

  return {
    hash: digest,
    normalized: hashableSearch,
    serialized,
  }
}

module.exports = {
  HASH_INCLUDED_FIELDS,
  buildHashableSearch,
  hashSearchState,
  stableStringify,
}
