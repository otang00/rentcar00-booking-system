export const AUTH_EMAIL_ALIAS_DOMAIN = 'bbangbbangcar.local'

export function formatPhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11)

  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export function normalizePhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('82')) return `0${digits.slice(2)}`
  return digits
}

export function toE164PhoneNumber(value) {
  const phone = normalizePhoneNumber(value)
  if (!/^01\d{8,9}$/.test(phone)) return ''
  return `+82${phone.slice(1)}`
}

export function buildAuthEmailAlias(value) {
  const phone = normalizePhoneNumber(value)
  if (!/^01\d{8,9}$/.test(phone)) return ''
  return `${phone}@${AUTH_EMAIL_ALIAS_DOMAIN}`
}
