'use strict'

const crypto = require('crypto')

const DEFAULT_TTL_SECONDS = 30 * 60
const TOKEN_VERSION = 1
const SECRET_ENV_NAMES = [
  'KCP_PAYMENT_SESSION_SECRET',
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

  throw new Error('payment_session_secret_missing')
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

function createPaymentSessionToken({ payload, ttlSeconds = DEFAULT_TTL_SECONDS, now = Date.now(), secret } = {}) {
  const resolvedSecret = secret || getTokenSecret()
  const expiresAt = Math.floor(now / 1000) + Number(ttlSeconds || DEFAULT_TTL_SECONDS)
  const tokenPayload = {
    v: TOKEN_VERSION,
    exp: expiresAt,
    payload: payload || {},
  }
  const payloadJson = JSON.stringify(tokenPayload)
  const encodedPayload = toBase64Url(payloadJson)
  const signature = signPayload(payloadJson, resolvedSecret)

  return {
    token: `${encodedPayload}.${signature}`,
    payload: tokenPayload,
  }
}

function verifyPaymentSessionToken({ token, now = Date.now(), secret } = {}) {
  const resolvedSecret = secret || getTokenSecret()

  if (typeof token !== 'string' || !token.trim()) {
    return { isValid: false, reason: 'missing_token' }
  }

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) {
    return { isValid: false, reason: 'malformed_token' }
  }

  let payloadJson
  let parsed

  try {
    payloadJson = fromBase64Url(encodedPayload)
    parsed = JSON.parse(payloadJson)
  } catch {
    return { isValid: false, reason: 'malformed_token' }
  }

  const expectedSignature = signPayload(payloadJson, resolvedSecret)
  if (!timingSafeEqualString(signature, expectedSignature)) {
    return { isValid: false, reason: 'invalid_signature' }
  }

  if (Number(parsed?.v) !== TOKEN_VERSION) {
    return { isValid: false, reason: 'invalid_version', payload: parsed }
  }

  const nowSeconds = Math.floor(now / 1000)
  if (!Number.isInteger(Number(parsed?.exp)) || Number(parsed.exp) <= nowSeconds) {
    return { isValid: false, reason: 'expired_token', payload: parsed }
  }

  return {
    isValid: true,
    reason: null,
    payload: parsed?.payload || {},
    tokenPayload: parsed,
  }
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  createPaymentSessionToken,
  verifyPaymentSessionToken,
}
