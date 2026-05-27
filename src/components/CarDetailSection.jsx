import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { parseSearchQuery, validateSearchState } from '../utils/searchQuery'
import { fetchCarDetail } from '../services/carDetail'
import { parseApiResponse } from '../utils/apiResponse'
import {
  DEFAULT_RESERVATION_FORM,
  normalizeBirth,
  normalizePhone,
  validateReservationForm,
} from '../services/reservationForm'
import {
  DEFAULT_TERMS_STATE,
  PAYMENT_METHODS,
  toggleAllTerms,
  toggleSingleTerm,
  validateReservationSubmission,
  validateTermsState,
} from '../services/reservationUiState'
import { prepareGuestBookingPayment } from '../services/guestBookingApi'
import { useAuth } from '../hooks/useAuth'
import termsContent from '../../docs/legal/service-terms.md?raw'
import privacyContent from '../../docs/legal/privacy-policy.md?raw'
import rentalTermsContent from '../../docs/legal/rental-terms.md?raw'

const TERMS_MODAL_CONTENT = {
  service: {
    title: '서비스 이용약관',
    content: termsContent,
  },
  rental: {
    title: '렌터카 이용약관',
    content: rentalTermsContent,
  },
  privacy: {
    title: '개인정보 수집 및 이용 동의',
    content: privacyContent,
  },
}

function buildReservationOtpContextInput({ carId, detailToken, parsedSearchState, pricing, customerPhone }) {
  return {
    phone: customerPhone,
    carId: Number(carId || 0),
    detailToken,
    deliveryDateTime: parsedSearchState.deliveryDateTime,
    returnDateTime: parsedSearchState.returnDateTime,
    pickupOption: parsedSearchState.pickupOption,
    quotedTotalAmount: pricing?.raw?.finalPrice || 0,
    finalAmount: pricing?.raw?.finalPrice || 0,
  }
}

function submitExternalPaymentForm(actionUrl, fields = {}) {
  if (!actionUrl) {
    throw new Error('결제창 주소를 확인하지 못했습니다.')
  }

  const requestedEncoding = String(fields.encoding_trans || '').trim().toUpperCase()
  const normalizedActionUrl = requestedEncoding === 'UTF-8' && !actionUrl.includes('/jsp/encodingFilter/encodingFilter.jsp')
    ? `${actionUrl.substring(0, actionUrl.lastIndexOf('/'))}/jsp/encodingFilter/encodingFilter.jsp`
    : actionUrl

  const form = document.createElement('form')
  form.method = 'POST'
  form.action = normalizedActionUrl
  form.acceptCharset = requestedEncoding === 'UTF-8' ? 'utf-8' : 'euc-kr'
  form.style.display = 'none'

  Object.entries(fields || {}).forEach(([key, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = key
    input.value = value == null ? '' : String(value)
    form.appendChild(input)
  })

  document.body.appendChild(form)
  form.submit()
}

function resolvePaymentChannel() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'mobile_web'
  }

  const userAgent = String(navigator.userAgent || '')
  const touchPoints = Number(navigator.maxTouchPoints || 0)
  const isTablet = /iPad|Tablet|Nexus 7|Nexus 10|SM-T|Tab/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && touchPoints > 1)
  const isMobile = /Mobi|Android|iPhone|iPod|IEMobile|Windows Phone/i.test(userAgent)
  const isTouchDesktopLike = window.innerWidth <= 1180 && touchPoints > 1

  return (isTablet || isMobile || isTouchDesktopLike) ? 'mobile_web' : 'pc_web'
}

let kcpPcScriptPromise = null

function getKcpPcRuntimeConfig(scriptUrl) {
  const isTest = String(scriptUrl || '').includes('testpay.kcp.co.kr')
  const baseUrl = isTest ? 'https://testspay.kcp.co.kr/' : 'https://spay.kcp.co.kr/'
  const version = `oc_${Date.now()}`

  return {
    baseUrl,
    version,
    scripts: [
      `${baseUrl}js/kcp_jquery-1.8.0.js?ver=${version}`,
      `${baseUrl}plugin/kcp_spay_cross_hub.js?ver=${version}`,
      `${baseUrl}js/kcp_jquery.blockUI.js?ver=${version}`,
      `${baseUrl}js/ClientDataHandler.js?ver=${version}`,
      `${baseUrl}js/npayUtils.js?ver=${version}`,
    ],
  }
}

function loadScriptSequentially(url) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-kcp-src="${url}"]`)
    if (existing?.dataset.loaded === 'true') {
      resolve()
      return
    }

    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`KCP 스크립트를 불러오지 못했습니다: ${url}`)), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = url
    script.async = false
    script.charset = 'euc-kr'
    script.dataset.kcpSrc = url
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => reject(new Error(`KCP 스크립트를 불러오지 못했습니다: ${url}`))
    document.body.appendChild(script)
  })
}

function loadKcpPcScript(scriptUrl) {
  if (!scriptUrl) {
    return Promise.reject(new Error('PC 결제 스크립트 주소를 확인하지 못했습니다.'))
  }

  if (typeof window === 'undefined') {
    return Promise.reject(new Error('브라우저 환경을 확인하지 못했습니다.'))
  }

  const isKcpPcReady = () => (
    typeof window.KCP_Pay_Execute === 'function'
    && typeof window.KCP_Pay_Execute_Web === 'function'
  )

  if (isKcpPcReady()) {
    return Promise.resolve(window.KCP_Pay_Execute)
  }

  if (!kcpPcScriptPromise) {
    kcpPcScriptPromise = (async () => {
      const runtime = getKcpPcRuntimeConfig(scriptUrl)
      window.KCP_NPAY_DOMAIN = runtime.baseUrl
      window.KCP_SPAY_DOMAIN = runtime.baseUrl
      window.KCP_NPAY_Script_VERSION = runtime.version

      for (const url of runtime.scripts) {
        await loadScriptSequentially(url)
      }

      if (typeof window.KCP_Pay_Execute !== 'function' && typeof window.KCP_Pay_Execute_Web === 'function') {
        window.KCP_Pay_Execute = (form) => window.KCP_Pay_Execute_Web(form)
      }

      if (!isKcpPcReady()) {
        throw new Error('KCP PC 결제 스크립트 초기화가 완료되지 않았습니다. 다시 시도해 주세요.')
      }

      return window.KCP_Pay_Execute
    })().catch((error) => {
      kcpPcScriptPromise = null
      throw error
    })
  }

  return kcpPcScriptPromise
}

async function openKcpPcPayment({ actionUrl, scriptUrl, fields = {}, onError } = {}) {
  await loadKcpPcScript(scriptUrl)

  const form = document.createElement('form')
  form.name = 'kcp_order_info'
  form.method = 'POST'
  form.action = actionUrl
  form.acceptCharset = 'euc-kr'
  form.style.display = 'none'

  Object.entries(fields || {}).forEach(([key, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = key
    input.value = value == null ? '' : String(value)
    form.appendChild(input)
  })

  document.body.appendChild(form)

  const cleanup = () => {
    if (window.__kcpPcCompletePayment === completeHandler) {
      delete window.__kcpPcCompletePayment
    }
    if (window.m_Completepayment === completeHandler) {
      delete window.m_Completepayment
    }
    form.remove()
  }

  const completeHandler = (formOrJson, closeEvent) => {
    try {
      if (typeof window.GetField === 'function') {
        window.GetField(form, formOrJson)
      }

      const resultCode = form.querySelector('input[name="res_cd"]')?.value || ''
      const resultMessage = form.querySelector('input[name="res_msg"]')?.value || ''

      if (resultCode === '0000') {
        form.submit()
        return
      }

      if (typeof closeEvent === 'function') {
        closeEvent()
      }
      cleanup()
      onError?.(new Error(resultMessage || '결제가 취소되었거나 인증에 실패했습니다.'))
    } catch (error) {
      if (typeof closeEvent === 'function') {
        closeEvent()
      }
      cleanup()
      onError?.(error instanceof Error ? error : new Error('PC 결제창 처리에 실패했습니다.'))
    }
  }

  window.__kcpPcCompletePayment = completeHandler
  window.m_Completepayment = completeHandler

  try {
    window.KCP_Pay_Execute(form)
  } catch (error) {
    cleanup()
    throw error instanceof Error ? error : new Error('PC 결제창 실행에 실패했습니다.')
  }
}

function formatDisplay(dateText) {
  const [datePart = '', timePart = ''] = dateText.split(' ')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour = '00', minute = '00'] = timePart.split(':')
  const d = new Date(year, (month || 1) - 1, day || 1)
  const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] || ''
  return `${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}(${week}) ${hour}:${minute}`
}

function ContextErrorState({ title, message }) {
  return (
    <article className="detail-card panel">
      <h2>{title}</h2>
      <p className="muted small-note">{message}</p>
      <Link to="/" className="btn btn-outline btn-md" style={{ display: 'inline-flex', marginTop: 12 }}>메인으로 돌아가기</Link>
    </article>
  )
}

function LoadingState() {
  return (
    <article className="detail-card panel">
      <h2>상세 정보 불러오는 중</h2>
      <p className="muted small-note">상세 데이터를 불러오는 중입니다.</p>
    </article>
  )
}

function TermsCheckRow({ checked, onChange, label, onOpen }) {
  return (
    <div className="detail-terms-row">
      <label className="detail-terms-check">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>{label}</span>
      </label>
      <button type="button" className="btn btn-outline btn-sm" onClick={onOpen}>보기</button>
    </div>
  )
}

const ERROR_NOTE_STYLE = { margin: 0, color: '#be123c' }

const INSURANCE_SUMMARY_ITEMS = [
  { label: '대인 보상한도', value: '무한' },
  { label: '대인 면책금', value: '50만원' },
  { label: '대물 보상한도', value: '2,000만원' },
  { label: '대물 면책금', value: '50만원' },
  { label: '자손 보상한도', value: '1,500만원' },
  { label: '자손 면책금', value: '50만원' },
  { label: '휴차료', value: '1일 대여요금의 50%' },
  { label: '자차면책금', value: '50만~100만' },
]

const SELF_DAMAGE_POLICY = [
  '승용 경,소형: 400만원 / 면책금 50만원',
  '승용 준중형,중형: 700만원 / 면책금 50만원',
  '승용 준대형,대형: 1,000만원 / 면책금 50만원',
  '프리미엄: 2,000만원 / 면책금 50만원',
  'SUV 소형: 500만원 / 면책금 50만원',
  'SUV 중형: 700만원 / 면책금 50만원',
  'SUV 대형: 1,000만원 / 면책금 50만원',
  '승합: 1,000만원 / 면책금 50만원',
  '수입, 슈퍼카: 2,000만원 / 면책금 100만원',
  '캠핑카: 500만원 / 면책금 50만원',
]

const INSURANCE_NOTES = [
  '전 차량 기본보험 및 자차가 자동 포함됩니다.',
  '단독사고는 보장되며, 사고 발생 즉시 회사에 연락해 사고 경위가 확인되어야 합니다.',
  '휠, 타이어 및 소모품은 보장 대상에서 제외됩니다.',
  '사고 시 차량 회수가 진행될 수 있으며, 대차가 제공되는 경우 대차비용이 발생할 수 있습니다.',
  '임의수리 및 임의합의는 금지되며, 회사가 지정한 곳 외에서 진행한 수리는 인정되지 않을 수 있습니다.',
]

const INSURANCE_LIMITATIONS = [
  '음주운전, 무면허운전, 약물운전',
  '등록되지 않은 운전자의 운행',
  '사고 미신고 또는 지연신고, 사고 후 현장 이탈',
  '고의 또는 중대한 과실',
  '차량 도난 시 키 관리 소홀 또는 문 미잠금 등 이용자 과실',
  '침수지역 진입, 무리한 수로 통과, 위험지역 주차 등 통상적 운행 범위를 벗어난 경우',
  '차량 전대, 재임대, 영업 목적 무단 사용',
  '경기, 시험, 연습주행 등 일반 대여 목적 외 사용',
]

export default function CarDetailSection() {
  const { carId } = useParams()
  const location = useLocation()
  const { session, isAuthenticated, profile, loading: authLoading } = useAuth()
  const parsedSearchState = useMemo(() => parseSearchQuery(location.search), [location.search])
  const detailToken = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('detailToken') || ''
  }, [location.search])
  const validation = useMemo(() => validateSearchState(parsedSearchState), [parsedSearchState])
  const hasSearchContext = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.has('deliveryDateTime') && params.has('returnDateTime')
  }, [location.search])
  const fixedSearchInfo = useMemo(
    () => ({
      deliveryDateTime: parsedSearchState.deliveryDateTime,
      returnDateTime: parsedSearchState.returnDateTime,
      driverAge: parsedSearchState.driverAge,
    }),
    [parsedSearchState.deliveryDateTime, parsedSearchState.returnDateTime, parsedSearchState.driverAge],
  )

  const [car, setCar] = useState(null)
  const [pricing, setPricing] = useState(null)
  const [insurance, setInsurance] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [reservationForm, setReservationForm] = useState(DEFAULT_RESERVATION_FORM)
  const [termsState, setTermsState] = useState(DEFAULT_TERMS_STATE)
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS.CARD)
  const [deliveryAddressDetail, setDeliveryAddressDetail] = useState(parsedSearchState.deliveryAddressDetail || '')
  const [deliveryAddressDetailError, setDeliveryAddressDetailError] = useState('')
  const [isInsuranceExpanded, setIsInsuranceExpanded] = useState(false)
  const [hasReservationSubmitAttempted, setHasReservationSubmitAttempted] = useState(false)
  const [isReservationConfirmOpen, setIsReservationConfirmOpen] = useState(false)
  const [reservationSubmitError, setReservationSubmitError] = useState('')
  const [isCreatingReservation, setIsCreatingReservation] = useState(false)
  const [activeTermsModal, setActiveTermsModal] = useState('')
  const [isDriverFormLocked, setIsDriverFormLocked] = useState(true)
  const [driverFormLockReason, setDriverFormLockReason] = useState('auth_pending')
  const [reservationOtpCode, setReservationOtpCode] = useState('')
  const [reservationVerificationId, setReservationVerificationId] = useState('')
  const [reservationVerificationToken, setReservationVerificationToken] = useState('')
  const [reservationVerifiedContextKey, setReservationVerifiedContextKey] = useState('')
  const [reservationOtpMessage, setReservationOtpMessage] = useState('전화번호 인증을 완료해 주세요.')
  const [reservationOtpExpiresAt, setReservationOtpExpiresAt] = useState(null)
  const [reservationOtpCooldownUntil, setReservationOtpCooldownUntil] = useState(null)
  const [reservationOtpNowMs, setReservationOtpNowMs] = useState(Date.now())
  const [isReservationOtpRequesting, setIsReservationOtpRequesting] = useState(false)
  const [isReservationOtpVerifying, setIsReservationOtpVerifying] = useState(false)
  const paymentSummaryRef = useRef(null)
  const summaryCardRef = useRef(null)
  const appliedProfilePrefillKeyRef = useRef('')
  useEffect(() => {
    setDeliveryAddressDetail(parsedSearchState.deliveryAddressDetail || '')
    setDeliveryAddressDetailError('')
  }, [parsedSearchState.deliveryAddressDetail])

  useEffect(() => {
    if (authLoading) return

    if (isAuthenticated) {
      setIsDriverFormLocked(true)
      setDriverFormLockReason('member_profile')
      return
    }

    setIsDriverFormLocked(false)
    setDriverFormLockReason('')
  }, [authLoading, isAuthenticated])

  useEffect(() => {
    if (!car || !pricing || !insurance || isLoading || fetchError) return undefined

    const frameId = window.requestAnimationFrame(() => {
      const element = summaryCardRef.current
      if (!element) return

      const headerOffset = 108
      const top = element.getBoundingClientRect().top + window.scrollY - headerOffset
      window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'auto' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [carId, car, pricing, insurance, isLoading, fetchError])

  useEffect(() => {
    if (!activeTermsModal) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [activeTermsModal])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setReservationOtpNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (authLoading || !isAuthenticated || !profile?.id || driverFormLockReason !== 'member_profile') return

    const prefillKey = `${profile.id}:${profile.updatedAt || ''}`
    if (appliedProfilePrefillKeyRef.current === prefillKey) return

    appliedProfilePrefillKeyRef.current = prefillKey

    setReservationForm({
      customerName: String(profile.name || ''),
      customerPhone: normalizePhone(String(profile.phone || '')),
      customerBirth: normalizeBirth(String(profile.birthDate || '')),
    })
  }, [authLoading, driverFormLockReason, isAuthenticated, profile])

  const reservationValidation = useMemo(
    () => validateReservationForm(reservationForm, {
      deliveryDateTime: parsedSearchState.deliveryDateTime,
      requiredDriverAge: parsedSearchState.driverAge,
    }),
    [parsedSearchState.deliveryDateTime, parsedSearchState.driverAge, reservationForm],
  )
  const reservationOtpContext = useMemo(
    () => buildReservationOtpContextInput({
      carId: car?.id,
      detailToken,
      parsedSearchState,
      pricing,
      customerPhone: reservationValidation.normalized.customerPhone,
    }),
    [car?.id, detailToken, parsedSearchState, pricing, reservationValidation.normalized.customerPhone],
  )
  const reservationOtpContextKey = useMemo(
    () => JSON.stringify(reservationOtpContext),
    [reservationOtpContext],
  )
  const termsValidation = useMemo(() => validateTermsState(termsState), [termsState])
  const submitValidation = useMemo(
    () => validateReservationSubmission({ reservationValidation, termsValidation, paymentMethod }),
    [reservationValidation, termsValidation, paymentMethod],
  )
  const reservationOtpSecondsLeft = reservationOtpExpiresAt
    ? Math.max(0, Math.ceil((reservationOtpExpiresAt - reservationOtpNowMs) / 1000))
    : 0
  const reservationOtpCooldownLeft = reservationOtpCooldownUntil
    ? Math.max(0, Math.ceil((reservationOtpCooldownUntil - reservationOtpNowMs) / 1000))
    : 0
  const hasActiveReservationVerification = Boolean(
    reservationVerificationId
    && reservationVerificationToken
    && reservationVerifiedContextKey
    && reservationVerifiedContextKey === reservationOtpContextKey,
  )
  const reservationAuthMode = useMemo(() => {
    if (isAuthenticated && isDriverFormLocked && driverFormLockReason === 'member_profile') return 'member_profile_locked'
    if (isDriverFormLocked && driverFormLockReason === 'verified') return 'verified_locked'
    if (isAuthenticated) return 'member_editable'
    return 'guest_editable'
  }, [driverFormLockReason, isAuthenticated, isDriverFormLocked])

  const isDeliveryAddressDetailValid = parsedSearchState.pickupOption !== 'delivery' || Boolean(deliveryAddressDetail.trim())
  const isReservationActionEnabled = submitValidation.isValid && isDeliveryAddressDetailValid
  const shouldShowReservationErrors = hasReservationSubmitAttempted
  const reservationSubmitMessages = useMemo(() => {
    const messages = []

    if (!reservationValidation.isValid) {
      messages.push(...Object.values(reservationValidation.errors))
    }

    if (!termsValidation.isValid) {
      messages.push(...Object.values(termsValidation.errors))
    }

    if (!paymentMethod) {
      messages.push('결제 방식을 선택해 주세요.')
    }

    if (parsedSearchState.pickupOption === 'delivery' && !deliveryAddressDetail.trim()) {
      messages.push('상세주소를 입력해 주세요.')
    }

    return [...new Set(messages.filter(Boolean))]
  }, [deliveryAddressDetail, parsedSearchState.pickupOption, paymentMethod, reservationValidation.errors, reservationValidation.isValid, termsValidation.errors, termsValidation.isValid])

  useEffect(() => {
    let isCancelled = false

    if (!carId || !hasSearchContext || !validation.isValid) {
      setCar(null)
      setPricing(null)
      setInsurance(null)
      setFetchError('')
      setIsLoading(false)
      return () => {
        isCancelled = true
      }
    }

    setIsLoading(true)
    setFetchError('')

    fetchCarDetail(carId, parsedSearchState, detailToken)
      .then((payload) => {
        if (isCancelled) return
        setCar(payload.car)
        setPricing(payload.pricing)
        setInsurance(payload.insurance)
      })
      .catch((error) => {
        if (isCancelled) return
        setCar(null)
        setPricing(null)
        setInsurance(null)
        setFetchError(error.message || '상세 조회에 실패했습니다.')
      })
      .finally(() => {
        if (isCancelled) return
        setIsLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [carId, detailToken, hasSearchContext, validation, parsedSearchState])

  useEffect(() => {
    if (!reservationVerifiedContextKey) return
    if (reservationVerifiedContextKey === reservationOtpContextKey) return

    setReservationVerificationId('')
    setReservationVerificationToken('')
    setReservationVerifiedContextKey('')
    setReservationOtpCode('')
    setReservationOtpMessage('입력값이 변경되어 전화번호 인증이 초기화되었습니다. 다시 인증해 주세요.')

    if (driverFormLockReason === 'verified') {
      setIsDriverFormLocked(false)
      setDriverFormLockReason('')
    }
  }, [driverFormLockReason, reservationOtpContextKey, reservationVerifiedContextKey])

  const resetReservationOtpState = (message = '전화번호 인증을 완료해 주세요.') => {
    setReservationVerificationId('')
    setReservationVerificationToken('')
    setReservationVerifiedContextKey('')
    setReservationOtpCode('')
    setReservationOtpExpiresAt(null)
    setReservationOtpCooldownUntil(null)
    setReservationOtpMessage(message)
  }

  const updateReservationForm = (field, value) => {
    if (isDriverFormLocked) return

    if (hasActiveReservationVerification) {
      resetReservationOtpState('입력값이 변경되어 전화번호 인증이 초기화되었습니다. 다시 인증해 주세요.')
    }

    setReservationForm((current) => {
      if (field === 'customerPhone') {
        return { ...current, customerPhone: normalizePhone(value) }
      }

      if (field === 'customerBirth') {
        return { ...current, customerBirth: normalizeBirth(value) }
      }

      return { ...current, [field]: value }
    })
  }

  const handleDeliveryAddressDetailChange = (value) => {
    setDeliveryAddressDetail(value)
    setDeliveryAddressDetailError('')
  }

  const handleReservationOtpRequest = async () => {
    if (isDriverFormLocked) return

    if (!reservationValidation.isValid) {
      setHasReservationSubmitAttempted(true)
      setReservationOtpMessage(Object.values(reservationValidation.errors)[0] || '예약자 정보를 먼저 확인해 주세요.')
      return
    }

    setIsReservationOtpRequesting(true)
    setReservationSubmitError('')

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: reservationValidation.normalized.customerPhone,
          purpose: 'guest_booking',
          context: reservationOtpContext,
        }),
      })

      const result = await parseApiResponse(response, '인증번호 발송에 실패했습니다.')
      setReservationVerificationId(result.verificationId || '')
      setReservationVerificationToken('')
      setReservationVerifiedContextKey('')
      setReservationOtpCode('')
      setReservationOtpExpiresAt(Date.now() + Number(result.expiresInSeconds || 180) * 1000)
      setReservationOtpCooldownUntil(Date.now() + Number(result.cooldownSeconds || 60) * 1000)
      setReservationOtpMessage(result.message || '인증번호를 발송했습니다.')
    } catch (error) {
      setReservationOtpMessage(error.message || '인증번호 발송에 실패했습니다.')
    } finally {
      setIsReservationOtpRequesting(false)
    }
  }

  const handleReservationOtpVerify = async () => {
    if (!reservationVerificationId) {
      setReservationOtpMessage('먼저 인증번호를 요청해 주세요.')
      return
    }

    if (reservationOtpCode.length !== 6) {
      setReservationOtpMessage('인증번호 6자리를 입력해 주세요.')
      return
    }

    setIsReservationOtpVerifying(true)
    setReservationSubmitError('')

    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verificationId: reservationVerificationId,
          phone: reservationValidation.normalized.customerPhone,
          code: reservationOtpCode,
          purpose: 'guest_booking',
        }),
      })

      const result = await parseApiResponse(response, '휴대폰 인증에 실패했습니다.')
      setReservationVerificationToken(result.verificationToken || '')
      setReservationVerifiedContextKey(reservationOtpContextKey)
      setReservationOtpMessage(result.message || '휴대폰 인증이 완료되었습니다.')
      setIsDriverFormLocked(true)
      setDriverFormLockReason('verified')
    } catch (error) {
      setReservationVerificationToken('')
      setReservationVerifiedContextKey('')
      setReservationOtpMessage(error.message || '휴대폰 인증에 실패했습니다.')
    } finally {
      setIsReservationOtpVerifying(false)
    }
  }

  const handleToggleAllTerms = (checked) => {
    setTermsState(toggleAllTerms(checked))
  }

  const handleToggleSingleTerm = (field, checked) => {
    setTermsState((current) => toggleSingleTerm(current, field, checked))
  }

  const handleReservationSubmit = () => {
    setHasReservationSubmitAttempted(true)
    setReservationSubmitError('')

    if (authLoading) {
      setReservationSubmitError('로그인 상태를 확인하는 중입니다. 잠시 후 다시 시도해 주세요.')
      requestAnimationFrame(() => {
        paymentSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }

    if (parsedSearchState.pickupOption === 'delivery' && !deliveryAddressDetail.trim()) {
      setDeliveryAddressDetailError('상세주소를 입력해 주세요.')
    }

    if (!car || !pricing || !isReservationActionEnabled) {
      requestAnimationFrame(() => {
        paymentSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }

    if (!isDriverFormLocked || (reservationAuthMode !== 'member_profile_locked' && !hasActiveReservationVerification)) {
      setReservationSubmitError('전화번호 인증을 완료해 주세요.')
      requestAnimationFrame(() => {
        paymentSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }

    setIsReservationConfirmOpen(true)
  }

  const handleConfirmReservation = async () => {
    if (!car || !pricing || !isReservationActionEnabled) {
      return
    }

    try {
      setIsCreatingReservation(true)
      setReservationSubmitError('')

      const result = await prepareGuestBookingPayment({
        carId: Number(car.id),
        deliveryDateTime: parsedSearchState.deliveryDateTime,
        returnDateTime: parsedSearchState.returnDateTime,
        pickupOption: parsedSearchState.pickupOption,
        driverAge: parsedSearchState.driverAge,
        order: parsedSearchState.order,
        dongId: parsedSearchState.dongId,
        deliveryAddress: parsedSearchState.deliveryAddress || '',
        deliveryAddressDetail: deliveryAddressDetail.trim(),
        quotedTotalAmount: pricing.raw?.finalPrice || 0,
        rentalAmount: pricing.raw?.rentalCost || 0,
        insuranceAmount: pricing.raw?.insurancePrice || 0,
        deliveryAmount: pricing.raw?.deliveryPrice || 0,
        finalAmount: pricing.raw?.finalPrice || 0,
        paymentMethod,
        detailToken,
        customerName: reservationValidation.normalized.customerName,
        customerPhone: reservationValidation.normalized.customerPhone,
        customerBirth: reservationValidation.normalized.customerBirth,
        phoneVerificationId: reservationVerificationId,
        phoneVerificationToken: reservationVerificationToken,
        reservationAuthMode,
        paymentChannel: resolvePaymentChannel(),
      }, {
        session,
      })

      if (!result?.actionUrl) {
        throw new Error('결제창 주소를 확인하지 못했습니다.')
      }

      setIsReservationConfirmOpen(false)

      if (result.paymentFlow === 'kcp_pc_standard') {
        await openKcpPcPayment({
          actionUrl: result.actionUrl,
          scriptUrl: result.scriptUrl,
          fields: result.formFields || {},
          onError: (error) => {
            setReservationSubmitError(error.message || '결제가 취소되었거나 인증에 실패했습니다.')
          },
        })
        return
      }

      submitExternalPaymentForm(result.actionUrl, result.formFields || {})
    } catch (error) {
      setReservationSubmitError(error.message || '결제 준비에 실패했습니다.')
      setIsReservationConfirmOpen(false)
    } finally {
      setIsCreatingReservation(false)
    }
  }

  const reservationLocationText = parsedSearchState.pickupOption === 'delivery'
    ? (parsedSearchState.deliveryAddress || '배차 위치 확인 필요')
    : '회사 방문 수령'
  const activeTermsContent = activeTermsModal ? TERMS_MODAL_CONTENT[activeTermsModal] : null

  return (
    <section className="section-bg detail-page">
      <div className="container detail-layout">
        {!hasSearchContext && (
          <ContextErrorState
            title="검색 조건 확인 필요"
            message="상세 페이지는 검색 조건과 함께 진입해야 합니다. 메인에서 다시 검색해 주세요."
          />
        )}

        {hasSearchContext && !validation.isValid && (
          <ContextErrorState
            title="검색 조건 오류"
            message={Object.values(validation.errors)[0] || '검색 조건이 올바르지 않습니다. 메인에서 다시 검색해 주세요.'}
          />
        )}

        {hasSearchContext && validation.isValid && isLoading && <LoadingState />}

        {hasSearchContext && validation.isValid && !isLoading && fetchError && (
          <ContextErrorState
            title="상세 조회 실패"
            message={fetchError}
          />
        )}

        {hasSearchContext && validation.isValid && !isLoading && !fetchError && car && pricing && insurance && (
          <div className="detail-columns">
            <section className="detail-main">
              <article className="detail-card panel summary-card detail-hero-card" ref={summaryCardRef}>
                <div className="summary-image-wrap detail-hero-image">
                  {car.image ? <img src={car.image} alt={car.name} /> : <div className="pickup-location-readonly-box">이미지 준비중</div>}
                </div>
                <div className="detail-hero-body">
                  <div>
                    <span className="detail-hero-eyebrow">예약 가능 차량</span>
                    <h1>{car.name}</h1>
                    <div className="meta-row detail-hero-meta"><span>{car.yearLabel}</span><span>{car.fuelType}</span><span>{car.seats}</span></div>
                    {car.features.length > 0 && (
                      <div className="detail-hero-options" aria-label="차량 옵션">
                        {car.features.map((feature) => <span key={feature}>{feature}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="detail-hero-price">
                    <span>총 결제 금액</span>
                    <strong>{pricing.finalPrice}</strong>
                  </div>
                </div>
              </article>

              <article className="detail-card panel detail-reservation-card">
                <div className="detail-section-head">
                  <h2>예약 정보</h2>
                </div>
                <div className="info-grid three info-stat-grid reservation-info-grid detail-reservation-grid">
                  <div><span>대여</span><strong>{formatDisplay(fixedSearchInfo.deliveryDateTime)}</strong></div>
                  <div><span>반납</span><strong>{formatDisplay(fixedSearchInfo.returnDateTime)}</strong></div>
                  <div><span>배차 위치</span><strong>{reservationLocationText}</strong><small>{parsedSearchState.pickupOption === 'delivery' ? '검색에서 선택한 위치' : '회사 방문 수령'}</small></div>
                </div>
                {parsedSearchState.pickupOption === 'delivery' && (
                  <div className="reservation-detail-input-wrap detail-address-card">
                    <span className="field-label">상세주소</span>
                    <input
                      className="field-input"
                      placeholder="상세주소를 입력해 주세요."
                      value={deliveryAddressDetail}
                      onChange={(e) => handleDeliveryAddressDetailChange(e.target.value)}
                    />
                    {deliveryAddressDetailError && (
                      <p className="field-note" style={ERROR_NOTE_STYLE}>{deliveryAddressDetailError}</p>
                    )}
                    <p className="muted small-note">배차를 위해 동, 호수, 건물명 등 상세주소를 입력해 주세요.</p>
                  </div>
                )}
              </article>

              <article className={`detail-card panel driver-info-card detail-driver-card ${isDriverFormLocked ? 'is-locked' : 'is-editing'}`}>
                <div className="detail-section-head">
                  <h2>{isAuthenticated ? '회원 정보' : '예약자 정보'}</h2>
                </div>
                <div className={`stack-form stack-form-centered driver-info-form detail-driver-form ${isDriverFormLocked ? 'is-locked' : ''}`}>
                  <div>
                    <span className="field-label detail-input-label">이름</span>
                    <input
                      className="field-input driver-info-form__input"
                      placeholder="예: 홍길동"
                      value={reservationForm.customerName}
                      onChange={(e) => updateReservationForm('customerName', e.target.value)}
                      disabled={isDriverFormLocked}
                    />
                    {(shouldShowReservationErrors || reservationForm.customerName) && reservationValidation.errors.customerName && (
                      <p className="field-note" style={ERROR_NOTE_STYLE}>{reservationValidation.errors.customerName}</p>
                    )}
                  </div>
                  <div>
                    <span className="field-label detail-input-label">생년월일</span>
                    <input
                      className="field-input driver-info-form__input"
                      placeholder="예: 19900101"
                      inputMode="numeric"
                      value={reservationForm.customerBirth}
                      onChange={(e) => updateReservationForm('customerBirth', e.target.value)}
                      disabled={isDriverFormLocked}
                    />
                    {(shouldShowReservationErrors || reservationForm.customerBirth) && reservationValidation.errors.customerBirth && (
                      <p className="field-note" style={ERROR_NOTE_STYLE}>{reservationValidation.errors.customerBirth}</p>
                    )}
                  </div>
                </div>
                {!authLoading && !isDriverFormLocked && (
                  <div className="guest-lookup-card detail-phone-auth-card">
                    <div>
                      <label className="field-label">전화번호</label>
                      <input
                        className="field-input driver-info-form__input detail-otp-phone-input"
                        placeholder="예: 010-1234-5678"
                        inputMode="tel"
                        value={reservationForm.customerPhone}
                        onChange={(e) => updateReservationForm('customerPhone', e.target.value)}
                        disabled={isDriverFormLocked}
                      />
                      {(shouldShowReservationErrors || reservationForm.customerPhone) && reservationValidation.errors.customerPhone && (
                        <p className="field-note" style={ERROR_NOTE_STYLE}>{reservationValidation.errors.customerPhone}</p>
                      )}
                    </div>
                    <div className="detail-phone-auth-grid">
                      <input
                        className="field-input"
                        type="text"
                        inputMode="numeric"
                        placeholder="인증번호 6자리"
                        value={reservationOtpCode}
                        onChange={(event) => setReservationOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        disabled={isReservationOtpVerifying || !reservationVerificationId || hasActiveReservationVerification}
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-md"
                        onClick={handleReservationOtpRequest}
                        disabled={isReservationOtpRequesting || isReservationOtpVerifying || reservationOtpCooldownLeft > 0}
                      >
                        {isReservationOtpRequesting ? '발송 중...' : reservationOtpCooldownLeft > 0 ? `재전송 ${reservationOtpCooldownLeft}s` : '인증번호 발송'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-dark btn-md"
                        onClick={handleReservationOtpVerify}
                        disabled={isReservationOtpVerifying || !reservationVerificationId || reservationOtpCode.length !== 6 || hasActiveReservationVerification}
                      >
                        {hasActiveReservationVerification ? '인증완료' : isReservationOtpVerifying ? '확인 중...' : '확인'}
                      </button>
                    </div>
                    {reservationVerificationId || hasActiveReservationVerification ? (
                      <p className="field-note" style={{ margin: 0, color: hasActiveReservationVerification ? '#166534' : '#6b7280' }}>
                        {hasActiveReservationVerification
                          ? '휴대폰 인증이 완료되었습니다.'
                          : `남은 시간 ${String(Math.floor(reservationOtpSecondsLeft / 60)).padStart(2, '0')}:${String(reservationOtpSecondsLeft % 60).padStart(2, '0')}`}
                      </p>
                    ) : null}
                    {reservationOtpMessage ? <p className="field-note" style={{ margin: 0, color: hasActiveReservationVerification ? '#166534' : '#be123c' }}>{reservationOtpMessage}</p> : null}
                  </div>
                )}
              </article>

              <article className="detail-card panel detail-terms-card">
                <div className="detail-section-head">
                  <h2>이용 약관 동의</h2>
                </div>
                <div className="signup-terms-box detail-terms-box">
                  <label className="signup-terms-row signup-terms-row-all detail-terms-row detail-terms-row-all">
                    <span className="detail-terms-check">
                      <input type="checkbox" checked={termsState.allAgreed} onChange={(e) => handleToggleAllTerms(e.target.checked)} />
                      <span>전체 동의</span>
                    </span>
                  </label>
                  <div className="terms-list">
                    <TermsCheckRow checked={termsState.serviceAgreed} onChange={(checked) => handleToggleSingleTerm('serviceAgreed', checked)} label="서비스 이용약관" onOpen={() => setActiveTermsModal('service')} />
                    <TermsCheckRow checked={termsState.rentalPolicyAgreed} onChange={(checked) => handleToggleSingleTerm('rentalPolicyAgreed', checked)} label="렌터카 이용약관" onOpen={() => setActiveTermsModal('rental')} />
                    <TermsCheckRow checked={termsState.privacyAgreed} onChange={(checked) => handleToggleSingleTerm('privacyAgreed', checked)} label="개인정보 수집 및 이용 동의" onOpen={() => setActiveTermsModal('privacy')} />
                  </div>
                  {!termsValidation.isValid && (
                    <p className="signup-terms-note detail-terms-note" style={ERROR_NOTE_STYLE}>{Object.values(termsValidation.errors)[0]}</p>
                  )}
                </div>
                <div className="legal-note">
                  빵빵카 주식회사는 본 렌터카 계약 서비스를 직접 제공합니다. 결제가 정상적으로 완료된 예약에 한해 예약이 확정되며, 운전자 자격 미충족, 본인 확인 실패, 면허 확인 실패, 결제 확인 실패, 차량 상태 이상, 회사 사정으로 인한 배차 불가 등 회사가 고지한 사유가 있으면 예약이 거절되거나 취소될 수 있습니다.
                </div>
              </article>

              <article className="detail-card panel payment-summary-card detail-payment-card" ref={paymentSummaryRef}>
                <div className="detail-section-head">
                  <h2>결제 정보</h2>
                </div>
                <div className="price-lines">
                  <div className="total"><span>총 결제 금액</span><strong>{pricing.finalPrice}</strong></div>
                </div>
                {shouldShowReservationErrors && reservationSubmitMessages.length > 0 && (
                  <div className="legal-note" style={{ marginTop: 0, background: '#fff4f4', color: '#9f1239' }}>
                    <strong style={{ display: 'block', marginBottom: 8 }}>아래 항목 확인 후 결제를 진행해 주세요.</strong>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {reservationSubmitMessages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {reservationSubmitError && (
                  <div className="legal-note" style={{ marginTop: 0, background: '#fff4f4', color: '#9f1239' }}>{reservationSubmitError}</div>
                )}
                <button className="btn btn-dark btn-lg btn-block" onClick={handleReservationSubmit}>결제하기</button>
              </article>

              <article className="detail-card panel detail-insurance-card">
                <div className="detail-section-head">
                  <h2>보험/유의사항</h2>
                </div>
                <div className="info-grid two info-stat-grid insurance-summary-grid">
                  {INSURANCE_SUMMARY_ITEMS.map((item) => (
                    <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>
                  ))}
                </div>
                <button
                  className="btn btn-outline btn-md insurance-toggle-btn"
                  onClick={() => setIsInsuranceExpanded((current) => !current)}
                >
                  {isInsuranceExpanded ? '상세내용 접기' : '보험/유의사항 상세보기'}
                </button>
                {isInsuranceExpanded && (
                  <>
                    <div className="insurance-policy-block">
                      <h3>차종별 자차 보상한도 / 자차면책금</h3>
                      <ul className="policy-bullet-list">
                        {SELF_DAMAGE_POLICY.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="insurance-policy-block">
                      <h3>보험 유의사항</h3>
                      <ul className="policy-bullet-list">
                        {INSURANCE_NOTES.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="insurance-policy-block">
                      <h3>면책 제한 사유</h3>
                      <ul className="policy-bullet-list">
                        {INSURANCE_LIMITATIONS.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </article>
            </section>
          </div>
        )}
        {isReservationConfirmOpen && car && pricing && (
          <div className="delivery-modal-backdrop" onClick={() => setIsReservationConfirmOpen(false)}>
            <div className="search-guard-modal reservation-confirm-modal" onClick={(event) => event.stopPropagation()}>
              <strong>예약을 확정하시겠습니까?</strong>
              <p className="field-note">입력한 예약자 정보와 예약 조건을 확인한 뒤 결제를 완료하면 예약이 확정됩니다.</p>
              <div className="reservation-result-card reservation-confirm-card">
                <div className="reservation-result-card__header">
                  <div>
                    <span className="reservation-result-card__eyebrow">예약 확인</span>
                    <strong className="reservation-result-card__title">{car.name}</strong>
                  </div>
                  <div className="reservation-result-card__status is-pending">확정 전 확인</div>
                </div>

                <div className="reservation-result-card__price">
                  <span>총 결제 금액</span>
                  <strong>{pricing.finalPrice}</strong>
                </div>

                <div className="reservation-result-list">
                  <div className="reservation-result-row"><span>예약자명</span><strong>{reservationValidation.normalized.customerName}</strong></div>
                  <div className="reservation-result-row"><span>휴대폰번호</span><strong>{reservationValidation.normalized.customerPhone}</strong></div>
                  <div className="reservation-result-row"><span>생년월일</span><strong>{reservationValidation.normalized.customerBirth}</strong></div>
                  <div className="reservation-result-row"><span>대여일시</span><strong>{formatDisplay(fixedSearchInfo.deliveryDateTime)}</strong></div>
                  <div className="reservation-result-row"><span>반납일시</span><strong>{formatDisplay(fixedSearchInfo.returnDateTime)}</strong></div>
                  <div className="reservation-result-row"><span>배차/수령</span><strong>{reservationLocationText}</strong></div>
                </div>
              </div>
              <div className="search-guard-actions">
                <button className="btn btn-outline btn-md" onClick={() => setIsReservationConfirmOpen(false)}>다시 확인</button>
                <button className="btn btn-dark btn-md" onClick={handleConfirmReservation} disabled={isCreatingReservation}>{isCreatingReservation ? '결제창 이동 중' : '결제'}</button>
              </div>
            </div>
          </div>
        )}

        {activeTermsContent ? (
          <div className="delivery-modal-backdrop" onClick={() => setActiveTermsModal('')}>
            <div
              className="panel"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={activeTermsContent.title}
              style={{ width: 'min(760px, 100%)', maxHeight: '90vh', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', overflow: 'hidden' }}
            >
              <div style={{ padding: 18, borderBottom: '1px solid #dfe7ef', display: 'grid', gap: 6 }}>
                <strong style={{ fontSize: 18 }}>{activeTermsContent.title}</strong>
                <p className="field-note" style={{ margin: 0 }}>아래 내용을 확인한 뒤 동의해 주세요.</p>
              </div>
              <div style={{ overflowY: 'auto', padding: 18, background: '#fff' }}>
                <div className="legal-content">
                  {activeTermsContent.content.split('\n').map((line, idx) => (
                    <p key={`${activeTermsModal}-${idx}`}>{line || '\u00A0'}</p>
                  ))}
                </div>
              </div>
              <div style={{ padding: 18, borderTop: '1px solid #dfe7ef', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-outline btn-md" onClick={() => setActiveTermsModal('')}>닫기</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
