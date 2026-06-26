'use strict'

const { createEmailTransport } = require('./emailTransport')
const { buildSignupNotificationEmail } = require('./signupNotificationEmail')

async function sendSignupNotificationEmail({ member, createdAt } = {}) {
  const { transporter, config } = createEmailTransport()
  const email = buildSignupNotificationEmail({ member, createdAt })

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
  sendSignupNotificationEmail,
}
