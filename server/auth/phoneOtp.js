'use strict'

const crypto = require('crypto')

const OTP_LENGTH = 6
const OTP_TTL_SECONDS = 180
const OTP_COOLDOWN_SECONDS = 60
const OTP_MAX_ATTEMPTS = 5
const VERIFIED_TOKEN_TTL_SECONDS = 1800
const GUEST_BOOKING_VERIFIED_TOKEN_TTL_SECONDS = 600

function normalizePhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '')

  if (!digits) return ''
  if (digits.startsWith('82')) {
    return `0${digits.slice(2)}`
  }

  return digits
}

function toE164PhoneNumber(value) {
  const phone = normalizePhoneNumber(value)
  if (!/^01\d{8,9}$/.test(phone)) return ''
  return `+82${phone.slice(1)}`
}

function isValidMobilePhone(value) {
  return /^01\d{8,9}$/.test(normalizePhoneNumber(value))
}

function maskPhoneNumber(value) {
  const phone = normalizePhoneNumber(value)
  if (phone.length < 7) return phone
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

function getPhoneLast4(value) {
  const phone = normalizePhoneNumber(value)
  return phone.slice(-4)
}

function getOtpSecret(env = process.env) {
  return String(env.PHONE_OTP_SECRET || '').trim()
}

function assertOtpSecret(env = process.env) {
  const secret = getOtpSecret(env)
  if (!secret) {
    throw new Error('PHONE_OTP_SECRET is required')
  }
  return secret
}

function hashOtpValue(value, env = process.env) {
  const secret = assertOtpSecret(env)
  return crypto
    .createHmac('sha256', secret)
    .update(String(value || ''))
    .digest('hex')
}

function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(OTP_LENGTH, '0')
}

function generateVerificationToken() {
  return crypto.randomBytes(24).toString('hex')
}

function isSolapiConfigured(env = process.env) {
  return Boolean(
    String(env.SOLAPI_API_KEY || '').trim()
    && String(env.SOLAPI_API_SECRET || '').trim()
    && String(env.SOLAPI_SENDER || '').trim()
    && String(env.PHONE_OTP_SECRET || '').trim()
  )
}

module.exports = {
  OTP_LENGTH,
  OTP_TTL_SECONDS,
  OTP_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS,
  VERIFIED_TOKEN_TTL_SECONDS,
  GUEST_BOOKING_VERIFIED_TOKEN_TTL_SECONDS,
  normalizePhoneNumber,
  toE164PhoneNumber,
  isValidMobilePhone,
  maskPhoneNumber,
  getPhoneLast4,
  hashOtpValue,
  generateOtpCode,
  generateVerificationToken,
  isSolapiConfigured,
}
