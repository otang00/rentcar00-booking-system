import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { cancelAdminBooking, changeAdminBooking, completeAdminBookingRefund, fetchAdminBookingChangeCarCandidates, fetchAdminBookingConfirm } from '../services/adminBookingConfirmApi'
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
  const canChangeBooking = hasAdminHint && String(booking?.bookingStatus || '') === 'confirmed'
  const [changeOpen, setChangeOpen] = useState(false)
  const [changeType, setChangeType] = useState('date')
  const [changeDraft, setChangeDraft] = useState({
    deliveryDateTime: '',
    returnDateTime: '',
    sourceCarId: '',
    reason: '',
  })
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('')
  const [vehicleCandidates, setVehicleCandidates] = useState([])
  const [vehicleSearchLoading, setVehicleSearchLoading] = useState(false)
  const [vehicleSearchError, setVehicleSearchError] = useState('')
  const [selectedChangeCar, setSelectedChangeCar] = useState(null)

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

  useEffect(() => {
    if (!booking) return
    setChangeDraft((current) => ({
      ...current,
      deliveryDateTime: String(booking.schedule?.deliveryDateTime || '').replace(' ', 'T'),
      returnDateTime: String(booking.schedule?.returnDateTime || '').replace(' ', 'T'),
      sourceCarId: '',
    }))
    setVehicleSearchQuery('')
    setVehicleCandidates([])
    setSelectedChangeCar(null)
    setVehicleSearchError('')
  }, [booking?.id])

  function updateChangeDraft(next) {
    setChangeDraft((current) => ({ ...current, ...next }))
  }

  function handleChangeTypeSelect(nextType) {
    setChangeType(nextType)
    setVehicleSearchError('')
    if (nextType === 'date') {
      setVehicleSearchQuery('')
      setVehicleCandidates([])
      setSelectedChangeCar(null)
      updateChangeDraft({ sourceCarId: '' })
    }
  }

  async function handleVehicleSearch() {
    if (!token || !session?.access_token || !hasAdminHint || changeType === 'date') return
    const query = vehicleSearchQuery.trim()
    if (query.length < 2) {
      setVehicleSearchError('차량번호나 차량명을 2글자 이상 입력해 주세요.')
      return
    }

    setVehicleSearchLoading(true)
    setVehicleSearchError('')
    try {
      const result = await fetchAdminBookingChangeCarCandidates(session, token, {
        q: query,
        deliveryDateTime: changeDraft.deliveryDateTime,
        returnDateTime: changeDraft.returnDateTime,
      })
      setVehicleCandidates(result.items)
      if (result.items.length === 0) {
        setVehicleSearchError('검색된 차량이 없습니다.')
      }
    } catch (searchError) {
      setVehicleSearchError(searchError.message || '차량 검색에 실패했습니다.')
    } finally {
      setVehicleSearchLoading(false)
    }
  }

  function selectChangeCar(candidate) {
    setSelectedChangeCar(candidate)
    updateChangeDraft({ sourceCarId: candidate?.sourceCarId || '' })
  }

  async function handleChangeSubmit() {
    if (!token || !canChangeBooking || submitting || !session?.access_token || !hasAdminHint) return

    if (changeType !== 'date' && !changeDraft.sourceCarId) {
      setError('변경할 차량을 검색해서 선택해 주세요.')
      return
    }

    const confirmed = window.confirm('예약 날짜/차량을 변경합니다. 결제/환불은 자동 처리되지 않습니다.')
    if (!confirmed) return

    setSubmitting(true)
    try {
      const result = await changeAdminBooking(session, token, {
        changeType,
        deliveryDateTime: changeDraft.deliveryDateTime,
        returnDateTime: changeDraft.returnDateTime,
        sourceCarId: changeType === 'date' ? '' : changeDraft.sourceCarId,
        reason: changeDraft.reason,
      })
      setBooking(result.booking)
      setResultMessage('예약이 변경되었습니다. 고객 예약조회에는 변경된 현재 예약 정보가 표시됩니다.')
      setChangeOpen(false)
      setError('')
    } catch (changeError) {
      setError(changeError.message || '예약 변경에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

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


                {canChangeBooking && changeOpen ? (
                  <div className="panel-sub" style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                    <strong>예약 변경</strong>
                    <p className="field-note" style={{ margin: 0 }}>관리자 내부용입니다. 고객에게 변경 버튼은 노출하지 않고, 저장 후 고객 예약조회에는 변경된 현재 예약 정보만 표시됩니다.</p>
                    <div className="tab-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className={`btn btn-tab btn-sm ${changeType === 'date' ? 'is-active' : ''}`} type="button" onClick={() => handleChangeTypeSelect('date')}>날짜 변경</button>
                      <button className={`btn btn-tab btn-sm ${changeType === 'car' ? 'is-active' : ''}`} type="button" onClick={() => handleChangeTypeSelect('car')}>차량 변경</button>
                      <button className={`btn btn-tab btn-sm ${changeType === 'date_car' ? 'is-active' : ''}`} type="button" onClick={() => handleChangeTypeSelect('date_car')}>날짜+차량</button>
                    </div>
                    <div className="form-grid">
                      <label className="field-group">
                        <span className="field-label">새 대여일시</span>
                        <input className="field-input" type="datetime-local" value={changeDraft.deliveryDateTime} onChange={(event) => updateChangeDraft({ deliveryDateTime: event.target.value })} />
                      </label>
                      <label className="field-group">
                        <span className="field-label">새 반납일시</span>
                        <input className="field-input" type="datetime-local" value={changeDraft.returnDateTime} onChange={(event) => updateChangeDraft({ returnDateTime: event.target.value })} />
                      </label>
                    </div>
                    {changeType !== 'date' ? (
                      <div className="field-group" style={{ display: 'grid', gap: 8 }}>
                        <span className="field-label">새 차량 검색</span>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <input className="field-input" style={{ flex: '1 1 220px' }} placeholder="차량번호/차량명/차량ID 검색" value={vehicleSearchQuery} onChange={(event) => setVehicleSearchQuery(event.target.value)} />
                          <button className="btn btn-outline btn-md" type="button" onClick={handleVehicleSearch} disabled={vehicleSearchLoading || submitting}>{vehicleSearchLoading ? '검색 중' : '검색'}</button>
                        </div>
                        {vehicleSearchError ? <span className="field-note" style={{ color: '#be123c' }}>{vehicleSearchError}</span> : null}
                        {selectedChangeCar ? (
                          <div className="reservation-result-row"><span>선택 차량</span><strong>{selectedChangeCar.carNumber || '-'} · {selectedChangeCar.carName || '-'} · ID {selectedChangeCar.sourceCarId || '-'}</strong></div>
                        ) : <span className="field-note">검색 결과에서 차량을 선택해야 저장할 수 있습니다.</span>}
                        {vehicleCandidates.length > 0 ? (
                          <div style={{ display: 'grid', gap: 6 }}>
                            {vehicleCandidates.map((candidate) => (
                              <button key={`${candidate.sourceCarId || candidate.id}`} className={`btn btn-sm ${selectedChangeCar?.sourceCarId === candidate.sourceCarId ? 'btn-dark' : 'btn-outline'}`} type="button" onClick={() => selectChangeCar(candidate)} disabled={!candidate.available}>
                                {candidate.carNumber || '-'} · {candidate.carName || '-'} · ID {candidate.sourceCarId || '-'} {candidate.available ? '' : `(예약겹침 ${candidate.conflicts.bookingOrders + candidate.conflicts.imsReservations}건)`}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <label className="field-group">
                      <span className="field-label">변경 사유</span>
                      <input className="field-input" placeholder="예: 고객 날짜 변경 요청" value={changeDraft.reason} onChange={(event) => updateChangeDraft({ reason: event.target.value })} />
                    </label>
                    <div className="panel-sub" style={{ display: 'grid', gap: 6 }}>
                      <strong>저장 전 확인</strong>
                      <div className="reservation-result-row"><span>현재 일정</span><strong>{booking.display.pickupAt} ~ {booking.display.returnAt}</strong></div>
                      <div className="reservation-result-row"><span>변경 일정</span><strong>{changeDraft.deliveryDateTime || '-'} ~ {changeDraft.returnDateTime || '-'}</strong></div>
                      <div className="reservation-result-row"><span>현재 차량</span><strong>{booking.carNumber || '-'} · {booking.pricingSnapshot?.carName || '-'}</strong></div>
                      <div className="reservation-result-row"><span>변경 차량</span><strong>{changeType === 'date' ? '기존 차량 유지' : selectedChangeCar ? `${selectedChangeCar.carNumber || '-'} · ${selectedChangeCar.carName || '-'}` : '미선택'}</strong></div>
                      <p className="field-note" style={{ margin: 0 }}>결제/환불/차액 정산은 자동 처리하지 않습니다. 금액 기준은 다음 phase에서 서버 정책으로 정리합니다.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-dark btn-md" type="button" onClick={handleChangeSubmit} disabled={submitting || fetching || (changeType !== 'date' && !changeDraft.sourceCarId)}>{submitting ? '저장 중' : '변경 저장'}</button>
                      <button className="btn btn-outline btn-md" type="button" onClick={() => setChangeOpen(false)} disabled={submitting}>닫기</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canChangeBooking ? (
                <button className="btn btn-dark btn-md" type="button" onClick={() => setChangeOpen((value) => !value)} disabled={submitting || fetching}>
                  예약 변경
                </button>
              ) : null}
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
