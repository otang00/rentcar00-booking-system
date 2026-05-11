import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { cancelAdminBooking, completeAdminBookingRefund, fetchAdminBookingConfirm } from '../services/adminBookingConfirmApi'
import { isAdminUser } from '../utils/adminAccess'

export default function AdminBookingConfirmPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { loading, isAuthenticated, session, user, profile } = useAuth()
  const [booking, setBooking] = useState(null)
  const [fetching, setFetching] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [resultMessage, setResultMessage] = useState('')
  const hasAdminHint = useMemo(() => isAdminUser(user) || isAdminUser(profile), [profile, user])
  const redirectTo = `${location.pathname}${location.search}`
  const canAdminCancel = hasAdminHint && String(booking?.bookingStatus || '') === 'confirmed'
  const canCompleteRefund = hasAdminHint
    && String(booking?.bookingStatus || '') === 'cancelled'
    && String(booking?.paymentStatus || '') === 'refund_pending'

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) {
      navigate(`/login?redirectTo=${encodeURIComponent(redirectTo)}`, { replace: true })
    }
  }, [loading, isAuthenticated, navigate, redirectTo])

  useEffect(() => {
    let ignore = false

    if (loading) {
      return () => {
        ignore = true
      }
    }

    if (!token) {
      setError('예약 확인 토큰이 없습니다.')
      setFetching(false)
      return () => {
        ignore = true
      }
    }

    if (!isAuthenticated) {
      setFetching(false)
      return () => {
        ignore = true
      }
    }

    if (!hasAdminHint) {
      setBooking(null)
      setError('관리자만 접근할 수 있습니다.')
      setFetching(false)
      return () => {
        ignore = true
      }
    }

    setFetching(true)
    fetchAdminBookingConfirm(session, token)
      .then((result) => {
        if (ignore) return
        setBooking(result.booking)
        setError('')
      })
      .catch((fetchError) => {
        if (ignore) return
        setError(fetchError.message || '예약 확인 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (ignore) return
        setFetching(false)
      })

    return () => {
      ignore = true
    }
  }, [loading, token, isAuthenticated, hasAdminHint, session])

  async function handleCancel() {
    if (!token || !canAdminCancel || submitting || !session?.access_token || !hasAdminHint) return

    const confirmed = window.confirm('이 예약을 취소하시겠습니까?')
    if (!confirmed) return

    setSubmitting(true)
    try {
      const result = await cancelAdminBooking(session, token)
      setBooking(result.booking)
      setResultMessage('예약이 취소되었습니다.')
      setError('')
    } catch (cancelError) {
      setError(cancelError.message || '예약 취소에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRefundComplete() {
    if (!token || !canCompleteRefund || submitting || !session?.access_token || !hasAdminHint) return

    const confirmed = window.confirm('이 예약을 환불 완료 처리하시겠습니까?')
    if (!confirmed) return

    setSubmitting(true)
    try {
      const result = await completeAdminBookingRefund(session, token)
      setBooking(result.booking)
      setResultMessage('환불 완료 처리되었습니다.')
      setError('')
    } catch (refundError) {
      setError(refundError.message || '환불 완료 처리에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell>
      <section className="section-bg">
        <div className="container detail-layout" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <article className="detail-card panel" style={{ display: 'grid', gap: 16 }}>
            <div>
              <h1 style={{ margin: 0 }}>예약 확인</h1>
              <p className="small-note" style={{ marginTop: 8 }}>
                {loading ? '로그인 상태를 확인하는 중입니다.' : fetching ? '예약 정보를 확인하는 중입니다.' : '관리자 로그인 후 예약을 확인하고 취소/환불 처리를 진행해 주세요.'}
              </p>
            </div>

            {error ? <p className="field-note" style={{ color: '#be123c', margin: 0 }}>{error}</p> : null}
            {resultMessage ? <p className="field-note" style={{ color: '#166534', margin: 0 }}>{resultMessage}</p> : null}

            {booking ? (
              <div className="reservation-result-card panel-sub">
                <div className="reservation-result-card__header">
                  <div>
                    <span className="reservation-result-card__eyebrow">관리자 확인</span>
                    <strong className="reservation-result-card__title">{booking.pricingSnapshot?.carName || booking.reservationNumber || '-'}</strong>
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
                  <div className="reservation-result-row"><span>차량번호</span><strong>{booking.carNumber || '-'}</strong></div>
                  <div className="reservation-result-row"><span>예약자</span><strong>{booking.customerName}</strong></div>
                  <div className="reservation-result-row"><span>휴대폰번호</span><strong>{booking.customerPhone}</strong></div>
                  <div className="reservation-result-row"><span>생년월일</span><strong>{booking.customerBirth}</strong></div>
                  <div className="reservation-result-row"><span>대여일시</span><strong>{booking.display.pickupAt}</strong></div>
                  <div className="reservation-result-row"><span>반납일시</span><strong>{booking.display.returnAt}</strong></div>
                  <div className="reservation-result-row"><span>배차/수령</span><strong>{booking.schedule.displayPickupLabel}</strong></div>
                  <div className="reservation-result-row"><span>결제상태</span><strong>{booking.paymentStatus === 'refunded' ? '환불 완료' : booking.paymentStatus === 'refund_pending' ? '환불 처리 중' : '결제 완료'}</strong></div>
                </div>
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canAdminCancel ? (
                <button className="btn btn-outline btn-md" type="button" onClick={handleCancel} disabled={submitting || fetching}>
                  {submitting ? '처리 중' : '예약 취소'}
                </button>
              ) : null}
              {canCompleteRefund ? (
                <button className="btn btn-dark btn-md" type="button" onClick={handleRefundComplete} disabled={submitting || fetching}>
                  {submitting ? '처리 중' : '환불 완료'}
                </button>
              ) : null}
              <Link className="btn btn-outline btn-md" to="/admin/bookings">관리자 예약목록</Link>
              <Link className="btn btn-outline btn-md" to="/">메인으로</Link>
            </div>
          </article>
        </div>
      </section>
    </PageShell>
  )
}
