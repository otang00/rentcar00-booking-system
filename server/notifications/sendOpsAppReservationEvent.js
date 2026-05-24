'use strict'

const crypto = require('node:crypto')

const EVENT_TYPE = 'reservation.created'
const EVENT_SOURCE = 'rentcar00-booking-system'
const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_ADMIN_BASE_URL = 'https://rentcar00.com'

function readConfig(env = process.env) {
  const url = String(env.OPS_APP_RESERVATION_EVENT_URL || '').trim()
  const secret = String(env.OPS_APP_RESERVATION_EVENT_SECRET || '').trim()
  const timeoutMs = Number(env.OPS_APP_RESERVATION_EVENT_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)

  return {
    url,
    secret,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
  }
}

function createEventId(booking = {}) {
  const bookingId = String(booking?.id || '').trim()
  if (!bookingId) return ''
  return `${EVENT_TYPE}:${bookingId}`
}

function normalizeAmount(value) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) ? Math.round(amount) : 0
}

function readDeliveryAddressSummary(booking = {}) {
  const snapshot = booking.pickupLocationSnapshot || {}
  const address = String(snapshot.deliveryAddress || '').trim()
  if (!address) return ''
  const parts = address.split(/\s+/).filter(Boolean)
  return parts.slice(0, 3).join(' ')
}

function buildAdminBookingUrl(booking = {}, env = process.env) {
  const baseUrl = String(env.RENTCAR00_PUBLIC_BASE_URL || DEFAULT_ADMIN_BASE_URL).trim().replace(/\/$/, '')
  const reservationCode = String(booking?.publicReservationCode || '').trim()
  if (!reservationCode) return null
  return `${baseUrl}/admin/bookings?reservationNumber=${encodeURIComponent(reservationCode)}`
}

function buildOpsReservationEventPayload({ booking, bookingInput = {}, env = process.env, now = new Date() } = {}) {
  const eventId = createEventId(booking)
  const pricingSnapshot = booking?.pricingSnapshot || {}
  const customerPhone = String(bookingInput?.customerPhone || '').trim() || null
  const customerBirth = String(bookingInput?.customerBirth || '').trim() || null

  return {
    eventId,
    eventType: EVENT_TYPE,
    occurredAt: now.toISOString(),
    source: EVENT_SOURCE,
    booking: {
      bookingOrderId: booking?.id || null,
      reservationCode: booking?.publicReservationCode || null,
      bookingStatus: booking?.bookingStatus || null,
      paymentStatus: booking?.paymentStatus || null,
      paymentProvider: null,
      paymentReferenceId: null,
      customerName: booking?.customerName || null,
      customerPhone,
      customerBirth,
      customerPhoneLast4: booking?.customerPhoneLast4 || null,
      carId: null,
      sourceCarId: pricingSnapshot.sourceCarId || null,
      carName: pricingSnapshot.carName || null,
      carNumber: pricingSnapshot.carNumber || null,
      pickupAt: booking?.pickupAt || null,
      returnAt: booking?.returnAt || null,
      pickupMethod: booking?.pickupMethod || null,
      deliveryAddressSummary: readDeliveryAddressSummary(booking),
      quotedTotalAmount: normalizeAmount(booking?.quotedTotalAmount),
    },
    links: {
      adminBookingUrl: buildAdminBookingUrl(booking, env),
    },
  }
}

function createSignature({ secret, timestamp, rawBody }) {
  return `sha256=${crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')}`
}

async function postJsonWithTimeout({ url, body, headers, timeoutMs }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function sendOpsAppReservationEvent({ booking, env = process.env, now = new Date(), payloadOverride = null } = {}) {
  const config = readConfig(env)
  const eventId = String(payloadOverride?.eventId || createEventId(booking)).trim()

  if (!config.url) {
    return {
      delivered: false,
      skipped: true,
      reason: 'missing_ops_app_reservation_event_url',
      eventId,
      status: null,
    }
  }

  if (!config.secret) {
    return {
      delivered: false,
      skipped: true,
      reason: 'missing_ops_app_reservation_event_secret',
      eventId,
      status: null,
    }
  }

  if (!eventId) {
    return {
      delivered: false,
      skipped: true,
      reason: 'missing_booking_id',
      eventId: null,
      status: null,
    }
  }

  const payload = payloadOverride || buildOpsReservationEventPayload({ booking, env, now })
  const rawBody = JSON.stringify(payload)
  const timestamp = String(now.getTime())
  const signature = createSignature({ secret: config.secret, timestamp, rawBody })

  const response = await postJsonWithTimeout({
    url: config.url,
    body: rawBody,
    timeoutMs: config.timeoutMs,
    headers: {
      'content-type': 'application/json',
      'x-rentcar00-event-type': EVENT_TYPE,
      'x-rentcar00-event-id': eventId,
      'x-rentcar00-timestamp': timestamp,
      'x-rentcar00-signature': signature,
    },
  })

  let responsePayload = null
  try {
    responsePayload = await response.json()
  } catch {
    responsePayload = null
  }

  if (!response.ok) {
    const error = new Error(`ops_app_reservation_event_http_${response.status}`)
    error.status = response.status
    error.responsePayload = responsePayload
    error.eventId = eventId
    throw error
  }

  return {
    delivered: true,
    skipped: false,
    eventId,
    status: response.status,
    deduped: Boolean(responsePayload?.deduped),
  }
}

module.exports = {
  EVENT_TYPE,
  readConfig,
  createEventId,
  buildOpsReservationEventPayload,
  createSignature,
  sendOpsAppReservationEvent,
}
