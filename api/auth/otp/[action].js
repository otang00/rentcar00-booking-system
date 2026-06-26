'use strict'

const { createServerPrivilegedClient } = require('../../../server/supabase/createServerClient')
const { sendSolapiMessage } = require('../../../server/sms/sendSolapiMessage')
const { findMemberProfileByPhone, getMemberPhoneBlockMessage } = require('../../../server/auth/memberPhoneLookup')
const {
  OTP_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
  VERIFIED_TOKEN_TTL_SECONDS,
  GUEST_BOOKING_VERIFIED_TOKEN_TTL_SECONDS,
  generateOtpCode,
  generateVerificationToken,
  getPhoneLast4,
  hashOtpValue,
  isSolapiConfigured,
  normalizePhoneNumber,
} = require('../../../server/auth/phoneOtp')
const { validateMobilePhoneNumber } = require('../../../server/auth/identityValidation')
const {
  validateBookingOtpContext,
  createBookingOtpContextHash,
} = require('../../../server/auth/bookingOtpContext')

function getBody(req) {
  return typeof req.body === 'object' && req.body !== null ? req.body : {}
}

function isSupportedPurpose(purpose) {
  return ['signup', 'guest_booking', 'guest_lookup', 'reset_password'].includes(purpose)
}

async function handleOtpSend(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const payload = getBody(req)
  const purpose = String(payload.purpose || 'signup').trim() || 'signup'
  const phone = normalizePhoneNumber(payload.phone)
  const contextPayload = typeof payload.context === 'object' && payload.context !== null ? payload.context : {}

  if (!isSupportedPurpose(purpose)) {
    return res.status(400).json({ error: 'invalid_purpose', message: '지원하지 않는 인증 목적입니다.' })
  }

  const phoneValidation = validateMobilePhoneNumber(phone)
  if (!phoneValidation.isValid) {
    return res.status(400).json({ error: 'invalid_phone', message: phoneValidation.message })
  }

  let contextHash = null
  if (purpose === 'guest_booking') {
    const contextValidation = validateBookingOtpContext({ ...contextPayload, phone })
    if (!contextValidation.isValid) {
      return res.status(400).json({ error: 'invalid_booking_context', message: contextValidation.message })
    }
    contextHash = createBookingOtpContextHash(contextValidation.normalized)
  }

  const supabaseClient = createServerPrivilegedClient()
  if (!supabaseClient) {
    return res.status(500).json({ error: 'supabase_client_unavailable' })
  }

  if (purpose === 'reset_password') {
    const existingMember = await findMemberProfileByPhone({ supabaseClient, phone })
    if (!existingMember) {
      return res.status(404).json({
        error: 'member_not_found',
        message: '가입된 휴대폰 번호를 찾을 수 없습니다.',
      })
    }
  } else if (['signup', 'guest_booking', 'guest_lookup'].includes(purpose)) {
    const existingMember = await findMemberProfileByPhone({ supabaseClient, phone })
    if (existingMember) {
      return res.status(409).json({
        error: 'phone_already_registered',
        message: getMemberPhoneBlockMessage(purpose),
      })
    }
  }

  if (!isSolapiConfigured()) {
    return res.status(503).json({
      error: 'otp_provider_unavailable',
      message: '문자 인증 설정이 아직 준비되지 않았습니다.',
    })
  }

  const nowIso = new Date().toISOString()
  const { data: latest, error: latestError } = await supabaseClient
    .from('phone_verifications')
    .select('id, cooldown_until')
    .eq('phone', phone)
    .eq('purpose', purpose)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) {
    return res.status(500).json({ error: 'otp_lookup_failed', message: '인증 상태 확인에 실패했습니다.' })
  }

  if (latest?.cooldown_until && latest.cooldown_until > nowIso) {
    const cooldownSeconds = Math.max(1, Math.ceil((new Date(latest.cooldown_until).getTime() - Date.now()) / 1000))
    return res.status(429).json({
      error: 'otp_cooldown',
      message: `인증번호는 ${cooldownSeconds}초 후 다시 요청할 수 있습니다.`,
      cooldownSeconds,
    })
  }

  const code = generateOtpCode()
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString()
  const cooldownUntil = new Date(Date.now() + OTP_COOLDOWN_SECONDS * 1000).toISOString()

  try {
    const smsResult = await sendSolapiMessage({
      to: phone,
      text: `[빵빵카(주)] 인증번호는 ${code} 입니다.`,
    })

    const { data, error } = await supabaseClient
      .from('phone_verifications')
      .insert({
        phone,
        phone_last4: getPhoneLast4(phone),
        purpose,
        otp_code_hash: hashOtpValue(`${purpose}:${phone}:${code}`),
        status: 'pending',
        attempt_count: 0,
        max_attempts: OTP_MAX_ATTEMPTS,
        cooldown_until: cooldownUntil,
        expires_at: expiresAt,
        context_hash: contextHash,
        requested_at: nowIso,
        message_id: smsResult.messageId,
      })
      .select('id')
      .single()

    if (error) {
      return res.status(500).json({ error: 'otp_save_failed', message: '인증번호 저장에 실패했습니다.' })
    }

    return res.status(200).json({
      verificationId: data.id,
      expiresInSeconds: OTP_TTL_SECONDS,
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
      message: '인증번호를 발송했습니다.',
    })
  } catch (error) {
    return res.status(500).json({
      error: 'otp_send_failed',
      message: error?.message || '인증번호 발송에 실패했습니다.',
    })
  }
}

async function handleOtpVerify(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const payload = getBody(req)
  const verificationId = String(payload.verificationId || '').trim()
  const purpose = String(payload.purpose || 'signup').trim() || 'signup'
  const phone = normalizePhoneNumber(payload.phone)
  const code = String(payload.code || '').replace(/\D/g, '').slice(0, 6)

  if (!verificationId) {
    return res.status(400).json({ error: 'missing_verification_id', message: '인증 요청을 먼저 진행해 주세요.' })
  }

  if (!isSupportedPurpose(purpose)) {
    return res.status(400).json({ error: 'invalid_purpose', message: '지원하지 않는 인증 목적입니다.' })
  }

  const phoneValidation = validateMobilePhoneNumber(phone)
  if (!phoneValidation.isValid) {
    return res.status(400).json({ error: 'invalid_phone', message: phoneValidation.message })
  }

  if (code.length !== 6) {
    return res.status(400).json({ error: 'invalid_code', message: '인증번호 6자리를 입력해 주세요.' })
  }

  const supabaseClient = createServerPrivilegedClient()
  if (!supabaseClient) {
    return res.status(500).json({ error: 'supabase_client_unavailable' })
  }

  const { data: verification, error } = await supabaseClient
    .from('phone_verifications')
    .select('*')
    .eq('id', verificationId)
    .maybeSingle()

  if (error) {
    return res.status(500).json({ error: 'otp_lookup_failed', message: '인증 상태 확인에 실패했습니다.' })
  }

  if (!verification || verification.phone !== phone || verification.purpose !== purpose) {
    return res.status(404).json({ error: 'otp_not_found', message: '유효한 인증 요청을 찾을 수 없습니다.' })
  }

  if (verification.verified_at) {
    return res.status(400).json({ error: 'otp_already_verified', message: '이미 인증 완료된 번호입니다. 다시 인증번호를 요청해 주세요.' })
  }

  if (verification.expires_at && verification.expires_at < new Date().toISOString()) {
    await supabaseClient.from('phone_verifications').update({ status: 'expired' }).eq('id', verification.id)
    return res.status(400).json({ error: 'otp_expired', message: '인증번호가 만료되었습니다. 다시 요청해 주세요.' })
  }

  if (verification.attempt_count >= (verification.max_attempts || OTP_MAX_ATTEMPTS)) {
    await supabaseClient.from('phone_verifications').update({ status: 'blocked' }).eq('id', verification.id)
    return res.status(429).json({ error: 'otp_blocked', message: '인증 시도 횟수를 초과했습니다. 다시 요청해 주세요.' })
  }

  const expectedHash = hashOtpValue(`${purpose}:${phone}:${code}`)
  if (verification.otp_code_hash !== expectedHash) {
    const nextAttempts = Number(verification.attempt_count || 0) + 1
    const nextStatus = nextAttempts >= (verification.max_attempts || OTP_MAX_ATTEMPTS) ? 'blocked' : 'pending'

    await supabaseClient
      .from('phone_verifications')
      .update({ attempt_count: nextAttempts, status: nextStatus })
      .eq('id', verification.id)

    return res.status(nextStatus === 'blocked' ? 429 : 400).json({
      error: nextStatus === 'blocked' ? 'otp_blocked' : 'otp_mismatch',
      message: nextStatus === 'blocked' ? '인증 시도 횟수를 초과했습니다. 다시 요청해 주세요.' : '인증번호가 일치하지 않습니다.',
    })
  }

  const verificationToken = generateVerificationToken()
  const verifiedAt = new Date().toISOString()
  const verifiedTokenTtlSeconds = purpose === 'guest_booking'
    ? GUEST_BOOKING_VERIFIED_TOKEN_TTL_SECONDS
    : VERIFIED_TOKEN_TTL_SECONDS
  const expiresAt = new Date(Date.now() + verifiedTokenTtlSeconds * 1000).toISOString()

  const { error: updateError } = await supabaseClient
    .from('phone_verifications')
    .update({
      status: 'verified',
      verified_at: verifiedAt,
      expires_at: expiresAt,
      verification_token_hash: hashOtpValue(`verify:${verificationToken}`),
    })
    .eq('id', verification.id)

  if (updateError) {
    return res.status(500).json({ error: 'otp_verify_failed', message: '인증 완료 처리에 실패했습니다.' })
  }

  return res.status(200).json({
    verificationId: verification.id,
    verificationToken,
    verifiedTokenExpiresInSeconds: verifiedTokenTtlSeconds,
    message: '휴대폰 인증이 완료되었습니다.',
  })
}

module.exports = async function handler(req, res) {
  const action = String(req.query?.action || '').trim()

  if (action === 'send') {
    return handleOtpSend(req, res)
  }

  if (action === 'verify') {
    return handleOtpVerify(req, res)
  }

  return res.status(404).json({ error: 'not_found' })
}
