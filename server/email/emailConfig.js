'use strict'

function readRequiredEnv(name) {
  const value = process.env[name]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`missing_env_${name.toLowerCase()}`)
  }

  return value.trim()
}

function readBooleanEnv(name, defaultValue = false) {
  const value = process.env[name]
  if (typeof value !== 'string' || !value.trim()) {
    return defaultValue
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function resolveEmailConfig() {
  return {
    bookingEmailTo: readRequiredEnv('BOOKING_EMAIL_TO'),
    bookingEmailFrom: readRequiredEnv('BOOKING_EMAIL_FROM'),
    bookingEmailFromName: readRequiredEnv('BOOKING_EMAIL_FROM_NAME'),
    smtpHost: readRequiredEnv('SMTP_HOST'),
    smtpPort: Number(readRequiredEnv('SMTP_PORT')),
    smtpSecure: readBooleanEnv('SMTP_SECURE', false),
    smtpRequireTls: readBooleanEnv('SMTP_REQUIRE_TLS', true),
    smtpUser: readRequiredEnv('SMTP_USER'),
    smtpPass: readRequiredEnv('SMTP_PASS'),
  }
}

module.exports = {
  resolveEmailConfig,
}
