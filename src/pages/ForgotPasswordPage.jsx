import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PageShell } from '../components/Layout'
import ContactInfoStrip from '../components/ContactInfoStrip'
import { landingContactItems } from '../data/landing'
import { parseApiResponse } from '../utils/apiResponse'
import { formatPhoneNumber, normalizePhoneNumber } from '../utils/phone'
import { validateMobilePhoneNumber } from '../utils/identityValidation'

function resolveRedirectTo(search) {
  const params = new URLSearchParams(search)
  const redirectTo = params.get('redirectTo') || '/login'
  return redirectTo.startsWith('/') ? redirectTo : '/login'
}

function getPasswordChecks(password) {
  return {
    length: password.length >= 8,
    english: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
    noSpace: !/\s/.test(password),
  }
}

function getPasswordHelp(checks) {
  if (Object.values(checks).every(Boolean)) return '사용 가능한 비밀번호입니다.'
  return '비밀번호는 8자 이상, 영문과 숫자를 포함하고 공백 없이 입력해 주세요.'
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = useMemo(() => resolveRedirectTo(location.search), [location.search])
  const [phone, setPhone] = useState('')
  const [verificationId, setVerificationId] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [verifiedPhone, setVerifiedPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const normalizedPhone = normalizePhoneNumber(phone)
  const phoneValidation = validateMobilePhoneNumber(normalizedPhone)
  const isOtpVerified = Boolean(verificationToken && verifiedPhone === normalizedPhone)
  const passwordChecks = getPasswordChecks(password)
  const isPasswordReady = Object.values(passwordChecks).every(Boolean) && password === passwordConfirm

  async function handleOtpRequest() {
    if (!phoneValidation.isValid) {
      setErrorMessage(phoneValidation.message || '휴대폰 번호를 정확히 입력해 주세요.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalizedPhone,
          purpose: 'reset_password',
        }),
      })

      const result = await parseApiResponse(response, '인증번호 발송에 실패했습니다.')
      setVerificationId(result.verificationId || '')
      setVerificationToken('')
      setVerifiedPhone('')
      setOtpCode('')
      setSuccessMessage(result.message || '인증번호를 발송했습니다.')
    } catch (error) {
      setErrorMessage(error.message || '인증번호 발송에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleOtpVerify() {
    if (!verificationId) {
      setErrorMessage('먼저 인증번호를 요청해 주세요.')
      return
    }

    if (otpCode.length !== 6) {
      setErrorMessage('인증번호 6자리를 입력해 주세요.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationId,
          phone: normalizedPhone,
          code: otpCode,
          purpose: 'reset_password',
        }),
      })

      const result = await parseApiResponse(response, '휴대폰 인증에 실패했습니다.')
      setVerificationToken(result.verificationToken || '')
      setVerifiedPhone(normalizedPhone)
      setSuccessMessage(result.message || '휴대폰 인증이 완료되었습니다. 새 비밀번호를 입력해 주세요.')
    } catch (error) {
      setVerificationToken('')
      setVerifiedPhone('')
      setErrorMessage(error.message || '휴대폰 인증에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!isOtpVerified) {
      setErrorMessage('휴대폰 인증을 먼저 완료해 주세요.')
      return
    }

    if (password !== passwordConfirm) {
      setErrorMessage('비밀번호 확인이 일치하지 않습니다.')
      return
    }

    if (!Object.values(passwordChecks).every(Boolean)) {
      setErrorMessage('비밀번호 조건을 확인해 주세요.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalizedPhone,
          phoneVerificationId: verificationId,
          phoneVerificationToken: verificationToken,
          password,
          passwordConfirm,
        }),
      })

      const result = await parseApiResponse(response, '비밀번호 변경에 실패했습니다.')
      setSuccessMessage(result.message || '비밀번호가 변경되었습니다. 다시 로그인해 주세요.')
      window.setTimeout(() => {
        navigate(`/login?phone=${encodeURIComponent(normalizedPhone)}&redirectTo=${encodeURIComponent(redirectTo)}`, { replace: true })
      }, 1000)
    } catch (error) {
      setErrorMessage(error.message || '비밀번호 변경에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell className="auth-page-shell">
      <section className="auth-page-section">
        <div className="site-container auth-page-container">
          <article className="auth-card-shell">
            <div className="auth-title-block"><h1>비밀번호 재설정</h1><span>전화번호 사용</span></div>

            <div className="auth-card auth-status-card">
              <div className="reservation-result-row"><span>1단계</span><strong>{verificationId ? '인증번호 발송됨' : '휴대폰 번호 입력'}</strong></div>
              <div className="reservation-result-row"><span>2단계</span><strong>{isOtpVerified ? '인증 완료' : '인증번호 확인'}</strong></div>
              <div className="reservation-result-row"><span>3단계</span><strong>{isOtpVerified ? '새 비밀번호 설정 가능' : '인증 후 진행'}</strong></div>
            </div>

            <form className="auth-form auth-form--stack" onSubmit={handleSubmit}>
              <div className="field-group">
                <label className="field-label" htmlFor="reset-phone">휴대폰 번호</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="reset-phone"
                    className="field-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="010-0000-0000"
                    value={phone}
                    onChange={(event) => {
                      setPhone(formatPhoneNumber(event.target.value))
                      setVerificationId('')
                      setVerificationToken('')
                      setVerifiedPhone('')
                      setOtpCode('')
                    }}
                    disabled={submitting || isOtpVerified}
                    required
                  />
                  <button className="btn btn-outline btn-md" type="button" onClick={handleOtpRequest} disabled={submitting || !phoneValidation.isValid || isOtpVerified}>
                    인증번호 받기
                  </button>
                </div>
                <p className="field-note">가입된 휴대폰 번호만 인증번호를 받을 수 있습니다.</p>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="reset-otp">인증번호</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="reset-otp"
                    className="field-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="인증번호 6자리"
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={submitting || !verificationId || isOtpVerified}
                    required
                  />
                  <button className="btn btn-outline btn-md" type="button" onClick={handleOtpVerify} disabled={submitting || !verificationId || otpCode.length !== 6 || isOtpVerified}>
                    {isOtpVerified ? '인증완료' : '확인'}
                  </button>
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="new-password">새 비밀번호</label>
                <input
                  id="new-password"
                  className="field-input"
                  type="password"
                  autoComplete="new-password"
                  placeholder="영문+숫자 포함 8자 이상"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting || !isOtpVerified}
                  required
                  minLength={8}
                />
                <p className="field-note" style={{ color: Object.values(passwordChecks).every(Boolean) ? '#166534' : '#6b7280' }}>
                  {getPasswordHelp(passwordChecks)}
                </p>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="new-password-confirm">새 비밀번호 확인</label>
                <input
                  id="new-password-confirm"
                  className="field-input"
                  type="password"
                  autoComplete="new-password"
                  placeholder="비밀번호 다시 입력"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  disabled={submitting || !isOtpVerified}
                  required
                  minLength={8}
                />
                {passwordConfirm ? (
                  <p className="field-note" style={{ color: password === passwordConfirm ? '#166534' : '#be123c' }}>
                    {password === passwordConfirm ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}
                  </p>
                ) : null}
              </div>

              {errorMessage ? <p className="field-note" style={{ color: '#be123c' }}>{errorMessage}</p> : null}
              {successMessage ? <p className="field-note" style={{ color: '#166534' }}>{successMessage}</p> : null}

              <button className="auth-submit-button" type="submit" disabled={submitting || !isOtpVerified || !isPasswordReady}>
                {submitting ? '처리 중...' : '비밀번호 변경'}
              </button>
            </form>

            <div className="auth-bottom-links">
              <Link to={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}>로그인으로</Link>
              <Link to="/">메인으로</Link>
            </div>
          </article>
        </div>
      </section>
      <ContactInfoStrip items={landingContactItems} />
    </PageShell>
  )
}
