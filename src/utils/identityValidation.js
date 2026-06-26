import { normalizePhoneNumber } from './phone'

const NAME_ALLOWED_PATTERN = /^[A-Za-z가-힣]+(?: [A-Za-z가-힣]+)*$/
const MIN_BIRTH_DATE = '19000101'
const MIN_NAME_LENGTH = 2
const MAX_NAME_LENGTH = 40

export function normalizePersonName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function validatePersonName(value) {
  const name = normalizePersonName(value)

  if (!name) {
    return { isValid: false, message: '이름을 입력해 주세요.', normalized: name }
  }

  if (!NAME_ALLOWED_PATTERN.test(name) || name.endsWith('님')) {
    return { isValid: false, message: '이름 형식을 확인해 주세요.', normalized: name }
  }

  const lettersOnlyLength = name.replace(/ /g, '').length
  if (lettersOnlyLength < MIN_NAME_LENGTH || lettersOnlyLength > MAX_NAME_LENGTH) {
    return { isValid: false, message: '이름 형식을 확인해 주세요.', normalized: name }
  }

  return { isValid: true, message: '', normalized: name }
}

export function normalizeBirthDate(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 8)
}

export function validateBirthDate(value, now = new Date()) {
  const birthDate = normalizeBirthDate(value)

  if (!/^\d{8}$/.test(birthDate)) {
    return { isValid: false, message: '생년월일 8자리를 입력해 주세요.', normalized: birthDate }
  }

  if (birthDate < MIN_BIRTH_DATE) {
    return { isValid: false, message: '생년월일 형식을 확인해 주세요.', normalized: birthDate }
  }

  const year = Number(birthDate.slice(0, 4))
  const month = Number(birthDate.slice(4, 6))
  const day = Number(birthDate.slice(6, 8))
  const date = new Date(year, month - 1, day)

  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return { isValid: false, message: '생년월일 형식을 확인해 주세요.', normalized: birthDate }
  }

  const today = new Date(now)
  today.setHours(23, 59, 59, 999)
  if (date.getTime() > today.getTime()) {
    return { isValid: false, message: '생년월일 형식을 확인해 주세요.', normalized: birthDate }
  }

  return { isValid: true, message: '', normalized: birthDate }
}

export function validateMobilePhoneNumber(value) {
  const phone = normalizePhoneNumber(value)
  if (!/^01\d{8,9}$/.test(phone)) {
    return { isValid: false, message: '휴대폰 번호를 확인해 주세요.', normalized: phone }
  }

  return { isValid: true, message: '', normalized: phone }
}
