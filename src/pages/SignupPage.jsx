import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PageShell } from '../components/Layout'
import ContactInfoStrip from '../components/ContactInfoStrip'
import { landingContactItems } from '../data/landing'
import { useAuth } from '../hooks/useAuth'
import { parseApiResponse } from '../utils/apiResponse'
import { formatPhoneNumber, normalizePhoneNumber } from '../utils/phone'
import { validateBirthDate, validateMobilePhoneNumber, validatePersonName } from '../utils/identityValidation'
import termsContent from '../../docs/legal/service-terms.md?raw'
import privacyContent from '../../docs/legal/privacy-policy.md?raw'
import rentalTermsContent from '../../docs/legal/rental-terms.md?raw'

const DAUM_POSTCODE_SCRIPT_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

const TERMS_MODAL_CONTENT = {
  terms: {
    title: '서비스 이용약관',
    content: termsContent,
  },
  privacy: {
    title: '개인정보 수집 및 이용 동의',
    content: privacyContent,
  },
  rental: {
    title: '렌터카 예약 및 대여 조건',
    content: rentalTermsContent,
  },
}

function loadDaumPostcodeScript() {
  if (window.daum?.Postcode) {
    return Promise.resolve(window.daum.Postcode)
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-daum-postcode="true"]`)

    function handleReady() {
      if (window.daum?.Postcode) {
        resolve(window.daum.Postcode)
      } else {
        reject(new Error('postcode_service_unavailable'))
      }
    }

    if (existing) {
      existing.addEventListener('load', handleReady, { once: true })
      existing.addEventListener('error', () => reject(new Error('postcode_script_load_failed')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = DAUM_POSTCODE_SCRIPT_SRC
    script.async = true
    script.dataset.daumPostcode = 'true'
    script.onload = handleReady
    script.onerror = () => reject(new Error('postcode_script_load_failed'))
    document.head.appendChild(script)
  })
}

function resolveRedirectTo(search) {
  const params = new URLSearchParams(search)
  const redirectTo = params.get('redirectTo') || '/cars'
  return redirectTo.startsWith('/') ? redirectTo : '/cars'
}

function getErrorMessage(error) {
  if (!error) return '회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.'
  if (error.message?.includes('already')) return '이미 가입된 휴대폰 번호입니다. 로그인으로 진행해 주세요.'
  if (error.message?.includes('Password should be at least')) return '비밀번호는 최소 8자 이상이어야 합니다.'
  return error.message || '회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.'
}

function formatBirthDate(value) {
  return value.replace(/\D/g, '').slice(0, 8)
}

function getPasswordChecks(password, email) {
  return {
    length: password.length >= 8,
    english: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
    noSpace: !/\s/.test(password),
    notEmail: email.trim() ? password !== email.trim() : true,
  }
}

function formatSeconds(seconds) {
  const safeSeconds = Math.max(0, Number(seconds || 0))
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0')
  const remainSeconds = String(safeSeconds % 60).padStart(2, '0')
  return `${minutes}:${remainSeconds}`
}

function SectionTitle({ title, description }) {
  return (
    <div className="auth-card-row auth-card-label-row">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  )
}

function FieldNote({ children, tone = 'muted' }) {
  return <p className={`field-note auth-note auth-note--${tone}`}>{children}</p>
}

function TermsRow({ checked, onChange, label, required = false, onOpen, disabled = false }) {
  return (
    <div className="auth-card-row auth-terms-row">
      <label className="auth-terms-check">
        <input className="auth-check-input" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
        <span>{required ? '[필수]' : '[선택]'} {label}</span>
      </label>
      <button type="button" className="btn btn-outline btn-sm" onClick={onOpen} disabled={disabled}>보기</button>
    </div>
  )
}

export default function SignupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loading, isAuthenticated } = useAuth()
  const redirectTo = useMemo(() => resolveRedirectTo(location.search), [location.search])

  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [addressMain, setAddressMain] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [agreeAll, setAgreeAll] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeRental, setAgreeRental] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [otpRequesting, setOtpRequesting] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [otpMessage, setOtpMessage] = useState('휴대폰 인증을 완료해야 회원가입할 수 있습니다.')
  const [addressMessage, setAddressMessage] = useState('우편번호 찾기 버튼으로 주소를 검색해 주세요.')
  const [verificationId, setVerificationId] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [verifiedPhone, setVerifiedPhone] = useState('')
  const [otpExpiresAt, setOtpExpiresAt] = useState(null)
  const [otpCooldownUntil, setOtpCooldownUntil] = useState(null)
  const [nowMs, setNowMs] = useState(Date.now())
  const [activeTermsModal, setActiveTermsModal] = useState('')
  const addressDetailInputRef = useRef(null)

  const passwordChecks = useMemo(() => getPasswordChecks(password, email), [password, email])
  const passwordValid = useMemo(() => Object.values(passwordChecks).every(Boolean), [passwordChecks])
  const isPasswordConfirmed = passwordConfirm.length > 0 && password === passwordConfirm
  const requiredTermsAgreed = agreeTerms && agreePrivacy && agreeRental
  const normalizedPhone = useMemo(() => normalizePhoneNumber(phone), [phone])
  const nameValidation = useMemo(() => validatePersonName(name), [name])
  const birthValidation = useMemo(() => validateBirthDate(birthDate), [birthDate])
  const phoneValidation = useMemo(() => validateMobilePhoneNumber(normalizedPhone), [normalizedPhone])
  const isOtpVerified = Boolean(verificationId && verificationToken && verifiedPhone && verifiedPhone === normalizedPhone)
  const otpSecondsLeft = otpExpiresAt ? Math.max(0, Math.ceil((otpExpiresAt - nowMs) / 1000)) : 0
  const otpCooldownLeft = otpCooldownUntil ? Math.max(0, Math.ceil((otpCooldownUntil - nowMs) / 1000)) : 0
  const activeTermsContent = activeTermsModal ? TERMS_MODAL_CONTENT[activeTermsModal] : null
  const canSubmitCurrentSignup = Boolean(
    nameValidation.isValid
    && birthValidation.isValid
    && passwordValid
    && isPasswordConfirmed
    && phoneValidation.isValid
    && /^\d{5}$/.test(postalCode)
    && addressMain.trim()
    && addressDetail.trim()
    && requiredTermsAgreed
    && isOtpVerified
    && !submitting
    && !loading
  )

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(redirectTo, { replace: true })
    }
  }, [loading, isAuthenticated, navigate, redirectTo])

  useEffect(() => {
    const nextAll = agreeTerms && agreePrivacy && agreeRental && agreeMarketing
    if (agreeAll !== nextAll) {
      setAgreeAll(nextAll)
    }
  }, [agreeAll, agreeMarketing, agreePrivacy, agreeRental, agreeTerms])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    loadDaumPostcodeScript().catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!verifiedPhone) return
    if (verifiedPhone === normalizedPhone) return

    setVerificationId('')
    setVerificationToken('')
    setVerifiedPhone('')
    setOtpMessage('휴대폰 번호가 바뀌어 인증 상태가 초기화되었습니다. 다시 인증해 주세요.')
  }, [normalizedPhone, verifiedPhone])

  useEffect(() => {
    if (!activeTermsModal) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [activeTermsModal])

  function handleToggleAllTerms(nextChecked) {
    setAgreeAll(nextChecked)
    setAgreeTerms(nextChecked)
    setAgreePrivacy(nextChecked)
    setAgreeRental(nextChecked)
    setAgreeMarketing(nextChecked)
  }

  async function handleOtpRequest() {
    if (!phoneValidation.isValid) {
      setOtpMessage(phoneValidation.message || '휴대폰 번호를 먼저 정확히 입력해 주세요.')
      return
    }

    setOtpRequesting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          purpose: 'signup',
        }),
      })

      const result = await parseApiResponse(response, '인증번호 발송에 실패했습니다.')
      setVerificationId(result.verificationId || '')
      setVerificationToken('')
      setVerifiedPhone('')
      setOtpCode('')
      setOtpExpiresAt(Date.now() + Number(result.expiresInSeconds || 180) * 1000)
      setOtpCooldownUntil(Date.now() + Number(result.cooldownSeconds || 60) * 1000)
      setOtpMessage(result.message || '인증번호를 발송했습니다.')
    } catch (error) {
      setOtpMessage(error.message || '인증번호 발송에 실패했습니다.')
    } finally {
      setOtpRequesting(false)
    }
  }

  async function handleOtpVerify() {
    if (!verificationId) {
      setOtpMessage('먼저 인증번호를 요청해 주세요.')
      return
    }

    if (otpCode.length !== 6) {
      setOtpMessage('인증번호 6자리를 입력해 주세요.')
      return
    }

    setOtpVerifying(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verificationId,
          phone: normalizedPhone,
          code: otpCode,
          purpose: 'signup',
        }),
      })

      const result = await parseApiResponse(response, '휴대폰 인증에 실패했습니다.')
      setVerificationToken(result.verificationToken || '')
      setVerifiedPhone(normalizedPhone)
      setOtpMessage(result.message || '휴대폰 인증이 완료되었습니다.')
    } catch (error) {
      setVerificationToken('')
      setVerifiedPhone('')
      setOtpMessage(error.message || '휴대폰 인증에 실패했습니다.')
    } finally {
      setOtpVerifying(false)
    }
  }

  async function handleFindAddress() {
    setErrorMessage('')
    setSuccessMessage('')
    setAddressMessage('주소 검색창을 여는 중입니다.')

    try {
      const Postcode = await loadDaumPostcodeScript()
      const postcode = new Postcode({
        oncomplete: (data) => {
          const baseAddress = data.roadAddress || data.jibunAddress || data.address || ''
          setPostalCode(data.zonecode || '')
          setAddressMain(baseAddress)
          setAddressMessage(baseAddress ? '주소 검색이 완료되었습니다. 상세주소를 이어서 입력해 주세요.' : '주소 검색 결과를 확인해 주세요.')
          window.setTimeout(() => addressDetailInputRef.current?.focus(), 50)
        },
      })

      postcode.open({ popupTitle: '우편번호 검색' })
      setAddressMessage('우편번호 팝업에서 주소를 선택해 주세요.')
    } catch (error) {
      setAddressMessage('주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setErrorMessage(error.message || '주소 검색창을 열지 못했습니다.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!isOtpVerified) {
      setErrorMessage('휴대폰 인증을 완료해 주세요.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          birthDate,
          email,
          password,
          passwordConfirm,
          phone: normalizedPhone,
          postalCode,
          addressMain,
          addressDetail,
          phoneVerificationId: verificationId,
          phoneVerificationToken: verificationToken,
          agreeTerms,
          agreePrivacy,
          agreeRental,
          agreeMarketing,
        }),
      })

      const result = await parseApiResponse(response, '회원가입에 실패했습니다.')
      setSuccessMessage(result.message || '회원가입이 완료되었습니다.')
      setOtpMessage('휴대폰 인증이 완료된 상태로 가입이 처리되었습니다.')
      navigate(`/login?redirectTo=${encodeURIComponent(redirectTo)}&phone=${encodeURIComponent(normalizedPhone)}`, { replace: true })
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell className="auth-page-shell">
      <section className="auth-page-section">
        <div className="site-container auth-page-container">
          <div className="auth-title-block"><h1>회원가입</h1><span>전화번호 사용</span></div>

          <form className="auth-form auth-form--stack" onSubmit={handleSubmit}>
              <div className="auth-section-stack">
                <section className="auth-card">
                  <SectionTitle title="회원정보" />

                  <div className="auth-card-row">
                    <label className="auth-input-label" htmlFor="signup-name">이름</label>
                    <input
                      id="signup-name"
                      className="auth-line-input"
                      type="text"
                      placeholder="홍길동"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      disabled={submitting}
                      required
                    />
                    {name && !nameValidation.isValid ? <FieldNote tone="danger">{nameValidation.message}</FieldNote> : null}
                  </div>

                  <div className="auth-card-row">
                    <label className="auth-input-label" htmlFor="signup-birth-date">생년월일</label>
                    <input
                      id="signup-birth-date"
                      className="auth-line-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="19900101"
                      value={birthDate}
                      onChange={(event) => setBirthDate(formatBirthDate(event.target.value))}
                      disabled={submitting}
                      required
                    />
                    {birthDate && !birthValidation.isValid ? <FieldNote tone="danger">{birthValidation.message}</FieldNote> : null}
                  </div>

                  <div className="auth-card-row">
                    <label className="auth-input-label" htmlFor="signup-email">이메일 (선택)</label>
                    <input
                      id="signup-email"
                      className="auth-line-input"
                      type="email"
                      autoComplete="email"
                      placeholder="example@email.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </section>

                <section className="auth-card">
                  <SectionTitle title="비밀번호" />

                  <div className="auth-card-row field-group">
                    <label className="field-label" htmlFor="signup-password">비밀번호</label>
                    <div className="auth-field-stack">
                      <div className="auth-action-grid">
                        <input
                          id="signup-password"
                          className="field-input"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="영문, 숫자를 포함해 8자 이상"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          disabled={submitting}
                          required
                          minLength={8}
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-md"
                          onClick={() => setShowPassword((prev) => !prev)}
                          disabled={submitting}
                        >
                          {showPassword ? '숨기기' : '보기'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="auth-card-row field-group">
                    <label className="field-label" htmlFor="signup-password-confirm">비밀번호 확인</label>
                    <div className="auth-field-stack">
                      <div className="auth-action-grid">
                        <input
                          id="signup-password-confirm"
                          className="field-input"
                          type={showPasswordConfirm ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="비밀번호 다시 입력"
                          value={passwordConfirm}
                          onChange={(event) => setPasswordConfirm(event.target.value)}
                          disabled={submitting}
                          required
                          minLength={8}
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-md"
                          onClick={() => setShowPasswordConfirm((prev) => !prev)}
                          disabled={submitting}
                        >
                          {showPasswordConfirm ? '숨기기' : '보기'}
                        </button>
                      </div>
                      {passwordConfirm ? (
                        <FieldNote tone={isPasswordConfirmed ? 'success' : 'danger'}>
                          {isPasswordConfirmed ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}
                        </FieldNote>
                      ) : null}
                      <div className="auth-note-stack">
                        <FieldNote tone={passwordChecks.length ? 'success' : 'muted'}>{passwordChecks.length ? '✓' : '○'} 8자 이상</FieldNote>
                        <FieldNote tone={passwordChecks.english ? 'success' : 'muted'}>{passwordChecks.english ? '✓' : '○'} 영문 포함</FieldNote>
                        <FieldNote tone={passwordChecks.number ? 'success' : 'muted'}>{passwordChecks.number ? '✓' : '○'} 숫자 포함</FieldNote>
                        <FieldNote tone={passwordChecks.noSpace ? 'success' : 'danger'}>{passwordChecks.noSpace ? '✓' : '○'} 공백 없음</FieldNote>
                        <FieldNote tone={passwordChecks.notEmail ? 'success' : 'danger'}>{passwordChecks.notEmail ? '✓' : '○'} 이메일 입력 시 동일값 금지</FieldNote>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="auth-card">
                  <SectionTitle title="연락처 인증" />
                  <div className="auth-card-row field-group">
                    <label className="field-label" htmlFor="signup-phone">휴대폰 번호</label>
                    <div className="auth-action-grid">
                      <input
                        id="signup-phone"
                        className="field-input"
                        type="text"
                        inputMode="numeric"
                        placeholder="010-0000-0000"
                        value={phone}
                        onChange={(event) => setPhone(formatPhoneNumber(event.target.value))}
                        disabled={submitting || otpRequesting || otpVerifying}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-md"
                        onClick={handleOtpRequest}
                        disabled={submitting || otpRequesting || otpVerifying || otpCooldownLeft > 0}
                      >
                        {otpRequesting ? '발송 중...' : otpCooldownLeft > 0 ? `재전송 ${otpCooldownLeft}s` : '인증번호 받기'}
                      </button>
                    </div>
                    {phone && !phoneValidation.isValid ? <FieldNote tone="danger">{phoneValidation.message}</FieldNote> : null}
                  </div>

                  <div className="auth-card-row field-group">
                    <label className="field-label" htmlFor="signup-otp">인증번호</label>
                    <div className="auth-action-grid">
                      <input
                        id="signup-otp"
                        className="field-input"
                        type="text"
                        inputMode="numeric"
                        placeholder="6자리 숫자 입력"
                        value={otpCode}
                        onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        disabled={submitting || otpVerifying || !verificationId || isOtpVerified}
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-md"
                        onClick={handleOtpVerify}
                        disabled={submitting || otpVerifying || !verificationId || otpCode.length !== 6 || isOtpVerified}
                      >
                        {isOtpVerified ? '인증완료' : otpVerifying ? '확인 중...' : '확인'}
                      </button>
                    </div>
                    <FieldNote tone={isOtpVerified ? 'success' : 'muted'}>
                      {isOtpVerified
                        ? '휴대폰 인증이 완료되었습니다.'
                        : verificationId
                          ? `남은 시간 ${formatSeconds(otpSecondsLeft)}`
                          : '인증번호를 먼저 요청해 주세요.'}
                    </FieldNote>
                    <FieldNote tone={isOtpVerified ? 'success' : 'muted'}>{otpMessage}</FieldNote>
                  </div>
                </section>

                <section className="auth-card">
                  <SectionTitle title="주소" />

                  <div className="auth-card-stack signup-address-stack">
                    <div className="auth-card-row field-group">
                      <label className="field-label" htmlFor="signup-postal-code">우편번호</label>
                      <div className="auth-action-grid">
                        <input
                          id="signup-postal-code"
                          className="field-input"
                          type="text"
                          inputMode="numeric"
                          placeholder="우편번호"
                          value={postalCode}
                          onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, '').slice(0, 5))}
                          disabled={submitting}
                          required
                          readOnly
                        />
                        <button type="button" className="btn btn-outline btn-md" onClick={handleFindAddress} disabled={submitting}>
                          우편번호 찾기
                        </button>
                      </div>
                    </div>

                    <div className="auth-card-row field-group">
                      <label className="field-label" htmlFor="signup-address-main">기본주소</label>
                      <input
                        id="signup-address-main"
                        className="field-input"
                        type="text"
                        placeholder="기본주소"
                        value={addressMain}
                        onChange={(event) => setAddressMain(event.target.value)}
                        disabled={submitting}
                        readOnly
                        required
                      />
                      </div>

                    <div className="auth-card-row field-group">
                      <label className="field-label" htmlFor="signup-address-detail">상세주소</label>
                      <input
                        ref={addressDetailInputRef}
                        id="signup-address-detail"
                        className="field-input"
                        type="text"
                        placeholder="상세주소"
                        value={addressDetail}
                        onChange={(event) => setAddressDetail(event.target.value)}
                        disabled={submitting}
                        required
                      />
                      <FieldNote>{addressMessage}</FieldNote>
                    </div>
                  </div>
                </section>

                <section className="auth-card signup-terms-card">
                  <SectionTitle title="약관동의" />

                  <div className="signup-terms-box">
                    <label className="signup-terms-row signup-terms-row-all">
                      <input
                        className="auth-check-input"
                        type="checkbox"
                        checked={agreeAll}
                        onChange={(event) => handleToggleAllTerms(event.target.checked)}
                        disabled={submitting}
                      />
                      <span>전체 동의</span>
                    </label>

                    <div className="signup-terms-list">
                      <TermsRow checked={agreeTerms} onChange={setAgreeTerms} label="서비스 이용약관 동의" required onOpen={() => setActiveTermsModal('terms')} disabled={submitting} />
                      <TermsRow checked={agreePrivacy} onChange={setAgreePrivacy} label="개인정보 수집 및 이용 동의" required onOpen={() => setActiveTermsModal('privacy')} disabled={submitting} />
                      <TermsRow checked={agreeRental} onChange={setAgreeRental} label="렌터카 예약 및 대여 조건 동의" required onOpen={() => setActiveTermsModal('rental')} disabled={submitting} />
                      <label className="signup-terms-row">
                        <input className="auth-check-input" type="checkbox" checked={agreeMarketing} onChange={(event) => setAgreeMarketing(event.target.checked)} disabled={submitting} />
                        <span>[선택] 마케팅 정보 수신 동의</span>
                      </label>
                    </div>

                    <p className={`signup-terms-note auth-note auth-note--${requiredTermsAgreed ? 'success' : 'muted'}`}>
                      {requiredTermsAgreed ? '필수 약관 동의가 완료되었습니다.' : '필수 약관에 모두 동의해 주세요.'}
                    </p>
                  </div>
                </section>
              </div>

              {errorMessage ? <p className="field-note auth-note auth-note--danger">{errorMessage}</p> : null}
              {successMessage ? <p className="field-note auth-note auth-note--success">{successMessage}</p> : null}

              <button className="auth-submit-button" type="submit" disabled={!canSubmitCurrentSignup}>
                {submitting ? '회원가입 중...' : '회원가입'}
              </button>

            </form>

          <div className="auth-bottom-links">
            <Link to={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}>로그인</Link>
            <Link to="/guest-bookings">비회원 예약조회</Link>
            <Link to="/">메인으로</Link>
          </div>
        </div>
      </section>

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
    </PageShell>
  )
}
