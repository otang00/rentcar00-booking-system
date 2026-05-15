import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { listDeliveryRegions, saveDeliveryRegion } from '../services/adminPricingHubApi'
import { isAdminUser } from '../utils/adminAccess'

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`
}

function normalizePriceInput(value) {
  const next = Number(String(value || '').replace(/[^0-9]/g, ''))
  return Number.isFinite(next) ? next : 0
}

export default function AdminDeliveryRegionsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { loading, isAuthenticated, session, user, profile } = useAuth()
  const [items, setItems] = useState([])
  const [fetching, setFetching] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [drafts, setDrafts] = useState({})

  const q = searchParams.get('q') || ''
  const active = searchParams.get('active') || 'all'
  const hasAdminHint = useMemo(() => isAdminUser(user) || isAdminUser(profile), [profile, user])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login?redirectTo=/admin/delivery-regions', { replace: true })
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
    listDeliveryRegions(session, { q, active: active === 'all' ? '' : active })
      .then((result) => {
        if (ignore) return
        const nextItems = result.items || []
        setItems(nextItems)
        setDrafts(nextItems.reduce((acc, item) => {
          acc[item.id] = {
            roundTripPrice: String(item.roundTripPrice ?? 0),
            active: item.active !== false,
          }
          return acc
        }, {}))
        setError('')
      })
      .catch((fetchError) => {
        if (ignore) return
        setItems([])
        setDrafts({})
        setError(fetchError.message || '딜리버리 배송비 목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (ignore) return
        setFetching(false)
      })

    return () => {
      ignore = true
    }
  }, [session, q, active, hasAdminHint])

  function updateParams(next) {
    const nextParams = new URLSearchParams(searchParams)
    Object.entries(next).forEach(([key, value]) => {
      if (value == null || value === '') nextParams.delete(key)
      else nextParams.set(key, value)
    })
    setSearchParams(nextParams, { replace: true })
  }

  function updateDraft(id, patch) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        ...patch,
      },
    }))
  }

  async function handleSave(item) {
    const draft = drafts[item.id] || {}
    const roundTripPrice = normalizePriceInput(draft.roundTripPrice)
    const activeValue = draft.active !== false

    setSavingId(item.id)
    setMessage('')
    setError('')

    try {
      const result = await saveDeliveryRegion(session, {
        id: item.id,
        dongId: item.dongId,
        roundTripPrice,
        active: activeValue,
      })
      const saved = result.item
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? saved : entry)))
      setDrafts((prev) => ({
        ...prev,
        [item.id]: {
          roundTripPrice: String(saved.roundTripPrice ?? 0),
          active: saved.active !== false,
        },
      }))
      setMessage(`${saved.fullLabel || item.fullLabel} 저장 완료`)
    } catch (saveError) {
      setError(saveError.message || '딜리버리 배송비 저장에 실패했습니다.')
    } finally {
      setSavingId('')
    }
  }

  return (
    <PageShell>
      <section className="section-bg">
        <div className="container" style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <p className="eyebrow">ADMIN DELIVERY</p>
              <h1 className="section-title">딜리버리 배송비 관리</h1>
              <p className="section-subtitle">지역별 왕복 배송비와 노출 상태를 관리합니다.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link className="btn btn-outline btn-sm" to="/admin/bookings">예약관리</Link>
              <Link className="btn btn-outline btn-sm" to="/admin/pricing-hub">가격허브</Link>
            </div>
          </div>

          <div className="panel-card" style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 160px auto', gap: 8 }}>
              <input
                className="form-input"
                value={q}
                onChange={(event) => updateParams({ q: event.target.value })}
                placeholder="시/구/동/동ID 검색"
              />
              <select className="form-input" value={active} onChange={(event) => updateParams({ active: event.target.value })}>
                <option value="all">전체</option>
                <option value="true">활성</option>
                <option value="false">비활성</option>
              </select>
              <button className="btn btn-outline btn-md" type="button" onClick={() => updateParams({ q: '', active: 'all' })}>
                초기화
              </button>
            </div>
            <p className="field-note" style={{ margin: 0 }}>
              총 {items.length.toLocaleString('ko-KR')}건 · 지역 식별자(province/city/dong id)는 수정하지 않습니다.
            </p>
          </div>

          {message ? <div className="notice success">{message}</div> : null}
          {error ? <div className="notice error">{error}</div> : null}

          <div className="panel-card" style={{ overflowX: 'auto' }}>
            {fetching ? (
              <p className="field-note">딜리버리 배송비 목록을 불러오는 중입니다...</p>
            ) : (
              <table className="admin-table" style={{ minWidth: 860, width: '100%' }}>
                <thead>
                  <tr>
                    <th>지역</th>
                    <th>동ID</th>
                    <th>현재 왕복</th>
                    <th>수정 왕복</th>
                    <th>상태</th>
                    <th>저장</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const draft = drafts[item.id] || { roundTripPrice: String(item.roundTripPrice || 0), active: item.active !== false }
                    const normalizedDraftPrice = normalizePriceInput(draft.roundTripPrice)
                    const changed = normalizedDraftPrice !== Number(item.roundTripPrice || 0) || (draft.active !== false) !== (item.active !== false)
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.fullLabel}</strong>
                          <p className="field-note" style={{ margin: '4px 0 0' }}>{item.provinceName} / {item.cityName} / {item.dongName}</p>
                        </td>
                        <td>{item.dongId}</td>
                        <td>{formatMoney(item.roundTripPrice)}</td>
                        <td>
                          <input
                            className="form-input"
                            inputMode="numeric"
                            value={draft.roundTripPrice}
                            onChange={(event) => updateDraft(item.id, { roundTripPrice: event.target.value })}
                            style={{ minWidth: 120 }}
                          />
                        </td>
                        <td>
                          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                            <input
                              type="checkbox"
                              checked={draft.active !== false}
                              onChange={(event) => updateDraft(item.id, { active: event.target.checked })}
                            />
                            {draft.active !== false ? '활성' : '비활성'}
                          </label>
                        </td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            type="button"
                            disabled={!changed || savingId === item.id}
                            onClick={() => handleSave(item)}
                          >
                            {savingId === item.id ? '저장중' : '저장'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: 24 }}>검색 결과가 없습니다.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  )
}
