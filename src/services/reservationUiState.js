export const DEFAULT_TERMS_STATE = {
  allAgreed: false,
  serviceAgreed: false,
  privacyAgreed: false,
  rentalPolicyAgreed: false,
}

export const PAYMENT_METHODS = {
  CARD: 'card',
  KAKAO_PAY: 'kakaoPay',
  GENERAL: 'general',
}

export function toggleAllTerms(checked) {
  return {
    allAgreed: checked,
    serviceAgreed: checked,
    privacyAgreed: checked,
    rentalPolicyAgreed: checked,
  }
}

export function toggleSingleTerm(termsState, field, checked) {
  const nextState = {
    ...termsState,
    [field]: checked,
  }

  return {
    ...nextState,
    allAgreed: Boolean(
      nextState.serviceAgreed &&
      nextState.privacyAgreed &&
      nextState.rentalPolicyAgreed
    ),
  }
}

export function validateTermsState(termsState = DEFAULT_TERMS_STATE) {
  const errors = {}

  if (!termsState.serviceAgreed) {
    errors.serviceAgreed = '서비스 이용약관 동의가 필요합니다.'
  }

  if (!termsState.privacyAgreed) {
    errors.privacyAgreed = '개인정보 수집 및 이용 동의가 필요합니다.'
  }

  if (!termsState.rentalPolicyAgreed) {
    errors.rentalPolicyAgreed = '렌터카 이용약관 동의가 필요합니다.'
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  }
}

export function validateReservationSubmission({
  reservationValidation,
  termsValidation,
  paymentMethod,
}) {
  const errors = {}

  if (!reservationValidation?.isValid) {
    errors.form = '예약자 정보를 확인해 주세요.'
  }

  if (!termsValidation?.isValid) {
    errors.terms = '필수 약관 동의가 필요합니다.'
  }

  if (!paymentMethod) {
    errors.paymentMethod = '결제 방식을 선택해 주세요.'
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  }
}
