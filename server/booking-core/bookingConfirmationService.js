'use strict'

const { serializeBookingOrder } = require('./guestBookingUtils')
const { verifyBookingConfirmToken } = require('../security/bookingConfirmToken')

async function fetchBookingOrderByConfirmationToken({ supabaseClient, token } = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const tokenCheck = verifyBookingConfirmToken({ token })
  if (!tokenCheck.isValid) {
    const isExpired = tokenCheck.reason === 'expired_token'
    return {
      ok: false,
      status: isExpired ? 410 : 400,
      code: tokenCheck.reason || 'invalid_token',
      message: isExpired ? '예약 확인 링크가 만료되었습니다.' : '예약 확인 링크가 올바르지 않습니다.',
    }
  }

  const { boid, rc } = tokenCheck.payload
  const { data, error } = await supabaseClient
    .from('booking_orders')
    .select('*')
    .eq('id', boid)
    .eq('public_reservation_code', rc)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return {
      ok: false,
      status: 404,
      code: 'booking_not_found',
      message: '예약 정보를 찾지 못했습니다.',
    }
  }

  return {
    ok: true,
    status: 200,
    rawBooking: data,
    booking: serializeBookingOrder(data),
    tokenPayload: tokenCheck.payload,
  }
}

async function recordReservationStatusEvent({ supabaseClient, bookingOrderId, eventType, eventPayload } = {}) {
  if (!supabaseClient || !bookingOrderId || !eventType) {
    return
  }

  const { error } = await supabaseClient
    .from('reservation_status_events')
    .insert({
      booking_order_id: bookingOrderId,
      event_type: eventType,
      event_payload: eventPayload || null,
    })

  if (error) {
    throw error
  }
}

module.exports = {
  fetchBookingOrderByConfirmationToken,
  recordReservationStatusEvent,
}
