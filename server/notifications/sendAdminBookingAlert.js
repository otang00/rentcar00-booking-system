'use strict'

const { sendSolapiMessage } = require('../sms/sendSolapiMessage')

function readRecipients(env = process.env) {
  const raw = String(env.ADMIN_BOOKING_ALERT_RECIPIENTS || '').trim()
  if (!raw) return []

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function buildAdminBookingAlertText({ booking } = {}) {
  const reservationCode = booking?.publicReservationCode || '-'
  const customerName = booking?.customerName || '-'
  const carName = booking?.pricingSnapshot?.carName || '-'
  const pickupAt = booking?.pickupAt || '-'
  const returnAt = booking?.returnAt || '-'
  const amount = `${Number(booking?.quotedTotalAmount || 0).toLocaleString('ko-KR')}원`

  return [
    '[00렌트카] 예약 확정',
    `예약번호 ${reservationCode}`,
    `고객 ${customerName}`,
    `차량 ${carName}`,
    `대여 ${pickupAt}`,
    `반납 ${returnAt}`,
    `금액 ${amount}`,
  ].join('\n')
}

async function sendAdminBookingAlert({ booking, env = process.env } = {}) {
  const recipients = readRecipients(env)
  if (recipients.length === 0) {
    return {
      delivered: false,
      skipped: true,
      reason: 'missing_admin_booking_alert_recipients',
      recipients: [],
      results: [],
    }
  }

  const text = buildAdminBookingAlertText({ booking })
  const results = []

  for (const to of recipients) {
    const sent = await sendSolapiMessage({ to, text, env })
    results.push({ to, messageId: sent.messageId || null })
  }

  return {
    delivered: true,
    skipped: false,
    recipients,
    results,
  }
}

module.exports = {
  readRecipients,
  buildAdminBookingAlertText,
  sendAdminBookingAlert,
}
