'use strict'

const nodemailer = require('nodemailer')
const { resolveEmailConfig } = require('./emailConfig')

function createEmailTransport() {
  const config = resolveEmailConfig()

  return {
    config,
    transporter: nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      requireTLS: config.smtpRequireTls,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    }),
  }
}

async function verifyEmailTransport() {
  const { transporter } = createEmailTransport()
  await transporter.verify()
  return true
}

module.exports = {
  createEmailTransport,
  verifyEmailTransport,
}
