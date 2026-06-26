'use strict'

const { hashOtpValue, normalizePhoneNumber } = require('./phoneOtp')

function normalizeBookingOtpContext(input = {}) {
  return {
    phone: normalizePhoneNumber(input.phone),
    carId: Number(input.carId || 0),
    detailToken: String(input.detailToken || '').trim(),
    deliveryDateTime: String(input.deliveryDateTime || '').trim(),
    returnDateTime: String(input.returnDateTime || '').trim(),
    pickupOption: String(input.pickupOption || '').trim(),
    quotedTotalAmount: Number(input.quotedTotalAmount || input.finalAmount || 0),
  }
}

function validateBookingOtpContext(input = {}) {
  const normalized = normalizeBookingOtpContext(input)

  if (!normalized.phone) return { isValid: false, message: '휴대폰 번호를 확인해 주세요.', normalized }
  if (!normalized.carId) return { isValid: false, message: '차량 정보를 확인해 주세요.', normalized }
  if (!normalized.detailToken) return { isValid: false, message: '예약 상세 접근 정보가 올바르지 않습니다.', normalized }
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized.deliveryDateTime)) return { isValid: false, message: '대여일시를 확인해 주세요.', normalized }
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized.returnDateTime)) return { isValid: false, message: '반납일시를 확인해 주세요.', normalized }
  if (!['pickup', 'delivery'].includes(normalized.pickupOption)) return { isValid: false, message: '수령 방식을 확인해 주세요.', normalized }

  return { isValid: true, message: '', normalized }
}

function createBookingOtpContextHash(input = {}, env = process.env) {
  const normalized = normalizeBookingOtpContext(input)
  const canonical = JSON.stringify(normalized)
  return hashOtpValue(`booking_context:${canonical}`, env)
}

module.exports = {
  normalizeBookingOtpContext,
  validateBookingOtpContext,
  createBookingOtpContextHash,
}
