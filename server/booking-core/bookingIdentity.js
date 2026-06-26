'use strict'

const crypto = require('crypto')
const {
  normalizePersonName,
  normalizeBirthDate,
} = require('../auth/identityValidation')

function normalizeCustomerName(value) {
  return normalizePersonName(value)
}

function normalizeCustomerPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11)
}

function normalizeCustomerBirth(value) {
  return normalizeBirthDate(value)
}

function hashLookupValue(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''), 'utf8')
    .digest('hex')
}

function createPublicReservationCode(now = new Date()) {
  const year = String(now.getFullYear()).slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 900000) + 100000
  return `BB${year}${month}${day}${random}`
}

function createPaymentReferenceId(now = new Date()) {
  return `SURR-${now.getTime()}-${Math.floor(Math.random() * 900000) + 100000}`
}

module.exports = {
  normalizeCustomerName,
  normalizeCustomerPhone,
  normalizeCustomerBirth,
  hashLookupValue,
  createPublicReservationCode,
  createPaymentReferenceId,
}
