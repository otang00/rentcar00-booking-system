'use strict'

const { normalizePhoneNumber } = require('./phoneOtp')

const AUTH_EMAIL_ALIAS_DOMAIN = 'bbangbbangcar.local'

function buildAuthEmailAlias(value) {
  const phone = normalizePhoneNumber(value)
  if (!/^01\d{8,9}$/.test(phone)) return ''
  return `${phone}@${AUTH_EMAIL_ALIAS_DOMAIN}`
}

module.exports = {
  AUTH_EMAIL_ALIAS_DOMAIN,
  buildAuthEmailAlias,
}
