'use strict'

const crypto = require('crypto')
const { hashSearchState } = require('./hashSearchState')

const DEFAULT_TTL_SECONDS = 15 * 60
const TOKEN_VERSION = 1
const SECRET_ENV_NAMES = ['DETAIL_TOKEN_SECRET']

function getTokenSecret() {
  for (const key of SECRET_ENV_NAMES) {
    const value = process.env[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  throw new Error('detail_token_secret_missing')
}

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(value) {
  const input = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const padding = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  return Buffer.from(`${input}${padding}`, 'base64').toString('utf8')
}

function signPayload(payloadJson, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payloadJson)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function timingSafeEqualString(left, right) {
  const a = Buffer.from(String(left || ''))
  const b = Buffer.from(String(right || ''))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function buildPayload({ carId, searchHash, expiresAt }) {
  const numericCarId = Number(carId)
  if (!Number.isInteger(numericCarId) || numericCarId <= 0) {
    throw new Error('invalid_detail_token_car_id')
  }

  if (typeof searchHash !== 'string' || !searchHash) {
    throw new Error('invalid_detail_token_search_hash')
  }

  if (!Number.isInteger(expiresAt) || expiresAt <= 0) {
    throw new Error('invalid_detail_token_exp')
  }

  return {
    v: TOKEN_VERSION,
    carId: numericCarId,
    searchHash,
    exp: expiresAt,
  }
}

function createDetailToken({ carId, search, ttlSeconds = DEFAULT_TTL_SECONDS, now = Date.now(), secret } = {}) {
  const resolvedSecret = secret || getTokenSecret()
  const { hash: searchHash } = hashSearchState(search)
  const issuedAtSeconds = Math.floor(now / 1000)
  const expiresAt = issuedAtSeconds + Number(ttlSeconds || DEFAULT_TTL_SECONDS)
  const payload = buildPayload({ carId, searchHash, expiresAt })
  const payloadJson = JSON.stringify(payload)
  const encodedPayload = toBase64Url(payloadJson)
  const signature = signPayload(payloadJson, resolvedSecret)

  return {
    token: `${encodedPayload}.${signature}`,
    payload,
  }
}

function verifyDetailToken({ token, carId, search, now = Date.now(), secret } = {}) {
  const resolvedSecret = secret || getTokenSecret()

  if (typeof token !== 'string' || !token.trim()) {
    return { isValid: false, reason: 'missing_token' }
  }

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) {
    return { isValid: false, reason: 'malformed_token' }
  }

  let payloadJson
  let payload

  try {
    payloadJson = fromBase64Url(encodedPayload)
    payload = JSON.parse(payloadJson)
  } catch (error) {
    return { isValid: false, reason: 'malformed_token' }
  }

  const expectedSignature = signPayload(payloadJson, resolvedSecret)
  if (!timingSafeEqualString(signature, expectedSignature)) {
    return { isValid: false, reason: 'invalid_signature' }
  }

  if (Number(payload.v) !== TOKEN_VERSION) {
    return { isValid: false, reason: 'invalid_version', payload }
  }

  if (!Number.isInteger(Number(payload.carId)) || Number(payload.carId) <= 0) {
    return { isValid: false, reason: 'invalid_payload', payload }
  }

  const numericCarId = Number(carId)
  if (!Number.isInteger(numericCarId) || numericCarId <= 0) {
    return { isValid: false, reason: 'invalid_car_id', payload }
  }

  if (Number(payload.carId) !== numericCarId) {
    return { isValid: false, reason: 'car_id_mismatch', payload }
  }

  const { hash: expectedSearchHash } = hashSearchState(search)
  if (payload.searchHash !== expectedSearchHash) {
    return { isValid: false, reason: 'search_hash_mismatch', payload }
  }

  const nowSeconds = Math.floor(now / 1000)
  if (!Number.isInteger(Number(payload.exp)) || Number(payload.exp) <= nowSeconds) {
    return { isValid: false, reason: 'expired_token', payload }
  }

  return {
    isValid: true,
    reason: null,
    payload,
  }
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  TOKEN_VERSION,
  createDetailToken,
  verifyDetailToken,
}
