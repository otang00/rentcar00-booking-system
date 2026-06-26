'use strict'

const crypto = require('crypto')

const WINDOW_MS = 10 * 60 * 1000
const LOCK_MS = 15 * 60 * 1000
const FAILURE_DELAY_MS = 700

const ACTION_LIMITS = {
  lookup: { maxAttempts: 8, maxFailures: 5 },
  cancel: { maxAttempts: 5, maxFailures: 3 },
}

const state = new Map()

function nowMs() {
  return Date.now()
}

function cleanup(entry, currentNow) {
  entry.attempts = Array.isArray(entry.attempts)
    ? entry.attempts.filter((value) => currentNow - value <= WINDOW_MS)
    : []
  entry.failures = Array.isArray(entry.failures)
    ? entry.failures.filter((value) => currentNow - value <= WINDOW_MS)
    : []

  if (entry.lockUntil && entry.lockUntil <= currentNow) {
    entry.lockUntil = 0
  }
}

function getClientIp(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim()
  const realIp = String(req?.headers?.['x-real-ip'] || '').trim()
  const socketIp = String(req?.socket?.remoteAddress || '').trim()
  return forwarded || realIp || socketIp || 'unknown-ip'
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function getClientFingerprint(req) {
  const ip = getClientIp(req)
  const userAgent = String(req?.headers?.['user-agent'] || '').trim()
  const acceptLanguage = String(req?.headers?.['accept-language'] || '').trim()
  return hashText(`${ip}|${userAgent}|${acceptLanguage}`)
}

function getKey(action, req) {
  return `${String(action || 'lookup')}:${getClientFingerprint(req)}`
}

function getEntry(key, currentNow) {
  const entry = state.get(key) || {
    attempts: [],
    failures: [],
    lockUntil: 0,
  }
  cleanup(entry, currentNow)
  state.set(key, entry)
  return entry
}

function getRetryAfterSeconds(lockUntil, currentNow) {
  return Math.max(1, Math.ceil((lockUntil - currentNow) / 1000))
}

function checkGuestLookupProtection({ action, req } = {}) {
  const normalizedAction = action === 'cancel' ? 'cancel' : 'lookup'
  const limits = ACTION_LIMITS[normalizedAction]
  const currentNow = nowMs()
  const key = getKey(normalizedAction, req)
  const entry = getEntry(key, currentNow)

  if (entry.lockUntil && entry.lockUntil > currentNow) {
    return {
      ok: false,
      retryAfterSeconds: getRetryAfterSeconds(entry.lockUntil, currentNow),
    }
  }

  if (entry.attempts.length >= limits.maxAttempts) {
    entry.lockUntil = currentNow + LOCK_MS
    return {
      ok: false,
      retryAfterSeconds: getRetryAfterSeconds(entry.lockUntil, currentNow),
    }
  }

  entry.attempts.push(currentNow)
  state.set(key, entry)

  return {
    ok: true,
    recordSuccess() {
      const next = getEntry(key, nowMs())
      next.failures = []
      state.set(key, next)
    },
    recordFailure() {
      const failureNow = nowMs()
      const next = getEntry(key, failureNow)
      next.failures.push(failureNow)
      if (next.failures.length >= limits.maxFailures) {
        next.lockUntil = failureNow + LOCK_MS
      }
      state.set(key, next)
      return {
        retryAfterSeconds: next.lockUntil > failureNow ? getRetryAfterSeconds(next.lockUntil, failureNow) : null,
      }
    },
  }
}

function applyRetryAfter(res, retryAfterSeconds) {
  if (res && retryAfterSeconds) {
    res.setHeader('Retry-After', String(retryAfterSeconds))
  }
}

function delayFailureResponse() {
  return new Promise((resolve) => {
    setTimeout(resolve, FAILURE_DELAY_MS)
  })
}

module.exports = {
  FAILURE_DELAY_MS,
  checkGuestLookupProtection,
  applyRetryAfter,
  delayFailureResponse,
}
