import {
  normalizePersonName,
  validateBirthDate,
  validateMobilePhoneNumber,
  validatePersonName,
} from '../utils/identityValidation'

export const DEFAULT_RESERVATION_FORM = {
  customerName: '',
  customerPhone: '',
  customerBirth: '',
}

export function normalizePhone(value) {
  return String(value || '').replace(/[^\d]/g, '').slice(0, 11)
}

export function normalizeBirth(value) {
  return String(value || '').replace(/[^\d]/g, '').slice(0, 8)
}

export function normalizeReservationForm(form = {}) {
  return {
    customerName: normalizePersonName(form.customerName),
    customerPhone: normalizePhone(form.customerPhone),
    customerBirth: normalizeBirth(form.customerBirth),
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

export function calculateKoreanAgeAtDate(birthDateValue, referenceDateValue) {
  const birthDate = parseLocalDateTime(normalizeBirth(birthDateValue))
  const referenceDate = parseLocalDateTime(referenceDateValue)
  if (!birthDate || !referenceDate) return null

  let age = referenceDate.getFullYear() - birthDate.getFullYear()
  const birthdayThisYear = new Date(referenceDate.getFullYear(), birthDate.getMonth(), birthDate.getDate())
  if (referenceDate < birthdayThisYear) {
    age -= 1
  }

  return age
}

export function validateDriverAgeRequirement({ customerBirth, deliveryDateTime, requiredDriverAge } = {}) {
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

export function validateReservationForm(form = {}, options = {}) {
  const normalized = normalizeReservationForm(form)
  const errors = {}

  if (!normalized.customerName) {
    errors.customerName = '이름을 입력해 주세요.'
  } else {
    const nameValidation = validatePersonName(normalized.customerName)
    if (!nameValidation.isValid) {
      errors.customerName = nameValidation.message
    }
  }

  const phoneValidation = validateMobilePhoneNumber(normalized.customerPhone)
  if (!phoneValidation.isValid) {
    errors.customerPhone = phoneValidation.message
  }

  const birthValidation = validateBirthDate(normalized.customerBirth)
  if (!birthValidation.isValid) {
    errors.customerBirth = birthValidation.message
  } else {
    const ageValidation = validateDriverAgeRequirement({
      customerBirth: normalized.customerBirth,
      deliveryDateTime: options.deliveryDateTime,
      requiredDriverAge: options.requiredDriverAge,
    })
    if (!ageValidation.isValid) {
      errors.customerBirth = ageValidation.message
    }
  }

  return {
    normalized,
    errors,
    isValid: Object.keys(errors).length === 0,
  }
}
