import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageShell } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { isAdminUser } from '../utils/adminAccess'
import {
  getPricingHubPolicyEditor,
  listPricingHubGroups,
  savePricingHubEditor,
} from '../services/adminPricingHubApi'

function toNumber(value, fallback = 0) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function roundAmount(value) {
  return Math.max(0, Math.round(toNumber(value, 0)))
}

function roundPercent(value, fallback = 0) {
  const next = toNumber(value, fallback)
  return Math.max(0, Math.round(next * 100) / 100)
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`
}

const DEFAULT_PRICING_OPTION_TYPE = 'semi_premium'
const PRICING_OPTION_CONFIG = {
  basic: { hour1: 0.12, week1: 5.5, week2: 7.5, month1: 10.5 },
  semi_premium: { hour1: 0.12, week1: 5.5, week2: 8.0, month1: 12.0 },
  premium: { hour1: 0.14, week1: 6.5, week2: 9.0, month1: 14.0 },
}
const PRICING_OPTION_LABELS = {
  basic: '기본',
  semi_premium: '세미프리미엄',
  premium: '프리미엄',
}

function normalizePricingOptionType(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return PRICING_OPTION_CONFIG[normalized] ? normalized : DEFAULT_PRICING_OPTION_TYPE
}

function computeLegacyRatios(legacyPolicy) {
  const base24 = toNumber(legacyPolicy?.baseDailyPrice, 0)
  if (base24 <= 0) {
    return {
      fee6h: 0.55,
      fee12h: 0.8,
      long24hPrice: 1,
      long1hPrice: 0.04,
    }
  }

  return {
    fee6h: toNumber(legacyPolicy?.hour6Price, base24 * 0.55) / base24,
    fee12h: toNumber(legacyPolicy?.hour12Price, base24 * 0.8) / base24,
    long24hPrice: 1,
    long1hPrice: toNumber(legacyPolicy?.hour1Price, base24 * 0.1) / base24,
  }
}

function buildComputedRate(legacyPolicy, base24Input, weekdayRatePercentInput, weekendRatePercentInput, pricingOptionTypeInput) {
  const base24h = roundAmount(base24Input)
  const optionType = normalizePricingOptionType(pricingOptionTypeInput)
  const option = PRICING_OPTION_CONFIG[optionType]
  const legacyRatios = computeLegacyRatios(legacyPolicy)
  const weekdayRatePercent = roundPercent(weekdayRatePercentInput, toNumber(legacyPolicy?.weekdayRatePercent, 100))
  const weekendRatePercent = roundPercent(weekendRatePercentInput, toNumber(legacyPolicy?.weekendRatePercent, 100))
  const weekdayApplied24h = roundAmount(base24h * (weekdayRatePercent / 100))
  const weekendApplied24h = roundAmount(base24h * (weekendRatePercent / 100))

  return {
    pricingOptionType: optionType,
    base24h,
    weekdayRatePercent,
    weekendRatePercent,
    weekdayApplied24h,
    weekendApplied24h,
    fee6h: roundAmount(weekdayApplied24h * legacyRatios.fee6h),
    fee12h: roundAmount(weekdayApplied24h * legacyRatios.fee12h),
    fee1h: roundAmount(base24h * option.hour1),
    week1Price: roundAmount(base24h * option.week1),
    week2Price: roundAmount(base24h * option.week2),
    month1Price: roundAmount(base24h * option.month1),
    long24hPrice: roundAmount(weekdayApplied24h * legacyRatios.long24hPrice),
    long1hPrice: roundAmount(weekdayApplied24h * legacyRatios.long1hPrice),
  }
}

export default function AdminPricingHubPage() {
  const navigate = useNavigate()
  const { loading, isAuthenticated, session, user, profile } = useAuth()
  const [groups, setGroups] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState('')
  const [selectedPricePolicyGroupId, setSelectedPricePolicyGroupId] = useState('')
  const [editor, setEditor] = useState(null)
  const [editorLoading, setEditorLoading] = useState(false)
  const [editorError, setEditorError] = useState('')
  const [base24hInput, setBase24hInput] = useState('0')
  const [weekdayPercentInput, setWeekdayPercentInput] = useState(100)
  const [weekendPercentInput, setWeekendPercentInput] = useState(100)
  const [pricingOptionTypeInput, setPricingOptionTypeInput] = useState(DEFAULT_PRICING_OPTION_TYPE)
  const [saving, setSaving] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const selectionCardRef = useRef(null)

  const hasAdminHint = useMemo(() => isAdminUser(user) || isAdminUser(profile), [profile, user])
  const selectedGroup = groups.find((item) => item.pricePolicyGroupId === selectedPricePolicyGroupId) || null
  const selectedPolicy = editor?.policies?.[0] || null
  const originalBase24h = roundAmount(selectedPolicy?.legacyPolicy?.baseDailyPrice || 0)
  const computedPreview = useMemo(
    () => buildComputedRate(selectedPolicy?.legacyPolicy, base24hInput, weekdayPercentInput, weekendPercentInput, pricingOptionTypeInput),
    [selectedPolicy, base24hInput, weekdayPercentInput, weekendPercentInput, pricingOptionTypeInput],
  )

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login?redirectTo=/admin/pricing-hub', { replace: true })
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
      setGroupsLoading(false)
      return () => {
        ignore = true
      }
    }

    setGroupsLoading(true)
    listPricingHubGroups(session)
      .then((result) => {
        if (ignore) return
        const items = Array.isArray(result.items) ? result.items : []
        setGroups(items)
        setGroupsError('')
        if (!selectedPricePolicyGroupId && items[0]?.pricePolicyGroupId) {
          setSelectedPricePolicyGroupId(items[0].pricePolicyGroupId)
        }
      })
      .catch((error) => {
        if (ignore) return
        setGroups([])
        setGroupsError(error.message || '목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (ignore) return
        setGroupsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [session, hasAdminHint, selectedPricePolicyGroupId])

  useEffect(() => {
    let ignore = false
    if (!session?.access_token || !selectedPricePolicyGroupId) {
      setEditor(null)
      return () => {
        ignore = true
      }
    }

    setEditorLoading(true)
    getPricingHubPolicyEditor(session, { pricePolicyGroupId: selectedPricePolicyGroupId })
      .then((result) => {
        if (ignore) return
        setEditor(result)
        setEditorError('')
        const legacyPolicy = result?.policies?.[0]?.legacyPolicy || {}
        const editorState = result?.editorState || {}
        setBase24hInput(String(roundAmount(editorState.base24h || legacyPolicy.baseDailyPrice || 0)))
        setWeekdayPercentInput(roundPercent(editorState.weekdayPercent, toNumber(legacyPolicy.weekdayRatePercent, 100)))
        setWeekendPercentInput(roundPercent(editorState.weekendPercent, toNumber(legacyPolicy.weekendRatePercent, 100)))
        setPricingOptionTypeInput(normalizePricingOptionType(editorState.pricingOptionType || result?.group?.pricingOptionType))
        setSubmitMessage('')
      })
      .catch((error) => {
        if (ignore) return
        setEditor(null)
        setEditorError(error.message || '편집 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (ignore) return
        setEditorLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [session, selectedPricePolicyGroupId])

  useEffect(() => {
    if (!selectedPricePolicyGroupId || !selectionCardRef.current) return
    selectionCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedPricePolicyGroupId])

  function handlePercentChange(kind, value) {
    const nextValue = value === '' ? 0 : roundPercent(value, 0)
    if (kind === 'weekday') {
      setWeekdayPercentInput(nextValue)
      return
    }
    setWeekendPercentInput(nextValue)
  }

  function adjustPercent(kind, delta) {
    if (kind === 'weekday') {
      setWeekdayPercentInput((prev) => roundPercent(Math.max(0, toNumber(prev, 0) + delta), 0))
      return
    }
    setWeekendPercentInput((prev) => roundPercent(Math.max(0, toNumber(prev, 0) + delta), 0))
  }

  async function handleSave() {
    if (!session?.access_token || !selectedGroup || !selectedPolicy || saving) return

    setSaving(true)
    setSubmitMessage('')

    try {
      const payload = {
        pricePolicyGroupId: selectedGroup.pricePolicyGroupId,
        carGroupId: selectedGroup.carGroupId,
        pricingOptionType: computedPreview.pricingOptionType,
        base24h: computedPreview.base24h,
        weekdayPercent: computedPreview.weekdayRatePercent,
        weekendPercent: computedPreview.weekendRatePercent,
      }

      await savePricingHubEditor(session, payload)
      const [nextGroups, nextEditor] = await Promise.all([
        listPricingHubGroups(session),
        getPricingHubPolicyEditor(session, { pricePolicyGroupId: selectedGroup.pricePolicyGroupId }),
      ])

      setGroups(Array.isArray(nextGroups.items) ? nextGroups.items : [])
      setEditor(nextEditor)

      const legacyPolicy = nextEditor?.policies?.[0]?.legacyPolicy || {}
      const editorState = nextEditor?.editorState || {}
      setBase24hInput(String(roundAmount(editorState.base24h || legacyPolicy.baseDailyPrice || 0)))
      setWeekdayPercentInput(roundPercent(editorState.weekdayPercent, toNumber(legacyPolicy.weekdayRatePercent, 100)))
      setWeekendPercentInput(roundPercent(editorState.weekendPercent, toNumber(legacyPolicy.weekendRatePercent, 100)))
      setPricingOptionTypeInput(normalizePricingOptionType(editorState.pricingOptionType || nextEditor?.group?.pricingOptionType))
      setSubmitMessage('수정 내용이 저장되었습니다.')
    } catch (error) {
      setSubmitMessage(error.message || '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell>
      <section className="section-bg">
        <div className="container detail-layout" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <article className="detail-card panel" style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ margin: 0 }}>RENTCAR00 PRICING HUB</h1>
                <p className="small-note" style={{ marginTop: 8 }}>기준값, 가격그룹 옵션, 주중/주말 비율을 조정하고 저장합니다.</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link className="btn btn-outline btn-md" to="/admin/bookings">예약관리로</Link>
                <Link className="btn btn-outline btn-md" to="/">메인으로</Link>
              </div>
            </div>

            {groupsError ? <p className="field-note" style={{ color: '#be123c', margin: 0 }}>{groupsError}</p> : null}
            {editorError ? <p className="field-note" style={{ color: '#be123c', margin: 0 }}>{editorError}</p> : null}
            {submitMessage ? <p className="field-note" style={{ margin: 0 }}>{submitMessage}</p> : null}

            <div className="pricing-hub-layout" style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', alignItems: 'start' }}>
              <div className="panel-sub" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                <strong>가격그룹 / 정책 목록</strong>
                {groupsLoading ? <p className="field-note" style={{ margin: 0 }}>불러오는 중입니다.</p> : null}
                {!groupsLoading && groups.length === 0 ? <p className="field-note" style={{ margin: 0 }}>표시할 그룹이 없습니다.</p> : null}
                {groups.map((item) => (
                  <button
                    key={item.pricePolicyGroupId}
                    type="button"
                    className={`btn pricing-hub-group-card ${selectedPricePolicyGroupId === item.pricePolicyGroupId ? 'is-active' : ''}`}
                    onClick={() => setSelectedPricePolicyGroupId(item.pricePolicyGroupId)}
                  >
                    <div className="pricing-hub-group-card__head">
                      <span>{item.groupName} · {item.policyName}</span>
                      <span style={{ fontSize: 12, opacity: 0.75 }}>{PRICING_OPTION_LABELS[normalizePricingOptionType(item.pricingOptionType)]}</span>
                    </div>
                    <div className="pricing-hub-group-card__meta">
                      <span>주중24 <strong>{formatMoney(item.currentRateSummary?.weekday24h)}</strong></span>
                      <span>주말24 <strong>{formatMoney(item.currentRateSummary?.weekend24h)}</strong></span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pricing-hub-editor-column" style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
                <div ref={selectionCardRef} className="panel-sub" style={{ display: 'grid', gap: 8 }}>
                  <strong>선택 가격그룹</strong>
                  {selectedGroup ? (
                    <>
                      <div className="reservation-result-row"><span>IMS 그룹</span><strong>{selectedGroup.imsGroupId}</strong></div>
                      <div className="reservation-result-row"><span>그룹명</span><strong>{selectedGroup.groupName}</strong></div>
                      <div className="reservation-result-row"><span>기존 정책</span><strong>{selectedGroup.policyName}</strong></div>
                      <div className="reservation-result-row"><span>옵션</span><strong>{PRICING_OPTION_LABELS[normalizePricingOptionType(pricingOptionTypeInput)]}</strong></div>
                      <div className="reservation-result-row"><span>차량번호</span><strong className="pricing-hub-car-numbers">{editor?.group?.carNumbers?.length ? editor.group.carNumbers.join(', ') : '-'}</strong></div>
                    </>
                  ) : (
                    <p className="field-note" style={{ margin: 0 }}>그룹을 선택하세요.</p>
                  )}
                </div>

                <div className="panel-sub" style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <strong>기준값 조정</strong>
                    <button type="button" className="btn btn-dark btn-md" onClick={handleSave} disabled={!selectedPolicy || saving}>{saving ? '저장중' : '수정'}</button>
                  </div>
                  {editorLoading ? <p className="field-note" style={{ margin: 0 }}>편집 데이터를 불러오는 중입니다.</p> : null}
                  <div className="reservation-result-row">
                    <span>불러온 최초 기준금액</span>
                    <strong>{formatMoney(originalBase24h)}</strong>
                  </div>
                  <div className="reservation-result-row pricing-hub-adjust-row">
                    <span>가격그룹 옵션</span>
                    <select className="field-input" value={pricingOptionTypeInput} onChange={(e) => setPricingOptionTypeInput(normalizePricingOptionType(e.target.value))} disabled={!selectedPolicy || saving} style={{ maxWidth: 220 }}>
                      <option value="basic">기본</option>
                      <option value="semi_premium">세미프리미엄</option>
                      <option value="premium">프리미엄</option>
                    </select>
                  </div>
                  <div className="reservation-result-row pricing-hub-adjust-row">
                    <span>기준 24시간 금액</span>
                    <div className="pricing-hub-inline-controls pricing-hub-base-control">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setBase24hInput(String(Math.max(0, roundAmount(base24hInput) - 10000)))} disabled={!selectedPolicy || saving}>-</button>
                      <input className="field-input pricing-hub-base-input" type="number" inputMode="numeric" min="0" step="10000" value={base24hInput} onChange={(e) => setBase24hInput(e.target.value)} disabled={!selectedPolicy || saving} />
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setBase24hInput(String(roundAmount(base24hInput) + 10000))} disabled={!selectedPolicy || saving}>+</button>
                    </div>
                  </div>
                  <div className="reservation-result-row pricing-hub-adjust-row">
                    <span>주중 24시간 요금</span>
                    <div className="pricing-hub-inline-controls">
                      <strong>{formatMoney(computedPreview.weekdayApplied24h)}</strong>
                      <div className="pricing-hub-percent-control">
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => adjustPercent('weekday', -5)} disabled={!selectedPolicy || saving}>-</button>
                        <div className="pricing-hub-input-wrap">
                          <input className="field-input pricing-hub-percent-input" type="number" inputMode="decimal" min="0" step="5" value={weekdayPercentInput} onChange={(e) => handlePercentChange('weekday', e.target.value)} disabled={!selectedPolicy || saving} />
                          <span className="pricing-hub-percent-suffix">%</span>
                        </div>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => adjustPercent('weekday', 5)} disabled={!selectedPolicy || saving}>+</button>
                      </div>
                    </div>
                  </div>
                  <div className="reservation-result-row pricing-hub-adjust-row">
                    <span>주말 24시간 요금</span>
                    <div className="pricing-hub-inline-controls">
                      <strong>{formatMoney(computedPreview.weekendApplied24h)}</strong>
                      <div className="pricing-hub-percent-control">
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => adjustPercent('weekend', -5)} disabled={!selectedPolicy || saving}>-</button>
                        <div className="pricing-hub-input-wrap">
                          <input className="field-input pricing-hub-percent-input" type="number" inputMode="decimal" min="0" step="5" value={weekendPercentInput} onChange={(e) => handlePercentChange('weekend', e.target.value)} disabled={!selectedPolicy || saving} />
                          <span className="pricing-hub-percent-suffix">%</span>
                        </div>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => adjustPercent('weekend', 5)} disabled={!selectedPolicy || saving}>+</button>
                      </div>
                    </div>
                  </div>
                  <div className="reservation-result-row"><span>1시간</span><strong>{formatMoney(computedPreview.fee1h)}</strong></div>
                  <div className="reservation-result-row"><span>7일</span><strong>{formatMoney(computedPreview.week1Price)}</strong></div>
                  <div className="reservation-result-row"><span>14일</span><strong>{formatMoney(computedPreview.week2Price)}</strong></div>
                  <div className="reservation-result-row"><span>30일</span><strong>{formatMoney(computedPreview.month1Price)}</strong></div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    </PageShell>
  )
}
