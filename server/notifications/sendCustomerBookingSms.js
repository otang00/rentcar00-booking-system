'use strict'

const { sendSolapiMessage } = require('../sms/sendSolapiMessage')

const DEFAULT_CONTACT_PHONE = '02-592-0079'
const MEMBER_BOOKING_URL = 'https://rentcar00.com/reservations'
const GUEST_BOOKING_URL = 'https://rentcar00.com/guest-bookings'

function isCustomerSmsConfigured(env = process.env) {
  return Boolean(
    String(env.SOLAPI_API_KEY || '').trim()
    && String(env.SOLAPI_API_SECRET || '').trim()
    && String(env.SOLAPI_SENDER || '').trim()
  )
}

function normalizeSmsPhone(value) {
  return String(value || '').replace(/[^\d]/g, '')
}

function formatLocalDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(/\. /g, '.').replace(/\.$/, '')
}

function resolveBookingLookupUrl({ isMemberBooking } = {}) {
  return isMemberBooking ? MEMBER_BOOKING_URL : GUEST_BOOKING_URL
}

function buildCustomerBookingSmsText({ booking, isMemberBooking = false, env = process.env } = {}) {
  const reservationCode = booking?.publicReservationCode || '-'
  const carName = booking?.pricingSnapshot?.carName || '-'
  const amount = `${Number(booking?.quotedTotalAmount || 0).toLocaleString('ko-KR')}원`
  const bookingUrl = resolveBookingLookupUrl({ isMemberBooking })
  const contactPhone = String(env.BOOKING_CUSTOMER_SMS_CONTACT || DEFAULT_CONTACT_PHONE).trim()

  const lines = [
    '[빵빵카(주)] 예약이 확정되었습니다.',
    `예약번호: ${reservationCode}`,
    `차량: ${carName}`,
    `대여: ${formatLocalDateTime(booking?.pickupAt)}`,
    `반납: ${formatLocalDateTime(booking?.returnAt)}`,
    `금액: ${amount}`,
    '',
    '예약 조회:',
    bookingUrl,
  ]

  if (contactPhone) {
    lines.push('', `문의: ${contactPhone}`)
  }

  return lines.join('\n')
}

async function sendCustomerBookingSms({ booking, customerPhone, isMemberBooking = false, env = process.env } = {}) {
  const to = normalizeSmsPhone(customerPhone || booking?.customerPhone || '')
  if (!to) {
    return {
      delivered: false,
      skipped: true,
      reason: 'missing_customer_phone',
      to: null,
    }
  }

  if (!isCustomerSmsConfigured(env)) {
    return {
      delivered: false,
      skipped: true,
      reason: 'missing_solapi_sms_config',
      to,
    }
  }

  const text = buildCustomerBookingSmsText({ booking, isMemberBooking, env })
  const sent = await sendSolapiMessage({ to, text, env })

  return {
    delivered: true,
    skipped: false,
    to,
    messageId: sent.messageId || null,
  }
}

module.exports = {
  DEFAULT_CONTACT_PHONE,
  MEMBER_BOOKING_URL,
  GUEST_BOOKING_URL,
  isCustomerSmsConfigured,
  buildCustomerBookingSmsText,
  sendCustomerBookingSms,
}
