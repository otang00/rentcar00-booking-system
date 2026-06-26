'use strict'

const { createServerPrivilegedClient } = require('../../server/supabase/createServerClient')
const { getAccessTokenFromRequest } = require('../../server/auth/getAccessTokenFromRequest')
const { getUserFromAccessToken } = require('../../server/auth/getUserFromAccessToken')
const { ensureProfileForUser, serializeProfile } = require('../../server/auth/ensureProfileForUser')
const { serializeBookingOrder } = require('../../server/booking-core/guestBookingUtils')
const { cancelMemberBooking, fetchBookingOrderByMemberReservationCode } = require('../../server/booking-core/guestBookingService')

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const supabaseClient = createServerPrivilegedClient()
  if (!supabaseClient) {
    return res.status(500).json({ error: 'supabase_client_unavailable' })
  }

  const accessToken = getAccessTokenFromRequest(req)
  if (!accessToken) {
    return res.status(401).json({ error: 'missing_access_token', message: '로그인이 필요합니다.' })
  }

  const reservationCode = String(req.query?.reservationCode || '').trim().toUpperCase()
  const action = String(req.query?.action || '').trim().toLowerCase()
  const payload = typeof req.body === 'object' && req.body !== null ? req.body : {}

  try {
    const authUser = await getUserFromAccessToken({ supabaseClient, accessToken })
    if (!authUser) {
      return res.status(401).json({ error: 'invalid_access_token', message: '로그인이 필요합니다.' })
    }

    if (req.method === 'POST' && action === 'cancel') {
      if (!reservationCode) {
        return res.status(400).json({ error: 'missing_reservation_code', message: '예약번호가 필요합니다.' })
      }

      const result = await cancelMemberBooking({
        supabaseClient,
        authUserId: authUser.id,
        reservationCode,
        requestedBy: 'member_web',
        reason: payload.reason || '',
      })

      if (!result.ok) {
        return res.status(result.status || 400).json({
          error: result.code || 'member_cancel_failed',
          message: result.message || '예약취소에 실패했습니다.',
          booking: result.booking || null,
        })
      }

      return res.status(200).json({
        booking: result.booking,
        mapping: result.mapping || null,
      })
    }

    if (req.method === 'GET' && reservationCode) {
      const booking = await fetchBookingOrderByMemberReservationCode({
        supabaseClient,
        authUserId: authUser.id,
        reservationCode,
      })

      if (!booking) {
        return res.status(404).json({ error: 'booking_not_found', message: '예약 정보를 찾지 못했습니다.' })
      }

      return res.status(200).json({
        booking: serializeBookingOrder(booking),
      })
    }

    const profile = await ensureProfileForUser({ supabaseClient, authUser })
    const { data, error } = await supabaseClient
      .from('booking_orders')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return res.status(200).json({
      profile: serializeProfile(profile),
      bookings: Array.isArray(data) ? data.map((item) => serializeBookingOrder(item)) : [],
    })
  } catch (error) {
    return res.status(500).json({
      error: 'member_bookings_failed',
      message: error?.message || 'member_bookings_failed',
    })
  }
}
