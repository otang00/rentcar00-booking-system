import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { getAdminBookings } from '../services/adminBookingsApi'
import { isAdminUser } from '../utils/adminAccess'

const TAB_OPTIONS = [
  { key: 'active', label: '예약 확정' },
  { key: 'cancelled', label: '취소 / 환불' },
]

const QUERY_FIELD_OPTIONS = [
  { key: 'carNumber', label: '차량번호' },
  { key: 'reservationNumber', label: '예약번호' },
  { key: 'customerName', label: '고객명' },
]

function formatSyncDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function getSyncTone(status) {
  if (status === 'failed') return { bg: '#fff1f2', border: '#fecdd3', text: '#be123c' }
  if (status === 'partial_success') return { bg: '#fff7ed', border: '#fdba74', text: '#c2410c' }
  if (status === 'success') return { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' }
  if (status === 'running') return { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' }
  return { bg: '#f8fafc', border: '#e2e8f0', text: '#475569' }
}

function formatSyncStatusLabel(status) {
  if (status === 'success') return '성공'
  if (status === 'partial_success') return '부분성공'
  if (status === 'failed') return '실패'
  if (status === 'running') return '실행중'
  return status || '알수없음'
}

function buildSyncSummaryText(kind, sync, loading) {
  if (loading) {
    return kind === 'ims'
      ? 'IMS | 확인중 | -- | fetched - / upserted - | 오류 -'
      : 'ZZIMCAR | 확인중 | -- | add - / del - / chg - | 오류 -'
  }

  if (!sync) {
    return kind === 'ims'
      ? 'IMS | 이력없음 | -- | fetched - / upserted - | 오류 -'
      : 'ZZIMCAR | 이력없음 | -- | add - / del - / chg - | 오류 -'
  }

  if (kind === 'ims') {
    return `IMS | ${formatSyncStatusLabel(sync.status)} | ${formatSyncDateTime(sync.updatedAt)} | fetched ${sync.fetchedCount ?? 0} / upserted ${sync.upsertedCount ?? 0} | 오류 ${sync.failedCount ?? 0}`
  }

  return `ZZIMCAR | ${formatSyncStatusLabel(sync.status)} | ${formatSyncDateTime(sync.updatedAt)} | add ${sync.additionsCount ?? 0} / del ${sync.deletionsCount ?? 0} / chg ${sync.changesCount ?? 0} | 오류 ${sync.failedCount ?? 0}`
}

function SyncStatusRow({ sync, errors = [], loading = false, kind = 'ims' }) {
  const tone = getSyncTone(sync?.status)
  const summaryText = buildSyncSummaryText(kind, sync, loading)
  const hasErrors = !loading && errors.length > 0

  return (
    <div
      className="panel-sub"
      style={{
        display: 'grid',
        gap: 6,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        padding: '10px 12px',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: tone.text,
            flexShrink: 0,
          }}
        />
        <strong style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summaryText}</strong>
      </div>

      {hasErrors ? (
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>오류 {errors.length}건 보기</summary>
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            {sync?.errorSummary ? (
              <p className="field-note" style={{ margin: 0, color: tone.text }}>{sync.errorSummary}</p>
            ) : null}
            {errors.map((entry, index) => (
              <div key={`${entry.imsReservationId || entry.id || index}`} style={{ padding: '8px 10px', background: '#ffffffaa', borderRadius: 8 }}>
                {'stage' in entry ? (
                  <p className="field-note" style={{ margin: 0, color: '#7f1d1d' }}>
                    [{entry.stage || '-'}] {entry.imsReservationId || '-'} · {entry.errorMessage || '-'}
                  </p>
                ) : (
                  <p className="field-note" style={{ margin: 0, color: '#7f1d1d' }}>
                    [{entry.carNumber || '-'}] {entry.imsReservationId || '-'} · {entry.errorMessage || '-'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}

export default function AdminBookingsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { loading, isAuthenticated, session, user, profile } = useAuth()
  const [items, setItems] = useState([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [imsSync, setImsSync] = useState(null)
  const [imsSyncErrors, setImsSyncErrors] = useState([])
  const [zzimcarSync, setZzimcarSync] = useState(null)
  const [zzimcarSyncErrors, setZzimcarSyncErrors] = useState([])

  const tab = searchParams.get('tab') || 'active'
  const qField = searchParams.get('qField') || 'carNumber'
  const q = searchParams.get('q') || ''

  const adminLabel = profile?.phone || user?.user_metadata?.phone || user?.phone || profile?.email || user?.email || ''
  const hasAdminHint = useMemo(() => isAdminUser(user) || isAdminUser(profile), [profile, user])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login?redirectTo=/admin/bookings', { replace: true })
    }
  }, [loading, isAuthenticated, navigate])

  useEffect(() => {
    if (!loading && isAuthenticated && !hasAdminHint) {
      navigate('/', { replace: true })
    }
  }, [loading, isAuthenticated, hasAdminHint, navigate])

  useEffect(() => {
    let ignore = false

    if (!session?.access_token || !hasAdminHint) {
      setFetching(false)
      return () => {
        ignore = true
      }
    }

    setFetching(true)
    getAdminBookings(session, { tab, qField, q, page: 1, pageSize: 50 })
      .then((result) => {
        if (ignore) return
        setItems(result.items || [])
        setTotal(result.total || 0)
        setImsSync(result.imsSync || null)
        setImsSyncErrors(result.imsSyncErrors || [])
        setZzimcarSync(result.zzimcarSync || null)
        setZzimcarSyncErrors(result.zzimcarSyncErrors || [])
        setError('')
      })
      .catch((fetchError) => {
        if (ignore) return
        setItems([])
        setTotal(0)
        setImsSync(null)
        setImsSyncErrors([])
        setZzimcarSync(null)
        setZzimcarSyncErrors([])
        setError(fetchError.message || '관리자 예약 목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (ignore) return
        setFetching(false)
      })

    return () => {
      ignore = true
    }
  }, [session, tab, qField, q, hasAdminHint])

  function updateParams(next) {
    const nextParams = new URLSearchParams(searchParams)
    Object.entries(next).forEach(([key, value]) => {
      if (value == null || value === '') nextParams.delete(key)
      else nextParams.set(key, value)
    })
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <PageShell>
      <section className="section-bg">
        <div className="container detail-layout" style={{ paddingTop: 24, paddingBottom: 24 }}>
          {!loading && isAuthenticated && !hasAdminHint ? (
            <article className="detail-card panel" style={{ display: 'grid', gap: 16 }}>
              <div>
                <h1 style={{ margin: 0 }}>접근 제한</h1>
                <p className="small-note" style={{ marginTop: 8 }}>관리자 계정만 접근할 수 있습니다.</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link className="btn btn-outline btn-md" to="/">메인으로</Link>
              </div>
            </article>
          ) : null}

          {!loading && isAuthenticated && !hasAdminHint ? null : (
            <article className="detail-card panel" style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <h1 style={{ margin: 0 }}>예약관리</h1>
                  <p className="small-note" style={{ marginTop: 8 }}>
                    홈페이지 예약 원장을 확인하고 취소/환불 상태를 관리합니다.
                  </p>
                </div>
                {hasAdminHint ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link className="btn btn-outline btn-md" to="/admin/pricing-hub">통합 요금 관리</Link>
                  </div>
                ) : null}
              </div>

              {hasAdminHint ? (
                <div className="panel-sub" style={{ display: 'grid', gap: 8 }}>
                  <div className="reservation-result-row"><span>관리자 계정</span><strong>{adminLabel || '-'}</strong></div>
                  <div className="reservation-result-row"><span>표시 건수</span><strong>{fetching ? '불러오는 중' : `${total}건`}</strong></div>
                </div>
              ) : null}

              {hasAdminHint ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div>
                    <strong style={{ display: 'block', marginBottom: 6 }}>운영 동기화 패널</strong>
                    <p className="field-note" style={{ margin: 0 }}>IMS와 찜카 반영 상태를 압축형으로 표시합니다.</p>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <SyncStatusRow sync={imsSync} errors={imsSyncErrors} loading={fetching} kind="ims" />
                    <SyncStatusRow sync={zzimcarSync} errors={zzimcarSyncErrors} loading={fetching} kind="zzimcar" />
                  </div>
                </div>
              ) : null}

              <div className="tab-row" style={{ flexWrap: 'wrap' }}>
                {TAB_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    className={`btn btn-md ${tab === option.key ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => updateParams({ tab: option.key })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="panel-sub" style={{ display: 'grid', gap: 10 }}>
                <div className="form-grid">
                  <select className="field-select" value={qField} onChange={(e) => updateParams({ qField: e.target.value })}>
                    {QUERY_FIELD_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                  <input
                    className="field-input"
                    placeholder="검색어 입력"
                    value={q}
                    onChange={(e) => updateParams({ q: e.target.value })}
                  />
                </div>
                <p className="field-note">차량번호/고객명은 포함검색, 예약번호는 정확히 일치할 때 우선 찾습니다.</p>
              </div>

              {fetching ? <p className="field-note" style={{ margin: 0 }}>예약 목록을 불러오는 중입니다.</p> : null}
              {error ? <p className="field-note" style={{ color: '#be123c', margin: 0 }}>{error}</p> : null}

              {!fetching && !error && items.length === 0 ? (
                <div className="panel-sub" style={{ display: 'grid', gap: 8 }}>
                  <strong>표시할 예약이 없습니다.</strong>
                  <p className="field-note" style={{ margin: 0 }}>현재 조건에 맞는 예약이 없습니다.</p>
                </div>
              ) : null}

              {items.length > 0 ? (
                <div className="panel-sub" style={{ display: 'grid', gap: 16 }}>
                  {items.map((item) => {
                    const booking = item.booking
                    return (
                      <div key={item.id} className="reservation-result-card">
                        <div className="reservation-result-card__header">
                          <div>
                            <span className="reservation-result-card__eyebrow">{tab === 'cancelled' ? '취소 / 환불 예약' : '예약관리'}</span>
                            <strong className="reservation-result-card__title">
                              {booking.carNumber ? `${booking.carNumber} · ${booking.pricingSnapshot?.carName || '-'}` : booking.pricingSnapshot?.carName || booking.reservationNumber || '-'}
                            </strong>
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
                          <div className="reservation-result-row"><span>고객명</span><strong>{booking.customerName || '-'}</strong></div>
                          <div className="reservation-result-row"><span>대여일시</span><strong>{booking.display.pickupAt}</strong></div>
                          <div className="reservation-result-row"><span>반납일시</span><strong>{booking.display.returnAt}</strong></div>
                          <div className="reservation-result-row"><span>결제상태</span><strong>{booking.paymentStatus === 'paid' ? '결제 완료' : booking.paymentStatus === 'refund_pending' ? '환불 처리 중' : booking.paymentStatus === 'refunded' ? '환불 완료' : '상태 확인 필요'}</strong></div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Link className="btn btn-outline btn-md" to={item.detailPath || '/admin/booking-confirm'}>
                            상세 확인
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link className="btn btn-outline btn-md" to="/">메인으로</Link>
              </div>
            </article>
          )}
        </div>
      </section>
    </PageShell>
  )
}
