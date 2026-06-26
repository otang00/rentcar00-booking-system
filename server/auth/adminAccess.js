'use strict'

const DEFAULT_ADMIN_EMAILS = ['otang00@naver.com']
const DEFAULT_ADMIN_PHONES = ['01026107114']

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('82')) return `0${digits.slice(2)}`
  return digits
}

function getAdminEmailSet() {
  const values = [
    process.env.ADMIN_EMAILS,
    process.env.ADMIN_EMAIL,
    process.env.BOOKING_EMAIL_TO,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value || '').split(','))
    .map(normalizeEmail)
    .filter(Boolean)

  const emails = values.length > 0 ? values : DEFAULT_ADMIN_EMAILS
  return new Set(emails)
}

function getAdminPhoneSet() {
  const values = [
    process.env.ADMIN_PHONES,
    process.env.ADMIN_PHONE,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value || '').split(','))
    .map(normalizePhone)
    .filter(Boolean)

  const phones = values.length > 0 ? values : DEFAULT_ADMIN_PHONES
  return new Set(phones)
}

function isAdminEmail(email) {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  return getAdminEmailSet().has(normalized)
}

function isAdminPhone(phone) {
  const normalized = normalizePhone(phone)
  if (!normalized) return false
  return getAdminPhoneSet().has(normalized)
}

function isAdminUser(value) {
  if (!value) return false

  if (typeof value === 'string') {
    return isAdminEmail(value) || isAdminPhone(value)
  }

  if (value.is_admin === true || value.isAdmin === true) {
    return true
  }

  const phoneCandidates = [
    value.phone,
    value.authPhone,
    value.user_metadata?.phone,
    value.userMetadata?.phone,
  ]

  const emailCandidates = [
    value.email,
    value.user_metadata?.email,
    value.userMetadata?.email,
  ]

  return phoneCandidates.some(isAdminPhone) || emailCandidates.some(isAdminEmail)
}

function assertAdminUser(authUser) {
  if (!isAdminUser(authUser)) {
    return {
      ok: false,
      status: 403,
      code: 'admin_access_denied',
      message: '관리자만 접근할 수 있습니다.',
    }
  }

  return { ok: true }
}

module.exports = {
  DEFAULT_ADMIN_EMAILS,
  DEFAULT_ADMIN_PHONES,
  isAdminEmail,
  isAdminPhone,
  isAdminUser,
  assertAdminUser,
}
