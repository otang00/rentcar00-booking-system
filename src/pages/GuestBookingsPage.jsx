import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageShell } from '../components/Layout'
import { cancelGuestBooking, lookupGuestBooking } from '../services/guestBookingApi'
import { formatPhoneNumber, normalizePhoneNumber } from '../utils/phone'
import { validateMobilePhoneNumber } from '../utils/identityValidation'

const SESSION_STORAGE_KEY = 'rentcar00_guest_lookup_session'

function formatSeconds(seconds) {
  const safe = Math.max(0, Number(seconds || 0))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

function readStoredSession() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.lookupToken || !parsed?.lookupTokenExpiresAt || !parsed?.verifiedPhone) return null
    return parsed
  } catch {
    return null
  }
}

function ReservationCard({ booking, onCancel, isCancelling }) {
  return (
    <div className="reservation-result-card">
      <div className="reservation-result-card__header">
        <div>
          <span className="reservation-result-card__eyebrow">예약 조회 결과</span>
          <strong className="reservation-result-card__title">{booking.pricingSnapshot?.carName || '-'}</strong>
        </div>
        <div className={`reservation-result-card__status ${booking.statusTone === 'cancelled' ? 'is-cancelled' : booking.statusTone === 'pending' ? 'is-pending' : 'is-confirmed'}`}>
          {booking.statusLabel}
        </div>
      </div>

      <div className="reservation-result-card__price">
        <span>총 금액</span>
        <strong>{booking.pricing.finalPrice}</strong>
      </div>

      <div className="reservation-result-list">
        <div className="reservation-result-row"><span>예약번호</span><strong>{booking.reservationNumber}</strong></div>
        <div className="reservation-result-row"><span>대여일시</span><strong>{booking.display.pickupAt}</strong></div>
        <div className="reservation-result-row"><span>반납일시</span><strong>{booking.display.returnAt}</strong></div>
        <div className="reservation-result-row"><span>배차/수령</span><strong>{booking.schedule.displayPickupLabel}</strong></div>
        <div className="reservation-result-row"><span>예약자</span><strong>{booking.customerName}</strong></div>
        <div className="reservation-result-row"><span>휴대폰번호</span><strong>{booking.customerPhone}</strong></div>
        <div className="reservation-result-row"><span>생년월일</span><strong>{booking.customerBirth}</strong></div>
      </div>

      {booking.canCancel ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          <button className="btn btn-outline btn-md" onClick={() => onCancel(booking.reservationNumber)} disabled={isCancelling}>
            {isCancelling ? '처리 중' : '예약 취소'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function GuestBookingsPage() {
  const [customerPhone, setCustomerPhone] = useState(() => formatPhoneNumber(readStoredSession()?.verifiedPhone || ''))
  const [otpCode, setOtpCode] = useState('')
  const [verificationId, setVerificationId] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [otpMessage, setOtpMessage] = useState('휴대폰 인증을 완료하면 진행 중인 비회원 예약을 확인할 수 있습니다.')
  const [otpExpiresAt, setOtpExpiresAt] = useState(null)
  const [otpCooldownUntil, setOtpCooldownUntil] = useState(null)
  const [results, setResults] = useState([])
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [hasLookedUp, setHasLookedUp] = useState(false)
  const [lookupToken, setLookupToken] = useState(() => readStoredSession()?.lookupToken || '')
  const [lookupTokenExpiresAt, setLookupTokenExpiresAt] = useState(() => readStoredSession()?.lookupTokenExpiresAt || null)
  const [verifiedPhone, setVerifiedPhone] = useState(() => readStoredSession()?.verifiedPhone || '')
  const [isOtpRequesting, setIsOtpRequesting] = useState(false)
  const [isOtpVerifying, setIsOtpVerifying] = useState(false)
  const [isLookupSubmitting, setIsLookupSubmitting] = useState(false)
  const [cancellingReservationCode, setCancellingReservationCode] = useState('')
  const [nowMs, setNowMs] = useState(Date.now())

  const normalizedPhone = useMemo(() => normalizePhoneNumber(customerPhone), [customerPhone])
  const phoneValidation = useMemo(() => validateMobilePhoneNumber(normalizedPhone), [normalizedPhone])
  const canRequestOtp = phoneValidation.isValid && !isOtpRequesting
  const canVerifyOtp = Boolean(verificationId) && otpCode.length === 6 && !isOtpVerifying
  const activeSessionSecondsLeft = lookupTokenExpiresAt
    ? Math.max(0, Math.ceil((new Date(lookupTokenExpiresAt).getTime() - nowMs) / 1000))
    : 0
  const otpSecondsLeft = otpExpiresAt
    ? Math.max(0, Math.ceil((otpExpiresAt - nowMs) / 1000))
    : 0
  const otpCooldownLeft = otpCooldownUntil
    ? Math.max(0, Math.ceil((otpCooldownUntil - nowMs) / 1000))
    : 0
  const hasActiveLookupSession = Boolean(lookupToken && lookupTokenExpiresAt && activeSessionSecondsLeft > 0)

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (hasActiveLookupSession && verifiedPhone) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        lookupToken,
        lookupTokenExpiresAt,
        verifiedPhone,
      }))
      return
    }

    window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  }, [hasActiveLookupSession, lookupToken, lookupTokenExpiresAt, verifiedPhone])

  useEffect(() => {
    if (!lookupToken || !lookupTokenExpiresAt) return
    if (activeSessionSecondsLeft > 0) return

    setLookupToken('')
    setLookupTokenExpiresAt(null)
    setVerifiedPhone('')
    setResults([])
    setNotice('인증 시간이 만료되었습니다. 다시 휴대폰 인증을 진행해 주세요.')
    setError('')
    setHasLookedUp(false)
  }, [lookupToken, lookupTokenExpiresAt, activeSessionSecondsLeft])

  useEffect(() => {
    const stored = readStoredSession()
    if (!stored?.lookupToken || !stored?.lookupTokenExpiresAt || !stored?.verifiedPhone) return
    if (new Date(stored.lookupTokenExpiresAt).getTime() <= Date.now()) return
    if (results.length > 0 || isLookupSubmitting) return

    refreshLookupSession(stored.lookupToken)
  }, [])

  function resetOtpState(message = '휴대폰 인증을 다시 진행해 주세요.') {
    setVerificationId('')
    setVerificationToken('')
    setOtpCode('')
    setOtpExpiresAt(null)
    setOtpCooldownUntil(null)
    setOtpMessage(message)
  }

  function clearLookupSession(message = '휴대폰 인증을 진행해 주세요.') {
    setLookupToken('')
    setLookupTokenExpiresAt(null)
    setVerifiedPhone('')
    setResults([])
    setHasLookedUp(false)
    setNotice(message)
  }

  async function refreshLookupSession(token = lookupToken) {
    if (!token) return

    try {
      setIsLookupSubmitting(true)
      setError('')
      setNotice('')
      const response = await lookupGuestBooking({ lookupToken: token })
      setResults(response.bookings || [])
      setLookupToken(response.lookupToken || token)
      setLookupTokenExpiresAt(response.lookupTokenExpiresAt || null)
      setVerifiedPhone(response.verifiedPhone || verifiedPhone)
      setHasLookedUp(true)
    } catch (lookupError) {
      const message = lookupError.message || '예약 조회에 실패했습니다.'
      if (message.includes('인증이 만료')) {
        clearLookupSession(message)
      } else {
        setError(message)
      }
    } finally {
      setIsLookupSubmitting(false)
    }
  }

  async function handleOtpRequest() {
    if (!phoneValidation.isValid) {
      setOtpMessage(phoneValidation.message || '휴대폰 번호를 먼저 확인해 주세요.')
      return
    }

    setIsOtpRequesting(true)
    setError('')
    setNotice('')

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          purpose: 'guest_lookup',
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.message || '인증번호 발송에 실패했습니다.')
      setVerificationId(result.verificationId || '')
      setVerificationToken('')
      setOtpCode('')
      setOtpExpiresAt(Date.now() + Number(result.expiresInSeconds || 180) * 1000)
      setOtpCooldownUntil(Date.now() + Number(result.cooldownSeconds || 60) * 1000)
      setOtpMessage(result.message || '인증번호를 발송했습니다.')
    } catch (requestError) {
      setOtpMessage(requestError.message || '인증번호 발송에 실패했습니다.')
    } finally {
      setIsOtpRequesting(false)
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

    setIsOtpVerifying(true)
    setIsLookupSubmitting(true)
    setError('')
    setNotice('')

    try {
      const verifyResponse = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verificationId,
          phone: normalizedPhone,
          code: otpCode,
          purpose: 'guest_lookup',
        }),
      })

      const verifyResult = await verifyResponse.json()
      if (!verifyResponse.ok) throw new Error(verifyResult.message || '휴대폰 인증에 실패했습니다.')

      setVerificationToken(verifyResult.verificationToken || '')
      setOtpMessage(verifyResult.message || '휴대폰 인증이 완료되었습니다.')

      const lookupResult = await lookupGuestBooking({
        customerPhone: normalizedPhone,
        phoneVerificationId: verificationId,
        phoneVerificationToken: verifyResult.verificationToken || '',
      })

      setLookupToken(lookupResult.lookupToken || '')
      setLookupTokenExpiresAt(lookupResult.lookupTokenExpiresAt || null)
      setVerifiedPhone(lookupResult.verifiedPhone || normalizedPhone)
      setResults(lookupResult.bookings || [])
      setHasLookedUp(true)
      setNotice('휴대폰 인증이 완료되었습니다. 인증 시간 안에서 예약을 확인하고 취소할 수 있습니다.')
      setError('')
      resetOtpState('휴대폰 인증이 완료되었습니다.')
    } catch (verifyError) {
      setError(verifyError.message || '휴대폰 인증에 실패했습니다.')
    } finally {
      setIsOtpVerifying(false)
      setIsLookupSubmitting(false)
    }
  }

  async function handleCancel(reservationCode) {
    if (!reservationCode || !lookupToken) return

    const confirmed = window.confirm('이 예약을 취소하시겠습니까?')
    if (!confirmed) return

    try {
      setCancellingReservationCode(reservationCode)
      setNotice('')
      setError('')
      const cancelled = await cancelGuestBooking({ lookupToken, reservationCode })
      setResults((current) => current.filter((item) => item.reservationNumber !== cancelled.booking?.reservationNumber))
      setLookupTokenExpiresAt(cancelled.lookupTokenExpiresAt || lookupTokenExpiresAt)
      setNotice('예약이 취소되었습니다.')
    } catch (cancelError) {
      const message = cancelError.message || '예약 취소에 실패했습니다.'
      if (message.includes('인증이 만료')) {
        clearLookupSession(message)
      } else {
        setError(message)
      }
    } finally {
      setCancellingReservationCode('')
    }
  }

  return (
    <PageShell>
      <section className="section-bg">
        <div className="container detail-layout" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <article className="detail-card panel" style={{ display: 'grid', gap: 16 }}>
            <div>
              <h1 style={{ margin: 0 }}>비회원 예약조회</h1>
              <p className="small-note" style={{ marginTop: 8 }}>
                휴대폰 인증을 완료하면 진행 중인 비회원 예약을 확인하고 취소할 수 있습니다.
              </p>
            </div>

            {hasActiveLookupSession ? (
              <>
                <div className="panel-sub" style={{ display: 'grid', gap: 12 }}>
                  <div className="reservation-result-row"><span>인증 휴대폰</span><strong>{formatPhoneNumber(verifiedPhone)}</strong></div>
                  <div className="reservation-result-row"><span>인증 유효시간</span><strong>{formatSeconds(activeSessionSecondsLeft)}</strong></div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-dark btn-md" onClick={() => refreshLookupSession()} disabled={isLookupSubmitting}>
                    {isLookupSubmitting ? '불러오는 중...' : '예약 새로고침'}
                  </button>
                  <button className="btn btn-outline btn-md" onClick={() => clearLookupSession('인증을 종료했습니다. 다시 조회하려면 휴대폰 인증을 진행해 주세요.')}>
                    인증 종료
                  </button>
                  <Link className="btn btn-outline btn-md" to="/">메인으로</Link>
                </div>
              </>
            ) : (
              <>
                <div className="stack-form stack-form-centered">
                  <div>
                    <input
                      className="field-input"
                      placeholder="휴대폰번호"
                      inputMode="tel"
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(formatPhoneNumber(e.target.value))
                        resetOtpState('휴대폰 인증을 진행해 주세요.')
                        setError('')
                        setNotice('')
                      }}
                      disabled={isOtpRequesting || isOtpVerifying || isLookupSubmitting}
                    />
                  </div>
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr auto auto' }}>
                    <input
                      className="field-input"
                      placeholder="인증번호 6자리"
                      inputMode="numeric"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      disabled={!verificationId || isOtpVerifying || isLookupSubmitting}
                    />
                    <button className="btn btn-outline btn-md" onClick={handleOtpRequest} disabled={!canRequestOtp || otpCooldownLeft > 0 || isOtpVerifying || isLookupSubmitting}>
                      {isOtpRequesting ? '발송 중...' : otpCooldownLeft > 0 ? `재전송 ${otpCooldownLeft}s` : '인증번호 발송'}
                    </button>
                    <button className="btn btn-dark btn-md" onClick={handleOtpVerify} disabled={!canVerifyOtp || isLookupSubmitting}>
                      {isOtpVerifying || isLookupSubmitting ? '확인 중...' : '확인'}
                    </button>
                  </div>
                </div>

                <div className="panel-sub" style={{ display: 'grid', gap: 8 }}>
                  <div className="reservation-result-row"><span>입력 번호</span><strong>{formatPhoneNumber(normalizedPhone) || '-'}</strong></div>
                  <div className="reservation-result-row"><span>인증번호 유효시간</span><strong>{verificationId && otpSecondsLeft > 0 ? formatSeconds(otpSecondsLeft) : '-'}</strong></div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link className="btn btn-outline btn-md" to="/">메인으로</Link>
                </div>
              </>
            )}

            {error ? <p className="small-note" style={{ margin: 0 }}>{error}</p> : null}
            {notice ? <p className="small-note" style={{ margin: 0 }}>{notice}</p> : null}
            {otpMessage ? <p className="field-note" style={{ margin: 0 }}>{otpMessage}</p> : null}

            {hasActiveLookupSession && hasLookedUp && !error && results.length === 0 ? (
              <div className="legal-note" style={{ marginTop: 0 }}>조회 가능한 진행 중 예약이 없습니다.</div>
            ) : null}

            {hasActiveLookupSession && results.length > 0 ? (
              <div className="panel-sub" style={{ display: 'grid', gap: 16 }}>
                {results.map((booking) => (
                  <ReservationCard
                    key={booking.id || booking.reservationNumber}
                    booking={booking}
                    onCancel={handleCancel}
                    isCancelling={cancellingReservationCode === booking.reservationNumber}
                  />
                ))}
              </div>
            ) : null}
          </article>
        </div>
      </section>
    </PageShell>
  )
}
