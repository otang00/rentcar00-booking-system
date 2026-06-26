'use strict'

const { createServerPrivilegedClient } = require('../../server/supabase/createServerClient')
const { lookupGuestBooking, fetchBookingOrderByCompletionToken, cancelGuestBooking } = require('../../server/booking-core/guestBookingService')
const { verifyBookingCompleteToken } = require('../../server/security/bookingCompleteToken')
const { createGuestLookupToken, verifyGuestLookupToken } = require('../../server/security/guestLookupToken')
const { checkGuestLookupProtection, applyRetryAfter, delayFailureResponse } = require('../../server/security/guestLookupProtection')
const { hashOtpValue } = require('../../server/auth/phoneOtp')
const { normalizeCustomerPhone } = require('../../server/booking-core/bookingIdentity')

function getBody(req) {
  return typeof req.body === 'object' && req.body !== null ? req.body : {}
}

async function verifyGuestLookupOtp({ supabaseClient, phone, verificationId, verificationToken }) {
  const normalizedPhone = normalizeCustomerPhone(phone)
  if (!/^01\d{8,9}$/.test(normalizedPhone) || !verificationId || !verificationToken) {
    return { ok: false, status: 400, message: '휴대폰 인증을 다시 진행해 주세요.' }
  }

  const { data: verification, error } = await supabaseClient
    .from('phone_verifications')
    .select('*')
    .eq('id', verificationId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const tokenHash = hashOtpValue(`verify:${verificationToken}`)
  const nowIso = new Date().toISOString()

  if (!verification
    || verification.phone !== normalizedPhone
    || verification.purpose !== 'guest_lookup'
    || verification.status !== 'verified'
    || !verification.verified_at
    || verification.consumed_at
    || verification.verification_token_hash !== tokenHash
    || (verification.expires_at && verification.expires_at < nowIso)) {
    return { ok: false, status: 400, message: '휴대폰 인증을 다시 진행해 주세요.' }
  }

  return {
    ok: true,
    verification,
    phone: normalizedPhone,
  }
}

async function consumePhoneVerification({ supabaseClient, verificationId }) {
  if (!supabaseClient || !verificationId) return

  await supabaseClient
    .from('phone_verifications')
    .update({
      status: 'consumed',
      consumed_at: new Date().toISOString(),
    })
    .eq('id', verificationId)
}

function buildGuestLookupSessionResponse({ bookings = [], phone, tokenPayload, lookupToken }) {
  return {
    bookings,
    lookupToken,
    verifiedPhone: phone,
    lookupTokenExpiresAt: new Date(Number(tokenPayload.exp) * 1000).toISOString(),
  }
}

async function handleCreate(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  return res.status(410).json({
    error: 'legacy_booking_create_disabled',
    message: '직접 예약 생성 경로는 종료되었습니다. 결제 후 예약이 확정됩니다.',
  })
}

async function handleLookup(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const payload = getBody(req)
  const completionToken = String(payload.completionToken || '').trim()

  if (completionToken) {
    const tokenValidation = verifyBookingCompleteToken({ token: completionToken })
    if (!tokenValidation.isValid) {
      return res.status(403).json({
        error: 'invalid_booking_complete_token',
        message: '예약 완료 정보를 확인할 수 없습니다.',
      })
    }

    const supabaseClient = createServerPrivilegedClient()
    if (!supabaseClient) {
      return res.status(500).json({ error: 'supabase_client_unavailable' })
    }

    try {
      const booking = await fetchBookingOrderByCompletionToken({
        supabaseClient,
        bookingOrderId: tokenValidation.payload.boid,
        reservationCode: tokenValidation.payload.rc,
      })

      if (!booking) {
        return res.status(404).json({
          error: 'booking_not_found',
          message: '예약 정보를 찾지 못했습니다.',
        })
      }

      return res.status(200).json({ booking })
    } catch (error) {
      return res.status(500).json({
        error: 'guest_booking_complete_failed',
        message: error?.message || 'guest_booking_complete_failed',
      })
    }
  }

  const protection = checkGuestLookupProtection({ action: 'lookup', req })
  if (!protection.ok) {
    applyRetryAfter(res, protection.retryAfterSeconds)
    return res.status(429).json({
      error: 'too_many_requests',
      message: '요청이 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.',
    })
  }

  const supabaseClient = createServerPrivilegedClient()
  if (!supabaseClient) {
    return res.status(500).json({ error: 'supabase_client_unavailable' })
  }

  try {
    const lookupToken = String(payload.lookupToken || '').trim()

    if (lookupToken) {
      const tokenValidation = verifyGuestLookupToken({ token: lookupToken })
      if (!tokenValidation.isValid) {
        const failure = protection.recordFailure()
        await delayFailureResponse()
        applyRetryAfter(res, failure.retryAfterSeconds)
        return res.status(tokenValidation.reason === 'expired_token' ? 401 : 400).json({
          error: tokenValidation.reason === 'expired_token' ? 'guest_lookup_session_expired' : 'invalid_guest_lookup_token',
          message: tokenValidation.reason === 'expired_token'
            ? '인증이 만료되었습니다. 다시 휴대폰 인증을 진행해 주세요.'
            : '유효한 조회 인증이 아닙니다. 다시 휴대폰 인증을 진행해 주세요.',
        })
      }

      const result = await lookupGuestBooking({
        supabaseClient,
        customerPhone: tokenValidation.payload.phone,
      })

      protection.recordSuccess()

      return res.status(200).json(buildGuestLookupSessionResponse({
        bookings: result.bookings,
        phone: tokenValidation.payload.phone,
        tokenPayload: tokenValidation.payload,
        lookupToken,
      }))
    }

    const verificationId = String(payload.phoneVerificationId || '').trim()
    const verificationToken = String(payload.phoneVerificationToken || '').trim()
    const phone = normalizeCustomerPhone(payload.customerPhone)

    const verification = await verifyGuestLookupOtp({
      supabaseClient,
      phone,
      verificationId,
      verificationToken,
    })

    if (!verification.ok) {
      const failure = protection.recordFailure()
      await delayFailureResponse()
      applyRetryAfter(res, failure.retryAfterSeconds)
      return res.status(verification.status || 400).json({
        error: 'guest_lookup_phone_verification_required',
        message: verification.message,
      })
    }

    const result = await lookupGuestBooking({
      supabaseClient,
      customerPhone: verification.phone,
    })

    const issued = createGuestLookupToken({ phone: verification.phone })
    await consumePhoneVerification({ supabaseClient, verificationId: verification.verification.id })
    protection.recordSuccess()

    return res.status(200).json(buildGuestLookupSessionResponse({
      bookings: result.bookings,
      phone: verification.phone,
      tokenPayload: issued.payload,
      lookupToken: issued.token,
    }))
  } catch (error) {
    return res.status(500).json({
      error: 'guest_lookup_failed',
      message: error?.message || 'guest_lookup_failed',
    })
  }
}

async function handleCancel(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const payload = getBody(req)
  const reservationCode = String(payload.reservationCode || '').trim().toUpperCase()
  const lookupToken = String(payload.lookupToken || '').trim()

  if (!reservationCode || !lookupToken) {
    await delayFailureResponse()
    return res.status(400).json({
      error: 'invalid_guest_cancel_request',
      message: '유효한 조회 인증과 예약번호가 필요합니다.',
    })
  }

  const protection = checkGuestLookupProtection({ action: 'cancel', req })
  if (!protection.ok) {
    applyRetryAfter(res, protection.retryAfterSeconds)
    return res.status(429).json({
      error: 'too_many_requests',
      message: '요청이 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.',
    })
  }

  const supabaseClient = createServerPrivilegedClient()
  if (!supabaseClient) {
    return res.status(500).json({ error: 'supabase_client_unavailable' })
  }

  try {
    const tokenValidation = verifyGuestLookupToken({ token: lookupToken })
    if (!tokenValidation.isValid) {
      const failure = protection.recordFailure()
      await delayFailureResponse()
      applyRetryAfter(res, failure.retryAfterSeconds)
      return res.status(tokenValidation.reason === 'expired_token' ? 401 : 400).json({
        error: tokenValidation.reason === 'expired_token' ? 'guest_lookup_session_expired' : 'invalid_guest_lookup_token',
        message: tokenValidation.reason === 'expired_token'
          ? '인증이 만료되었습니다. 다시 휴대폰 인증을 진행해 주세요.'
          : '유효한 조회 인증이 아닙니다. 다시 휴대폰 인증을 진행해 주세요.',
      })
    }

    const result = await cancelGuestBooking({
      supabaseClient,
      customerPhone: tokenValidation.payload.phone,
      reservationCode,
      requestedBy: 'guest',
      reason: payload.reason || '',
    })

    if (!result.ok) {
      const shouldCountAsFailure = ['booking_not_found', 'cancel_not_allowed_status', 'cancel_not_allowed_payment_status', 'cancel_started_booking'].includes(result.code)
      if (shouldCountAsFailure) {
        const failure = protection.recordFailure()
        await delayFailureResponse()
        applyRetryAfter(res, failure.retryAfterSeconds)
      }

      return res.status(result.status || 400).json({
        error: result.code || 'guest_cancel_failed',
        message: result.message || '예약취소에 실패했습니다.',
        booking: result.booking || null,
      })
    }

    protection.recordSuccess()

    return res.status(200).json({
      booking: result.booking,
      mapping: result.mapping,
      lookupTokenExpiresAt: new Date(Number(tokenValidation.payload.exp) * 1000).toISOString(),
    })
  } catch (error) {
    return res.status(500).json({
      error: 'guest_cancel_failed',
      message: error?.message || 'guest_cancel_failed',
    })
  }
}

module.exports = async function handler(req, res) {
  const action = String(req.query?.action || '').trim()

  if (action === 'create') {
    return handleCreate(req, res)
  }

  if (action === 'lookup') {
    return handleLookup(req, res)
  }

  if (action === 'cancel') {
    return handleCancel(req, res)
  }

  return res.status(404).json({ error: 'not_found' })
}
