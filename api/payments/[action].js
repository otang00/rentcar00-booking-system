'use strict'

const { createServerPrivilegedClient } = require('../../server/supabase/createServerClient')
const {
  createGuestBooking,
  fetchBookingOrderByPaymentReference,
  fetchCarBySourceCarId,
} = require('../../server/booking-core/guestBookingService')
const { ensureBookingAvailability } = require('../../server/booking-core/bookingAvailabilityService')
const { buildSearchWindow } = require('../../server/search-db/helpers/buildSearchWindow')
const { validateDetailSearch } = require('../../server/search/searchState')
const { verifyDetailToken } = require('../../server/security/detailToken')
const { validateGuestBookingCreateInput, validateDriverAgeRequirement, serializeBookingOrder } = require('../../server/booking-core/guestBookingUtils')
const { getAccessTokenFromRequest } = require('../../server/auth/getAccessTokenFromRequest')
const { getUserFromAccessToken } = require('../../server/auth/getUserFromAccessToken')
const { ensureProfileForUser } = require('../../server/auth/ensureProfileForUser')
const { sendBookingConfirmationEmail } = require('../../server/email/sendBookingConfirmationEmail')
const { sendAdminBookingAlert } = require('../../server/notifications/sendAdminBookingAlert')
const { sendCustomerBookingSms } = require('../../server/notifications/sendCustomerBookingSms')
const { enqueueOpsAppReservationEvent } = require('../../server/notifications/opsAppReservationEventOutbox')
const { recordReservationStatusEvent } = require('../../server/booking-core/bookingConfirmationService')
const { createBookingCompleteToken } = require('../../server/security/bookingCompleteToken')
const { hashOtpValue } = require('../../server/auth/phoneOtp')
const { createBookingOtpContextHash } = require('../../server/auth/bookingOtpContext')
const { normalizeCustomerName, normalizeCustomerPhone, normalizeCustomerBirth } = require('../../server/booking-core/bookingIdentity')
const { createPaymentSessionToken, verifyPaymentSessionToken } = require('../../server/payments/paymentSessionToken')
const { registerKcpTrade, approveKcpPayment, stringifyAmount } = require('../../server/payments/kcpClient')
const { getKcpConfig } = require('../../server/payments/kcpConfig')
const { AUTH_EMAIL_ALIAS_DOMAIN } = require('../../server/auth/authEmailAlias')
const { findMemberProfileByPhone } = require('../../server/auth/memberPhoneLookup')

function resolveBuyerEmail({ authUser, profile }) {
  const candidates = [
    profile?.email,
    authUser?.user_metadata?.email,
    authUser?.email,
  ]

  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim().toLowerCase()
    if (!normalized) continue
    if (normalized.endsWith(`@${AUTH_EMAIL_ALIAS_DOMAIN}`)) continue
    return normalized
  }

  return ''
}

function resolvePaymentChannel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'pc_web' || normalized === 'mobile_web') {
    return normalized
  }
  return 'mobile_web'
}

function buildMobilePaymentPayload({
  trade,
  orderId,
  amount,
  car,
  returnUrl,
  buyerName,
  buyerPhone,
  buyerEmail,
  sessionToken,
  kcpConfig,
} = {}) {
  return {
    paymentChannel: 'mobile_web',
    paymentFlow: 'kcp_mobile_hosted',
    actionUrl: trade.PayUrl || trade.payUrl || '',
    formFields: {
      approval_key: trade.approvalKey || trade.approval_key || '',
      approvalKey: trade.approvalKey || trade.approval_key || '',
      PayUrl: trade.PayUrl || trade.payUrl || '',
      ordr_idxx: orderId,
      good_mny: stringifyAmount(amount),
      good_name: `${car.display_name || car.name || '차량'} 예약`,
      shop_name: '빵빵카(주)',
      pay_method: 'CARD',
      Ret_URL: returnUrl,
      encoding_trans: 'UTF-8',
      currency: '410',
      buyr_name: buyerName,
      buyr_tel2: buyerPhone,
      buyr_mail: buyerEmail,
      res_cd: trade.res_cd || '0000',
      site_cd: trade.site_cd || kcpConfig.siteCode || '',
      param_opt_1: sessionToken,
      param_opt_2: 'website_booking',
      session_token: sessionToken,
    },
  }
}

function buildPcPaymentPayload({
  orderId,
  amount,
  car,
  returnUrl,
  buyerName,
  buyerPhone,
  buyerEmail,
  sessionToken,
  kcpConfig,
} = {}) {
  return {
    paymentChannel: 'pc_web',
    paymentFlow: 'kcp_pc_standard',
    actionUrl: returnUrl,
    scriptUrl: kcpConfig.pcScriptUrl,
    formFields: {
      good_name: `${car.display_name || car.name || '차량'} 예약`,
      good_cd: String(car.source_car_id || car.id || ''),
      good_mny: stringifyAmount(amount),
      buyr_name: buyerName,
      buyr_tel1: buyerPhone,
      buyr_tel2: buyerPhone,
      buyr_mail: buyerEmail,
      ordr_idxx: orderId,
      req_tx: 'pay',
      site_cd: kcpConfig.siteCode || '',
      site_name: '빵빵카(주)',
      pay_method: '100000000000',
      quotaopt: '12',
      currency: 'WON',
      module_type: '01',
      res_cd: '',
      res_msg: '',
      enc_info: '',
      enc_data: '',
      ret_pay_method: '',
      tran_cd: '',
      use_pay_method: '',
      ordr_chk: '',
      cash_yn: '',
      cash_tr_code: '',
      cash_id_info: '',
      good_expr: '0',
      tax_flag: 'TG03',
      comm_tax_mny: '',
      comm_vat_mny: '',
      comm_free_mny: '',
      skin_indx: '1',
      kcp_pay_title: '빵빵카(주)',
      disp_tax_yn: 'N',
      param_opt_1: sessionToken,
      param_opt_2: 'website_booking',
      session_token: sessionToken,
    },
  }
}

function getBody(req) {
  if (Buffer.isBuffer(req.body)) {
    req.body = req.body.toString('utf8')
  }

  if (typeof req.body === 'object' && req.body !== null) {
    return req.body
  }

  if (typeof req.body === 'string' && req.body.trim()) {
    const contentType = String(req.headers['content-type'] || '')
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(req.body))
    }

    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }

  return {}
}

function buildReservationOtpContext(payload = {}) {
  return {
    phone: payload.customerPhone,
    carId: payload.carId,
    detailToken: payload.detailToken,
    deliveryDateTime: payload.deliveryDateTime,
    returnDateTime: payload.returnDateTime,
    pickupOption: payload.pickupOption,
    quotedTotalAmount: payload.quotedTotalAmount,
    finalAmount: payload.finalAmount,
  }
}

function isProfileLockedSubmission({ authUser, profile, bookingInput }) {
  if (!authUser?.id || bookingInput.reservationAuthMode !== 'member_profile_locked') {
    return false
  }

  const candidateNames = [
    profile?.name,
    authUser?.user_metadata?.name,
    authUser?.user_metadata?.full_name,
  ]
  const candidatePhones = [
    profile?.phone,
    authUser?.phone,
    authUser?.user_metadata?.phone,
  ]
  const candidateBirthDates = [
    profile?.birthDate,
    profile?.birth_date,
    authUser?.user_metadata?.birth_date,
  ]

  const normalizedName = normalizeCustomerName(bookingInput.customerName)
  const normalizedPhone = normalizeCustomerPhone(bookingInput.customerPhone)
  const normalizedBirth = normalizeCustomerBirth(bookingInput.customerBirth)

  const nameMatches = candidateNames.some((value) => normalizeCustomerName(value) === normalizedName)
  const phoneMatches = candidatePhones.some((value) => normalizeCustomerPhone(value) === normalizedPhone)
  const birthMatches = candidateBirthDates.some((value) => normalizeCustomerBirth(value) === normalizedBirth)

  return nameMatches && phoneMatches && birthMatches
}

async function verifyReservationOtp({ supabaseClient, bookingInput }) {
  const verificationId = String(bookingInput.phoneVerificationId || '').trim()
  const verificationToken = String(bookingInput.phoneVerificationToken || '').trim()
  if (!verificationId || !verificationToken) {
    return { ok: false, status: 400, message: '전화번호 인증을 완료해 주세요.' }
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
  const expectedContextHash = createBookingOtpContextHash(buildReservationOtpContext(bookingInput))

  if (!verification
    || verification.phone !== normalizeCustomerPhone(bookingInput.customerPhone)
    || verification.purpose !== 'guest_booking'
    || verification.status !== 'verified'
    || !verification.verified_at
    || verification.consumed_at
    || verification.verification_token_hash !== tokenHash
    || verification.context_hash !== expectedContextHash
    || (verification.expires_at && verification.expires_at < nowIso)) {
    return { ok: false, status: 400, message: '전화번호 인증을 다시 진행해 주세요.' }
  }

  return { ok: true, verification }
}

function buildBaseUrl(req) {
  const protocol = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https'
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()
  if (!host) {
    throw new Error('request_host_missing')
  }
  return `${protocol}://${host}`
}

function buildFailureRedirectUrl(message) {
  const params = new URLSearchParams()
  params.set('paymentError', String(message || '결제에 실패했습니다.'))
  return `/reservation-complete?${params.toString()}`
}

function redirectTo(res, location) {
  res.statusCode = 302
  res.setHeader('Location', location)
  return res.end('Redirecting...')
}

async function dispatchBookingCreatedNotifications({ supabaseClient, booking, bookingInput, requestedBy, req, isMemberBooking = false }) {
  let emailMeta = null
  try {
    const emailResult = await sendBookingConfirmationEmail({
      booking,
      req,
      customerPhone: bookingInput?.customerPhone,
      customerBirth: bookingInput?.customerBirth,
    })
    emailMeta = {
      delivered: true,
      messageId: emailResult.messageId,
      accepted: emailResult.accepted,
      rejected: emailResult.rejected,
      confirmUrl: emailResult.confirmUrl,
    }

    await recordReservationStatusEvent({
      supabaseClient,
      bookingOrderId: booking.id,
      eventType: 'booking_confirmation_email_sent',
      eventPayload: {
        requestedBy,
        messageId: emailResult.messageId,
        accepted: emailResult.accepted,
        rejected: emailResult.rejected,
        response: emailResult.response,
      },
    })
  } catch (emailError) {
    console.error('[booking-confirmation-email] failed', {
      reservationCode: booking.publicReservationCode,
      message: emailError?.message || 'unknown_email_error',
    })

    await recordReservationStatusEvent({
      supabaseClient,
      bookingOrderId: booking.id,
      eventType: 'booking_confirmation_email_failed',
      eventPayload: {
        requestedBy,
        message: emailError?.message || 'unknown_email_error',
      },
    }).catch(() => null)

    emailMeta = {
      delivered: false,
    }
  }

  let adminAlertMeta = null
  try {
    const adminAlertResult = await sendAdminBookingAlert({ booking })
    adminAlertMeta = adminAlertResult

    await recordReservationStatusEvent({
      supabaseClient,
      bookingOrderId: booking.id,
      eventType: adminAlertResult.skipped ? 'admin_booking_alert_skipped' : 'admin_booking_alert_sent',
      eventPayload: {
        requestedBy,
        reason: adminAlertResult.reason || null,
        recipients: adminAlertResult.recipients || [],
        results: adminAlertResult.results || [],
      },
    })
  } catch (adminAlertError) {
    console.error('[admin-booking-alert] failed', {
      reservationCode: booking.publicReservationCode,
      message: adminAlertError?.message || 'unknown_admin_alert_error',
    })

    await recordReservationStatusEvent({
      supabaseClient,
      bookingOrderId: booking.id,
      eventType: 'admin_booking_alert_failed',
      eventPayload: {
        requestedBy,
        message: adminAlertError?.message || 'unknown_admin_alert_error',
      },
    }).catch(() => null)

    adminAlertMeta = {
      delivered: false,
      skipped: false,
    }
  }


  let customerSmsMeta = null
  try {
    const customerSmsResult = await sendCustomerBookingSms({
      booking,
      customerPhone: bookingInput?.customerPhone,
      isMemberBooking,
    })
    customerSmsMeta = customerSmsResult

    await recordReservationStatusEvent({
      supabaseClient,
      bookingOrderId: booking.id,
      eventType: customerSmsResult.skipped ? 'customer_booking_sms_skipped' : 'customer_booking_sms_sent',
      eventPayload: {
        requestedBy,
        reason: customerSmsResult.reason || null,
        to: customerSmsResult.to || null,
        messageId: customerSmsResult.messageId || null,
      },
    })
  } catch (customerSmsError) {
    console.error('[customer-booking-sms] failed', {
      reservationCode: booking.publicReservationCode,
      message: customerSmsError?.message || 'unknown_customer_sms_error',
    })

    await recordReservationStatusEvent({
      supabaseClient,
      bookingOrderId: booking.id,
      eventType: 'customer_booking_sms_failed',
      eventPayload: {
        requestedBy,
        message: customerSmsError?.message || 'unknown_customer_sms_error',
      },
    }).catch(() => null)

    customerSmsMeta = {
      delivered: false,
      skipped: false,
    }
  }

  let opsAppEventMeta = null
  try {
    const opsAppEventResult = await enqueueOpsAppReservationEvent({
      supabaseClient,
      booking,
      bookingInput,
      requestedBy,
    })
    opsAppEventMeta = opsAppEventResult

    await recordReservationStatusEvent({
      supabaseClient,
      bookingOrderId: booking.id,
      eventType: opsAppEventResult.skipped ? 'ops_app_reservation_event_skipped' : 'ops_app_reservation_event_queued',
      eventPayload: {
        requestedBy,
        eventId: opsAppEventResult.eventId || null,
        outboxId: opsAppEventResult.outboxId || null,
        reason: opsAppEventResult.reason || null,
        deduped: Boolean(opsAppEventResult.deduped),
      },
    })
  } catch (opsAppEventError) {
    console.error('[ops-app-reservation-event-outbox] failed', {
      reservationCode: booking.publicReservationCode,
      message: opsAppEventError?.message || 'unknown_ops_app_event_outbox_error',
    })

    await recordReservationStatusEvent({
      supabaseClient,
      bookingOrderId: booking.id,
      eventType: 'ops_app_reservation_event_queue_failed',
      eventPayload: {
        requestedBy,
        eventId: opsAppEventError?.eventId || null,
        message: opsAppEventError?.message || 'unknown_ops_app_event_outbox_error',
      },
    }).catch(() => null)

    opsAppEventMeta = {
      enqueued: false,
      skipped: false,
    }
  }

  return {
    email: emailMeta,
    adminAlert: adminAlertMeta,
    customerSms: customerSmsMeta,
    opsAppEvent: opsAppEventMeta,
  }
}

function extractApprovalAmount(payload = {}) {
  const candidates = [
    payload.amount,
    payload.good_mny,
    payload.ordr_mony,
    payload.app_time ? payload.amount : null,
  ]

  for (const candidate of candidates) {
    const normalized = Number(candidate)
    if (Number.isFinite(normalized) && normalized >= 0) {
      return Math.round(normalized)
    }
  }

  return null
}

async function consumePhoneVerification({ supabaseClient, verificationId }) {
  if (!verificationId) return

  await supabaseClient
    .from('phone_verifications')
    .update({
      status: 'consumed',
      consumed_at: new Date().toISOString(),
    })
    .eq('id', verificationId)
}

async function handlePaymentApproval({ supabaseClient, sessionToken, encData, encInfo, req }) {
  const tokenValidation = verifyPaymentSessionToken({ token: sessionToken })
  if (!tokenValidation.isValid) {
    return {
      ok: false,
      status: 400,
      message: '결제 세션이 만료되었습니다. 다시 시도해 주세요.',
    }
  }

  const sessionPayload = tokenValidation.payload || {}
  const requestedBy = sessionPayload.requestedBy || 'guest_web'
  const bookingInput = sessionPayload.bookingInput || {}
  const expectedAmount = Math.round(Number(sessionPayload.amount || 0))
  const orderId = String(sessionPayload.orderId || '').trim()

  if (!orderId || !expectedAmount) {
    return {
      ok: false,
      status: 400,
      message: '결제 세션 정보가 올바르지 않습니다.',
    }
  }

  const approval = await approveKcpPayment({
    orderId,
    amount: expectedAmount,
    encData,
    encInfo,
  })

  const approvedAmount = extractApprovalAmount(approval)
  if (!Number.isFinite(approvedAmount) || approvedAmount !== expectedAmount) {
    return {
      ok: false,
      status: 400,
      message: '결제 금액 검증에 실패했습니다.',
      approval,
    }
  }

  const paymentReferenceId = String(approval.tno || approval.trace_no || orderId).trim()
  const existingOrder = await fetchBookingOrderByPaymentReference({
    supabaseClient,
    paymentProvider: 'nhn_kcp',
    paymentReferenceId,
  })

  if (existingOrder) {
    return {
      ok: true,
      booking: serializeBookingOrder(existingOrder),
      completionToken: createBookingCompleteToken({
        bookingOrderId: existingOrder.id,
        reservationCode: existingOrder.public_reservation_code,
      }).token,
      email: { delivered: true, deduped: true },
      adminAlert: { delivered: true, deduped: true },
      approval,
      alreadyProcessed: true,
    }
  }

  const createResult = await createGuestBooking({
    supabaseClient,
    bookingInput,
    requestedBy,
    authUserId: sessionPayload.authUserId || null,
    paymentProvider: 'nhn_kcp',
    paymentReferenceId,
    paymentStatus: 'paid',
    bookingStatus: 'confirmed',
  })

  if (!createResult.ok) {
    return createResult
  }

  if (createResult.deduped) {
    return {
      ok: true,
      booking: createResult.booking,
      completionToken: createBookingCompleteToken({
        bookingOrderId: createResult.booking.id,
        reservationCode: createResult.booking.publicReservationCode,
      }).token,
      email: { delivered: true, deduped: true },
      adminAlert: { delivered: true, deduped: true },
      approval,
      alreadyProcessed: true,
    }
  }

  await consumePhoneVerification({
    supabaseClient,
    verificationId: sessionPayload.verificationId || null,
  })

  await recordReservationStatusEvent({
    supabaseClient,
    bookingOrderId: createResult.booking.id,
    eventType: 'kcp_payment_approved',
    eventPayload: {
      requestedBy,
      orderId,
      paymentReferenceId,
      amount: approvedAmount,
      resCd: approval.res_cd || null,
      resMsg: approval.res_msg || null,
      cardName: approval.card_name || null,
      cardNum: approval.card_num || null,
    },
  }).catch(() => null)

  const notificationMeta = await dispatchBookingCreatedNotifications({
    supabaseClient,
    booking: createResult.booking,
    bookingInput,
    requestedBy,
    req,
    isMemberBooking: Boolean(sessionPayload.authUserId),
  })

  return {
    ok: true,
    booking: createResult.booking,
    completionToken: createBookingCompleteToken({
      bookingOrderId: createResult.booking.id,
      reservationCode: createResult.booking.publicReservationCode,
    }).token,
    approval,
    ...notificationMeta,
  }
}

async function handlePrepare(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const payload = getBody(req)
  const paymentChannel = resolvePaymentChannel(payload.paymentChannel)
  const validation = validateGuestBookingCreateInput(payload)
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'invalid_payment_prepare_request',
      errors: validation.errors,
    })
  }

  if (validation.normalized.paymentMethod !== 'card') {
    return res.status(400).json({
      error: 'unsupported_payment_method',
      message: '현재는 카드 결제만 지원합니다.',
    })
  }

  const supabaseClient = createServerPrivilegedClient()
  if (!supabaseClient) {
    return res.status(500).json({ error: 'supabase_client_unavailable' })
  }

  try {
    const detailSearchValidation = validateDetailSearch({
      carId: validation.normalized.carId,
      searchState: {
        deliveryDateTime: validation.normalized.deliveryDateTime,
        returnDateTime: validation.normalized.returnDateTime,
        pickupOption: validation.normalized.pickupOption,
        deliveryAddress: validation.normalized.deliveryAddress,
        driverAge: payload.driverAge,
        order: payload.order,
        dongId: payload.dongId,
      },
    })

    if (!detailSearchValidation.isValid) {
      return res.status(400).json({
        error: 'invalid_detail_query',
        errors: detailSearchValidation.errors,
      })
    }

    const driverAgeValidation = validateDriverAgeRequirement({
      customerBirth: validation.normalized.customerBirth,
      deliveryDateTime: validation.normalized.deliveryDateTime,
      requiredDriverAge: detailSearchValidation.normalized.driverAge,
    })
    if (!driverAgeValidation.isValid) {
      return res.status(400).json({
        error: 'driver_age_requirement_not_met',
        message: driverAgeValidation.message,
        errors: {
          customerBirth: driverAgeValidation.message,
        },
      })
    }

    const detailTokenValidation = verifyDetailToken({
      token: validation.normalized.detailToken,
      carId: validation.normalized.carId,
      search: detailSearchValidation.normalized,
    })

    if (!detailTokenValidation.isValid) {
      return res.status(403).json({
        error: 'invalid_detail_token',
        message: '예약 상세 접근 정보가 만료되었습니다. 다시 검색해 주세요.',
      })
    }

    const accessToken = getAccessTokenFromRequest(req)
    const authUser = accessToken
      ? await getUserFromAccessToken({ supabaseClient, accessToken })
      : null

    const profile = authUser
      ? await ensureProfileForUser({ supabaseClient, authUser })
      : null

    const requestedBy = authUser ? 'member_web' : 'guest_web'
    const allowWithoutOtp = isProfileLockedSubmission({ authUser, profile, bookingInput: validation.normalized })
    let reservationVerification = null

    if (!authUser) {
      const existingMember = await findMemberProfileByPhone({
        supabaseClient,
        phone: validation.normalized.customerPhone,
      })

      if (existingMember) {
        return res.status(409).json({
          error: 'phone_already_registered',
          message: '이미 가입된 휴대폰 번호입니다. 로그인 후 진행해 주세요.',
        })
      }
    }

    if (!allowWithoutOtp) {
      reservationVerification = await verifyReservationOtp({
        supabaseClient,
        bookingInput: validation.normalized,
      })

      if (!reservationVerification.ok) {
        return res.status(reservationVerification.status || 400).json({
          error: 'reservation_phone_verification_required',
          message: reservationVerification.message,
        })
      }
    }

    const car = await fetchCarBySourceCarId({ supabaseClient, sourceCarId: validation.normalized.carId })
    if (!car) {
      return res.status(404).json({
        error: 'car_not_found',
        message: '예약 차량 정보를 찾을 수 없습니다.',
      })
    }

    const searchWindow = buildSearchWindow({
      deliveryDateTime: validation.normalized.deliveryDateTime,
      returnDateTime: validation.normalized.returnDateTime,
    })

    const availability = await ensureBookingAvailability({
      supabaseClient,
      dbCarId: car.id,
      sourceCarId: Number(car.source_car_id),
      pickupAt: searchWindow.startIso,
      returnAt: searchWindow.endIso,
    })

    if (!availability.ok) {
      return res.status(availability.status || 409).json({
        error: availability.code || 'booking_unavailable',
        message: availability.message || '예약 가능 여부를 다시 확인해 주세요.',
        conflicts: availability.conflicts || null,
      })
    }

    const amount = Math.round(Number(validation.normalized.finalAmount || validation.normalized.quotedTotalAmount || 0))
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'invalid_payment_amount',
        message: '결제 금액을 확인해 주세요.',
      })
    }

    const orderId = `KCP-${Date.now()}-${Math.floor(Math.random() * 900000) + 100000}`
    const sessionToken = createPaymentSessionToken({
      payload: {
        orderId,
        amount,
        requestedBy,
        authUserId: authUser?.id || null,
        verificationId: reservationVerification?.verification?.id || null,
        bookingInput: {
          ...validation.normalized,
          driverAge: payload.driverAge ?? null,
          order: payload.order ?? null,
          dongId: payload.dongId ?? null,
        },
      },
    }).token

    const baseUrl = buildBaseUrl(req)
    const returnUrl = `${baseUrl}/api/payments/return`
    const buyerEmail = resolveBuyerEmail({ authUser, profile })
    const kcpConfig = getKcpConfig()

    if (paymentChannel === 'pc_web') {
      const pcPayload = buildPcPaymentPayload({
        orderId,
        amount,
        car,
        returnUrl,
        buyerName: validation.normalized.customerName,
        buyerPhone: validation.normalized.customerPhone,
        buyerEmail,
        sessionToken,
        kcpConfig,
      })

      return res.status(200).json({
        orderId,
        amount: stringifyAmount(amount),
        ...pcPayload,
      })
    }

    const trade = await registerKcpTrade({
      orderId,
      amount,
      goodName: `${car.display_name || car.name || '차량'} 예약`,
      returnUrl,
      buyerName: validation.normalized.customerName,
      buyerPhone: validation.normalized.customerPhone,
      buyerEmail,
      sessionToken,
    })

    const mobilePayload = buildMobilePaymentPayload({
      trade,
      orderId,
      amount,
      car,
      returnUrl,
      buyerName: validation.normalized.customerName,
      buyerPhone: validation.normalized.customerPhone,
      buyerEmail,
      sessionToken,
      kcpConfig,
    })

    return res.status(200).json({
      orderId,
      amount: stringifyAmount(amount),
      ...mobilePayload,
    })
  } catch (error) {
    return res.status(500).json({
      error: error?.code || 'payment_prepare_failed',
      message: error?.message || '결제 준비에 실패했습니다.',
      missing: error?.missing || null,
    })
  }
}

async function handleApprove(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const payload = getBody(req)
  const sessionToken = String(payload.sessionToken || payload.session_token || '').trim()
  const encData = String(payload.encData || payload.enc_data || '').trim()
  const encInfo = String(payload.encInfo || payload.enc_info || '').trim()

  if (!sessionToken || !encData || !encInfo) {
    return res.status(400).json({
      error: 'invalid_payment_approve_request',
      message: '결제 승인 정보가 올바르지 않습니다.',
    })
  }

  const supabaseClient = createServerPrivilegedClient()
  if (!supabaseClient) {
    return res.status(500).json({ error: 'supabase_client_unavailable' })
  }

  try {
    const result = await handlePaymentApproval({
      supabaseClient,
      sessionToken,
      encData,
      encInfo,
      req,
    })

    if (!result.ok) {
      return res.status(result.status || 400).json({
        error: result.code || 'payment_approve_failed',
        message: result.message || '결제 승인에 실패했습니다.',
      })
    }

    return res.status(200).json({
      booking: result.booking,
      completionToken: result.completionToken,
      email: result.email,
      adminAlert: result.adminAlert,
    })
  } catch (error) {
    return res.status(500).json({
      error: error?.code || 'payment_approve_failed',
      message: error?.message || '결제 승인에 실패했습니다.',
    })
  }
}

async function handleReturn(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const payload = getBody(req)
  const sessionToken = String(payload.param_opt_1 || payload.session_token || '').trim()
  const resCd = String(payload.res_cd || '').trim()
  const resMsg = String(payload.res_msg || '').trim()
  const encData = String(payload.enc_data || '').trim()
  const encInfo = String(payload.enc_info || '').trim()

  if (!sessionToken) {
    return redirectTo(res, buildFailureRedirectUrl('결제 세션을 찾지 못했습니다. 다시 시도해 주세요.'))
  }

  if (resCd && resCd !== '0000') {
    return redirectTo(res, buildFailureRedirectUrl(resMsg || '결제가 취소되었거나 승인에 실패했습니다.'))
  }

  if (!encData || !encInfo) {
    return redirectTo(res, buildFailureRedirectUrl('결제 승인 정보가 누락되었습니다. 다시 시도해 주세요.'))
  }

  const supabaseClient = createServerPrivilegedClient()
  if (!supabaseClient) {
    return redirectTo(res, buildFailureRedirectUrl('결제 승인 서버가 준비되지 않았습니다.'))
  }

  try {
    const result = await handlePaymentApproval({
      supabaseClient,
      sessionToken,
      encData,
      encInfo,
      req,
    })

    if (!result.ok) {
      return redirectTo(res, buildFailureRedirectUrl(result.message || '결제 승인에 실패했습니다.'))
    }

    return redirectTo(res, `/reservation-complete?token=${encodeURIComponent(result.completionToken)}`)
  } catch (error) {
    return redirectTo(res, buildFailureRedirectUrl(error?.message || '결제 승인에 실패했습니다.'))
  }
}

module.exports = async function handler(req, res) {
  const action = String(req.query?.action || '').trim()

  if (action === 'prepare') {
    return handlePrepare(req, res)
  }

  if (action === 'approve') {
    return handleApprove(req, res)
  }

  if (action === 'return') {
    return handleReturn(req, res)
  }

  res.setHeader('Allow', 'POST')
  return res.status(404).json({ error: 'not_found' })
}
