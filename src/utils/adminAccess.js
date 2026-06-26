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
  const raw = import.meta.env.VITE_ADMIN_EMAILS || import.meta.env.VITE_ADMIN_EMAIL || ''
  const values = String(raw || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean)

  const emails = values.length > 0 ? values : DEFAULT_ADMIN_EMAILS
  return new Set(emails)
}

function getAdminPhoneSet() {
  const raw = import.meta.env.VITE_ADMIN_PHONES || import.meta.env.VITE_ADMIN_PHONE || ''
  const values = String(raw || '')
    .split(',')
    .map(normalizePhone)
    .filter(Boolean)

  const phones = values.length > 0 ? values : DEFAULT_ADMIN_PHONES
  return new Set(phones)
}

export function isAdminEmail(email) {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  return getAdminEmailSet().has(normalized)
}

export function isAdminPhone(phone) {
  const normalized = normalizePhone(phone)
  if (!normalized) return false
  return getAdminPhoneSet().has(normalized)
}

export function isAdminUser(value) {
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
