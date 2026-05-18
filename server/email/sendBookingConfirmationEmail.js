'use strict'

const { createEmailTransport } = require('./emailTransport')
const { buildBookingConfirmationEmail } = require('./bookingConfirmationEmail')

async function sendBookingConfirmationEmail({ booking, req, customerPhone, customerBirth } = {}) {
  const { transporter, config } = createEmailTransport()
  const email = buildBookingConfirmationEmail({ booking, req, customerPhone, customerBirth })

  const info = await transporter.sendMail({
    from: `${config.bookingEmailFromName} <${config.bookingEmailFrom}>`,
    to: config.bookingEmailTo,
    subject: email.subject,
    text: email.text,
    html: email.html,
  })

  return {
    ...email,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
    messageId: info.messageId || null,
    response: info.response || null,
  }
}

module.exports = {
  sendBookingConfirmationEmail,
}
