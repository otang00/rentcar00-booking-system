import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AdminNav } from '../components/AdminNav'
import { PageShell } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { listDeliveryRegions, saveDeliveryRegion, saveDeliveryRegionsBulk } from '../services/adminPricingHubApi'
import { isAdminUser } from '../utils/adminAccess'

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`
}

function normalizePriceInput(value) {
  const next = Number(String(value || '').replace(/[^0-9]/g, ''))
  return Number.isFinite(next) ? next : 0
}

function groupDeliveryRegions(items = []) {
  const provinceMap = new Map()

  for (const item of items) {
    const provinceKey = String(item.provinceId)
    const cityKey = `${item.provinceId}:${item.cityId}`

    if (!provinceMap.has(provinceKey)) {
      provinceMap.set(provinceKey, {
        key: provinceKey,
        provinceId: item.provinceId,
        provinceName: item.provinceName,
        items: [],
        cityMap: new Map(),
      })
    }

    const province = provinceMap.get(provinceKey)
    province.items.push(item)

    if (!province.cityMap.has(cityKey)) {
      province.cityMap.set(cityKey, {
        key: cityKey,
        cityId: item.cityId,
        cityName: item.cityName,
        items: [],
      })
    }

    province.cityMap.get(cityKey).items.push(item)
  }

  return Array.from(provinceMap.values()).map((province) => ({
    ...province,
    cities: Array.from(province.cityMap.values()),
  }))
}

function summarizeGroup(items = []) {
  const prices = [...new Set(items.map((item) => Number(item.roundTripPrice || 0)))]
  const activeCount = items.filter((item) => item.active !== false).length
  return {
    priceLabel: prices.length === 1 ? formatMoney(prices[0]) : `${prices.length}개 요금`,
    activeLabel: `${activeCount}/${items.length} 활성`,
  }
}

export default function AdminDeliveryRegionsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { loading, isAuthenticated, session, user, profile } = useAuth()
  const [items, setItems] = useState([])
  const [fetching, setFetching] = useState(true)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [drafts, setDrafts] = useState({})
  const [bulkDrafts, setBulkDrafts] = useState({})
  const [expandedProvinces, setExpandedProvinces] = useState({})
  const [expandedCities, setExpandedCities] = useState({})

  const q = searchParams.get('q') || ''
  const active = searchParams.get('active') || 'all'
  const hasAdminHint = useMemo(() => isAdminUser(user) || isAdminUser(profile), [profile, user])
  const groupedItems = useMemo(() => groupDeliveryRegions(items), [items])

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
        setBulkDrafts({})
        setError('')
      })
      .catch((fetchError) => {
        if (ignore) return
        setItems([])
        setDrafts({})
        setBulkDrafts({})
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

  function updateBulkDraft(key, patch) {
    setBulkDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        ...patch,
      },
    }))
  }

  function toggleProvince(key) {
    setExpandedProvinces((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleCity(key) {
    setExpandedCities((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function updateSavedItems(savedItems = []) {
    const savedById = new Map(savedItems.map((item) => [item.id, item]))
    setItems((prev) => prev.map((entry) => savedById.get(entry.id) || entry))
    setDrafts((prev) => {
      const next = { ...prev }
      for (const item of savedItems) {
        next[item.id] = {
          roundTripPrice: String(item.roundTripPrice ?? 0),
          active: item.active !== false,
        }
      }
      return next
    })
  }

  async function handleSaveDong(item) {
    const draft = drafts[item.id] || {}
    const roundTripPrice = normalizePriceInput(draft.roundTripPrice)
    const activeValue = draft.active !== false

    setSavingKey(`dong:${item.id}`)
    setMessage('')
    setError('')

    try {
      const result = await saveDeliveryRegion(session, {
        id: item.id,
        dongId: item.dongId,
        roundTripPrice,
        active: activeValue,
      })
      updateSavedItems([result.item])
      setMessage(`${result.item.fullLabel || item.fullLabel} 저장 완료`)
    } catch (saveError) {
      setError(saveError.message || '딜리버리 배송비 저장에 실패했습니다.')
    } finally {
      setSavingKey('')
    }
  }

  async function handleSaveBulk({ key, label, targetItems }) {
    const draft = bulkDrafts[key] || {}
    const roundTripPrice = normalizePriceInput(draft.roundTripPrice)
    const activeValue = draft.active !== false
    const dongIds = targetItems.map((item) => item.dongId).filter(Boolean)

    if (dongIds.length === 0) return

    setSavingKey(`bulk:${key}`)
    setMessage('')
    setError('')

    try {
      const result = await saveDeliveryRegionsBulk(session, {
        dongIds,
        roundTripPrice,
        active: activeValue,
      })
      const savedItems = result.items || []
      updateSavedItems(savedItems)
      setBulkDrafts((prev) => ({
        ...prev,
        [key]: { roundTripPrice: String(roundTripPrice), active: activeValue },
      }))
      setMessage(`${label} ${savedItems.length.toLocaleString('ko-KR')}건 일괄 저장 완료`)
    } catch (saveError) {
      setError(saveError.message || '딜리버리 배송비 일괄 저장에 실패했습니다.')
    } finally {
      setSavingKey('')
    }
  }

  function renderBulkControls({ key, label, targetItems }) {
    const summary = summarizeGroup(targetItems)
    const draft = bulkDrafts[key] || { roundTripPrice: '', active: true }
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="field-note" style={{ margin: 0 }}>{summary.priceLabel} · {summary.activeLabel}</span>
        <input
          className="form-input"
          inputMode="numeric"
          value={draft.roundTripPrice}
          onChange={(event) => updateBulkDraft(key, { roundTripPrice: event.target.value })}
          placeholder="왕복요금"
          style={{ width: 110 }}
        />
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
          <input
            type="checkbox"
            checked={draft.active !== false}
            onChange={(event) => updateBulkDraft(key, { active: event.target.checked })}
          />
          활성
        </label>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          disabled={savingKey === `bulk:${key}` || !String(draft.roundTripPrice || '').trim()}
          onClick={() => handleSaveBulk({ key, label, targetItems })}
        >
          {savingKey === `bulk:${key}` ? '저장중' : '하위 전체 적용'}
        </button>
      </div>
    )
  }

  return (
    <PageShell>
      <section className="section-bg">
        <div className="container" style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <p className="eyebrow">ADMIN DELIVERY</p>
              <h1 className="section-title">딜리버리 배송비 관리</h1>
              <p className="section-subtitle">시/도 → 구/시 → 동 단위로 펼쳐서 왕복 배송비와 노출 상태를 관리합니다.</p>
            </div>
            <Link className="btn btn-outline btn-sm" to="/">메인으로</Link>
          </div>

          <AdminNav />

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
              총 {items.length.toLocaleString('ko-KR')}건 · 시/도 또는 구/시에서 하위 전체 적용이 가능합니다.
            </p>
          </div>

          {message ? <div className="notice success">{message}</div> : null}
          {error ? <div className="notice error">{error}</div> : null}

          <div className="panel-card" style={{ display: 'grid', gap: 10 }}>
            {fetching ? (
              <p className="field-note">딜리버리 배송비 목록을 불러오는 중입니다...</p>
            ) : groupedItems.length === 0 ? (
              <p className="field-note">검색 결과가 없습니다.</p>
            ) : groupedItems.map((province) => {
              const provinceOpen = Boolean(expandedProvinces[province.key])
              return (
                <div key={province.key} style={{ border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: 12, background: '#f8fafc', flexWrap: 'wrap' }}>
                    <button className="btn btn-outline btn-sm" type="button" onClick={() => toggleProvince(province.key)} style={{ minWidth: 160, justifyContent: 'flex-start' }}>
                      {provinceOpen ? '▼' : '▶'} {province.provinceName}
                    </button>
                    {renderBulkControls({ key: `province:${province.provinceId}`, label: province.provinceName, targetItems: province.items })}
                  </div>

                  {provinceOpen ? (
                    <div style={{ display: 'grid', gap: 8, padding: 10 }}>
                      {province.cities.map((city) => {
                        const cityOpen = Boolean(expandedCities[city.key])
                        return (
                          <div key={city.key} style={{ border: '1px solid #eef2f7', borderRadius: 12, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: 10, background: '#fff', flexWrap: 'wrap' }}>
                              <button className="btn btn-outline btn-sm" type="button" onClick={() => toggleCity(city.key)} style={{ minWidth: 150, justifyContent: 'flex-start' }}>
                                {cityOpen ? '▼' : '▶'} {city.cityName}
                              </button>
                              {renderBulkControls({ key: `city:${city.cityId}`, label: `${province.provinceName} ${city.cityName}`, targetItems: city.items })}
                            </div>

                            {cityOpen ? (
                              <div style={{ display: 'grid', gap: 6, padding: 10, background: '#f9fafb' }}>
                                {city.items.map((item) => {
                                  const draft = drafts[item.id] || { roundTripPrice: String(item.roundTripPrice || 0), active: item.active !== false }
                                  const normalizedDraftPrice = normalizePriceInput(draft.roundTripPrice)
                                  const changed = normalizedDraftPrice !== Number(item.roundTripPrice || 0) || (draft.active !== false) !== (item.active !== false)
                                  return (
                                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) 90px 130px 110px auto', gap: 8, alignItems: 'center', padding: 8, borderRadius: 10, background: '#fff' }}>
                                      <div>
                                        <strong>{item.dongName}</strong>
                                        <p className="field-note" style={{ margin: '3px 0 0' }}>동ID {item.dongId} · 현재 {formatMoney(item.roundTripPrice)}</p>
                                      </div>
                                      <span className="field-note" style={{ margin: 0 }}>{item.active !== false ? '활성' : '비활성'}</span>
                                      <input
                                        className="form-input"
                                        inputMode="numeric"
                                        value={draft.roundTripPrice}
                                        onChange={(event) => updateDraft(item.id, { roundTripPrice: event.target.value })}
                                      />
                                      <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                                        <input
                                          type="checkbox"
                                          checked={draft.active !== false}
                                          onChange={(event) => updateDraft(item.id, { active: event.target.checked })}
                                        />
                                        활성
                                      </label>
                                      <button
                                        className="btn btn-primary btn-sm"
                                        type="button"
                                        disabled={!changed || savingKey === `dong:${item.id}`}
                                        onClick={() => handleSaveDong(item)}
                                      >
                                        {savingKey === `dong:${item.id}` ? '저장중' : '저장'}
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </PageShell>
  )
}
