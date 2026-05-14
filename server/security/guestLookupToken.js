'use strict'

const crypto = require('crypto')

const DEFAULT_TTL_SECONDS = 10 * 60
const TOKEN_VERSION = 1
const SECRET_ENV_NAMES = [
  'GUEST_LOOKUP_TOKEN_SECRET',
  'BOOKING_CUSTOMER_COMPLETE_TOKEN_SECRET',
  'DETAIL_TOKEN_SECRET',
]

function getTokenSecret() {
  for (const key of SECRET_ENV_NAMES) {
    const value = process.env[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  throw new Error('guest_lookup_token_secret_missing')
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

function buildPayload({ phone, expiresAt }) {
  const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(0, 11)

  if (!/^01\d{8,9}$/.test(normalizedPhone)) {
    throw new Error('invalid_guest_lookup_phone')
  }

  if (!Number.isInteger(expiresAt) || expiresAt <= 0) {
    throw new Error('invalid_guest_lookup_exp')
  }

  return {
    v: TOKEN_VERSION,
    phone: normalizedPhone,
    exp: expiresAt,
  }
}

function createGuestLookupToken({ phone, ttlSeconds = DEFAULT_TTL_SECONDS, now = Date.now(), secret } = {}) {
  const resolvedSecret = secret || getTokenSecret()
  const issuedAtSeconds = Math.floor(now / 1000)
  const expiresAt = issuedAtSeconds + Number(ttlSeconds || DEFAULT_TTL_SECONDS)
  const payload = buildPayload({ phone, expiresAt })
  const payloadJson = JSON.stringify(payload)
  const encodedPayload = toBase64Url(payloadJson)
  const signature = signPayload(payloadJson, resolvedSecret)

  return {
    token: `${encodedPayload}.${signature}`,
    payload,
  }
}

function verifyGuestLookupToken({ token, now = Date.now(), secret } = {}) {
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
  } catch {
    return { isValid: false, reason: 'malformed_token' }
  }

  const expectedSignature = signPayload(payloadJson, resolvedSecret)
  if (!timingSafeEqualString(signature, expectedSignature)) {
    return { isValid: false, reason: 'invalid_signature', payload }
  }

  if (Number(payload?.v) !== TOKEN_VERSION) {
    return { isValid: false, reason: 'invalid_version', payload }
  }

  if (!/^01\d{8,9}$/.test(String(payload?.phone || ''))) {
    return { isValid: false, reason: 'invalid_phone', payload }
  }

  const nowSeconds = Math.floor(now / 1000)
  if (!Number.isInteger(Number(payload?.exp)) || Number(payload.exp) <= nowSeconds) {
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
  createGuestLookupToken,
  verifyGuestLookupToken,
}
