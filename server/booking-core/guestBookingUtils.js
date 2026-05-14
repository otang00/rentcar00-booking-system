'use strict'

const {
  normalizeCustomerName,
  normalizeCustomerPhone,
  normalizeCustomerBirth,
} = require('./bookingIdentity')
const {
  validatePersonName,
  validateBirthDate,
  validateMobilePhoneNumber,
} = require('../auth/identityValidation')

function normalizeReservationCode(value) {
  return String(value || '').trim().toUpperCase()
}

function validateGuestLookupInput(input = {}) {
  const customerName = normalizeCustomerName(input.customerName)
  const customerPhone = normalizeCustomerPhone(input.customerPhone)
  const customerBirth = normalizeCustomerBirth(input.customerBirth)
  const errors = {}

  if (!customerName) {
    errors.customerName = '이름을 입력해 주세요.'
  } else {
    const nameValidation = validatePersonName(customerName)
    if (!nameValidation.isValid) {
      errors.customerName = nameValidation.message
    }
  }

  const phoneValidation = validateMobilePhoneNumber(customerPhone)
  if (!phoneValidation.isValid) {
    errors.customerPhone = phoneValidation.message
  }

  const birthValidation = validateBirthDate(customerBirth)
  if (!birthValidation.isValid) {
    errors.customerBirth = birthValidation.message
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    normalized: {
      customerName,
      customerPhone,
      customerBirth,
    },
  }
}

function parseLocalDateTime(value) {
  const raw = String(value || '').trim()
  const normalized = /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/)
  if (!match) return null

  const [, year, month, day, hour = '00', minute = '00'] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0)
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== Number(year)
    || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day)
  ) {
    return null
  }

  return date
}

function calculateKoreanAgeAtDate(birthDateValue, referenceDateValue) {
  const birthDate = parseLocalDateTime(normalizeCustomerBirth(birthDateValue))
  const referenceDate = parseLocalDateTime(referenceDateValue)
  if (!birthDate || !referenceDate) return null

  let age = referenceDate.getFullYear() - birthDate.getFullYear()
  const birthdayThisYear = new Date(referenceDate.getFullYear(), birthDate.getMonth(), birthDate.getDate())
  if (referenceDate < birthdayThisYear) {
    age -= 1
  }

  return age
}

function validateDriverAgeRequirement({ customerBirth, deliveryDateTime, requiredDriverAge } = {}) {
  const requiredAge = Number(requiredDriverAge)
  if (![21, 26].includes(requiredAge)) {
    return { isValid: true, requiredAge: null, age: null, message: '' }
  }

  const age = calculateKoreanAgeAtDate(customerBirth, deliveryDateTime)
  const message = `선택한 운전자 연령 조건은 만 ${requiredAge}세 이상입니다. 대여 시작일 기준 만 ${requiredAge}세 이상만 예약할 수 있습니다.`

  if (age === null || age < requiredAge) {
    return { isValid: false, requiredAge, age, message }
  }

  return { isValid: true, requiredAge, age, message: '' }
}

function validateGuestCancelInput(input = {}) {
  const lookupValidation = validateGuestLookupInput(input)
  const reservationCode = normalizeReservationCode(input.reservationCode)
  const errors = { ...lookupValidation.errors }

  if (!reservationCode) {
    errors.reservationCode = '예약번호를 확인해 주세요.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    normalized: {
      ...lookupValidation.normalized,
      reservationCode,
    },
  }
}

function validateGuestBookingCreateInput(input = {}) {
  const customerName = normalizeCustomerName(input.customerName)
  const customerPhone = normalizeCustomerPhone(input.customerPhone)
  const customerBirth = normalizeCustomerBirth(input.customerBirth)
  const deliveryAddressDetail = String(input.deliveryAddressDetail || '').trim()
  const detailToken = String(input.detailToken || '').trim()
  const phoneVerificationId = String(input.phoneVerificationId || '').trim()
  const phoneVerificationToken = String(input.phoneVerificationToken || '').trim()
  const reservationAuthMode = String(input.reservationAuthMode || '').trim() || 'guest_editable'
  const errors = {}

  if (!input.carId || Number.isNaN(Number(input.carId))) {
    errors.carId = '차량 정보가 올바르지 않습니다.'
  }

  if (!detailToken) {
    errors.detailToken = '예약 상세 접근 정보가 올바르지 않습니다.'
  }

  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(input.deliveryDateTime || ''))) {
    errors.deliveryDateTime = '대여일시를 확인해 주세요.'
  }

  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(input.returnDateTime || ''))) {
    errors.returnDateTime = '반납일시를 확인해 주세요.'
  }

  if (!['pickup', 'delivery'].includes(String(input.pickupOption || ''))) {
    errors.pickupOption = '수령 방식을 확인해 주세요.'
  }

  if (String(input.pickupOption || '') === 'delivery' && !String(input.deliveryAddress || '').trim()) {
    errors.deliveryAddress = '딜리버리 주소를 확인해 주세요.'
  }

  if (String(input.pickupOption || '') === 'delivery' && !deliveryAddressDetail) {
    errors.deliveryAddressDetail = '상세주소를 입력해 주세요.'
  }

  if (!customerName) {
    errors.customerName = '이름을 입력해 주세요.'
  } else {
    const nameValidation = validatePersonName(customerName)
    if (!nameValidation.isValid) {
      errors.customerName = nameValidation.message
    }
  }

  const phoneValidation = validateMobilePhoneNumber(customerPhone)
  if (!phoneValidation.isValid) {
    errors.customerPhone = phoneValidation.message
  }

  const birthValidation = validateBirthDate(customerBirth)
  if (!birthValidation.isValid) {
    errors.customerBirth = birthValidation.message
  }

  if (!['guest_editable', 'member_profile_locked', 'verified_locked', 'member_editable'].includes(reservationAuthMode)) {
    errors.reservationAuthMode = '예약 인증 상태를 확인해 주세요.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    normalized: {
      carId: Number(input.carId),
      deliveryDateTime: String(input.deliveryDateTime || '').trim(),
      returnDateTime: String(input.returnDateTime || '').trim(),
      pickupOption: String(input.pickupOption || '').trim(),
      deliveryAddress: String(input.deliveryAddress || '').trim(),
      deliveryAddressDetail,
      quotedTotalAmount: Number(input.quotedTotalAmount || 0),
      rentalAmount: Number(input.rentalAmount || 0),
      insuranceAmount: Number(input.insuranceAmount || 0),
      deliveryAmount: Number(input.deliveryAmount || 0),
      finalAmount: Number(input.finalAmount || input.quotedTotalAmount || 0),
      paymentMethod: String(input.paymentMethod || '').trim(),
      detailToken,
      customerName,
      customerPhone,
      customerBirth,
      phoneVerificationId,
      phoneVerificationToken,
      reservationAuthMode,
    },
  }
}

function maskPhone(value) {
  const digits = String(value || '').replace(/[^\d]/g, '')
  if (digits.length < 7) return digits ? `${digits.slice(0, 2)}***` : null
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(-4)}`
  }
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`
}

function maskBirth(value) {
  const digits = String(value || '').replace(/[^\d]/g, '')
  if (!digits) return null
  if (digits.length <= 4) return `${digits.slice(0, 2)}**`
  return `${digits.slice(0, 4)}****`
}

function serializeBookingOrder(order = {}) {
  return {
    id: order.id || null,
    publicReservationCode: order.public_reservation_code || null,
    customerName: order.customer_name || null,
    customerPhone: maskPhone(order.customer_phone),
    customerPhoneLast4: order.customer_phone_last4 || null,
    customerBirth: maskBirth(order.customer_birth || order.pricing_snapshot?.customerBirth),
    pickupAt: order.pickup_at || null,
    returnAt: order.return_at || null,
    pickupMethod: order.pickup_method || null,
    pickupLocationSnapshot: order.pickup_location_snapshot || null,
    returnLocationSnapshot: order.return_location_snapshot || null,
    pricingSnapshot: order.pricing_snapshot || null,
    quotedTotalAmount: order.quoted_total_amount ?? null,
    bookingStatus: order.booking_status || null,
    paymentStatus: order.payment_status || null,
    syncStatus: order.sync_status || null,
    manualReviewRequired: Boolean(order.manual_review_required),
    cancelledAt: order.cancelled_at || null,
    completedAt: order.completed_at || null,
    createdAt: order.created_at || null,
    updatedAt: order.updated_at || null,
  }
}

const ACTIVE_GUEST_LOOKUP_STATUSES = ['confirmed']

function filterActiveGuestLookupOrders(orders = []) {
  return (Array.isArray(orders) ? orders : [])
    .filter((order) => ACTIVE_GUEST_LOOKUP_STATUSES.includes(String(order?.booking_status || '')))
    .sort((a, b) => {
      const pickupA = a?.pickup_at ? new Date(a.pickup_at).getTime() : Number.POSITIVE_INFINITY
      const pickupB = b?.pickup_at ? new Date(b.pickup_at).getTime() : Number.POSITIVE_INFINITY

      if (pickupA !== pickupB) {
        return pickupA - pickupB
      }

      const createdA = a?.created_at ? new Date(a.created_at).getTime() : 0
      const createdB = b?.created_at ? new Date(b.created_at).getTime() : 0
      return createdB - createdA
    })
}

function canGuestCancelBooking(order = {}, now = new Date(), options = {}) {
  const {
    allowStartedBooking = false,
    allowedBookingStatuses = ['confirmed'],
  } = options
  const bookingStatus = String(order.booking_status || '')
  const paymentStatus = String(order.payment_status || '')
  const pickupAt = order.pickup_at ? new Date(order.pickup_at) : null

  if (!allowedBookingStatuses.includes(bookingStatus)) {
    return {
      ok: false,
      reason: 'cancel_not_allowed_status',
      message: '현재 상태에서는 예약취소가 불가합니다.',
    }
  }

  if (!['paid'].includes(paymentStatus)) {
    return {
      ok: false,
      reason: 'cancel_not_allowed_payment_status',
      message: '현재 결제 상태에서는 예약취소가 불가합니다.',
    }
  }

  if (!pickupAt || Number.isNaN(pickupAt.getTime())) {
    return {
      ok: false,
      reason: 'cancel_invalid_pickup_at',
      message: '예약 정보가 올바르지 않아 취소할 수 없습니다.',
    }
  }

  if (!allowStartedBooking && pickupAt <= now) {
    return {
      ok: false,
      reason: 'cancel_started_booking',
      message: '대여 시작 이후 예약은 온라인 취소가 불가합니다.',
    }
  }

  return { ok: true }
}

function resolveCancelSyncStatus({ order = {}, hasActiveMapping = false } = {}) {
  if (hasActiveMapping) {
    return 'cancel_sync_pending'
  }

  if (['synced', 'cancel_sync_failed'].includes(String(order.sync_status || ''))) {
    return 'cancel_sync_pending'
  }

  return 'not_required'
}

function resolveCancelledPaymentStatus(order = {}) {
  const paymentStatus = String(order.payment_status || '')

  if (paymentStatus === 'paid') {
    return 'refund_pending'
  }

  return paymentStatus || 'refund_pending'
}

module.exports = {
  ACTIVE_GUEST_LOOKUP_STATUSES,
  filterActiveGuestLookupOrders,
  normalizeReservationCode,
  validateGuestCancelInput,
  validateGuestLookupInput,
  validateGuestBookingCreateInput,
  calculateKoreanAgeAtDate,
  validateDriverAgeRequirement,
  serializeBookingOrder,
  canGuestCancelBooking,
  resolveCancelSyncStatus,
  resolveCancelledPaymentStatus,
}
