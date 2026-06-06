import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageShell } from '../components/Layout'
import { AdminNav } from '../components/AdminNav'
import { useAuth } from '../hooks/useAuth'
import { isAdminUser } from '../utils/adminAccess'
import {
  getPricingHubPolicyEditor,
  listPricingHubGroups,
  savePricingHubEditor,
} from '../services/adminPricingHubApi'

function toNumber(value, fallback = 0) {
  const next = Number(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(next) ? next : fallback
}

function roundAmount(value) {
  return Math.max(0, Math.round(toNumber(value, 0)))
}

function roundUpToThousand(value) {
  return Math.max(0, Math.ceil(toNumber(value, 0) / 1000) * 1000)
}

function roundDownToTenThousand(value) {
  return Math.max(0, Math.floor(toNumber(value, 0) / 10000) * 10000)
}

function roundPercent(value, fallback = 0) {
  const next = toNumber(value, fallback)
  return Math.max(0, Math.round(next * 100) / 100)
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`
}

function formatShortMoney(value) {
  const amount = roundAmount(value)
  if (amount >= 10000) return `${Math.round(amount / 1000).toLocaleString('ko-KR')}k`
  return amount.toLocaleString('ko-KR')
}

const DEFAULT_PRICING_OPTION_TYPE = 'semi_premium'
const DEFAULT_WEEKDAY_PERCENT = 90
const DEFAULT_WEEKEND_PERCENT = 115
const PRICING_OPTION_CONFIG = {
  basic: { hour1: 0.12, week1: 5.5, week2: 7.5, month1: 9.0 },
  semi_premium: { hour1: 0.12, week1: 5.5, week2: 8.0, month1: 11.0 },
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
  const base24h = roundUpToThousand(base24Input)
  const optionType = normalizePricingOptionType(pricingOptionTypeInput)
  const option = PRICING_OPTION_CONFIG[optionType]
  const legacyRatios = computeLegacyRatios(legacyPolicy)
  const weekdayRatePercent = roundPercent(weekdayRatePercentInput, DEFAULT_WEEKDAY_PERCENT)
  const weekendRatePercent = roundPercent(weekendRatePercentInput, DEFAULT_WEEKEND_PERCENT)
  const weekdayApplied24h = roundUpToThousand(base24h * (weekdayRatePercent / 100))
  const weekendApplied24h = roundUpToThousand(base24h * (weekendRatePercent / 100))

  return {
    pricingOptionType: optionType,
    base24h,
    weekdayRatePercent,
    weekendRatePercent,
    weekdayApplied24h,
    weekendApplied24h,
    fee6h: roundUpToThousand(weekdayApplied24h * legacyRatios.fee6h),
    fee12h: roundUpToThousand(weekdayApplied24h * legacyRatios.fee12h),
    fee1h: roundUpToThousand(base24h * option.hour1),
    week1Price: roundDownToTenThousand(base24h * option.week1),
    week2Price: roundDownToTenThousand(base24h * option.week2),
    month1Price: roundDownToTenThousand(base24h * option.month1),
    long24hPrice: roundUpToThousand(weekdayApplied24h * legacyRatios.long24hPrice),
    long1hPrice: roundUpToThousand(weekdayApplied24h * legacyRatios.long1hPrice),
  }
}

function sortGroupsByPrice(items = []) {
  return [...items].sort((a, b) => {
    if (a.groupSettingActive !== b.groupSettingActive) return a.groupSettingActive ? -1 : 1
    const aValue = toNumber(a?.currentRateSummary?.weekday24h, toNumber(a?.currentVariables?.base24h, 0))
    const bValue = toNumber(b?.currentRateSummary?.weekday24h, toNumber(b?.currentVariables?.base24h, 0))
    if (aValue !== bValue) return aValue - bValue
    return String(a?.groupName || '').localeCompare(String(b?.groupName || ''), 'ko')
  })
}

function hasChanged(current, next) {
  if (!current || !next) return false
  return roundAmount(current.base24h) !== roundAmount(next.base24h)
    || roundPercent(current.weekdayPercent, DEFAULT_WEEKDAY_PERCENT) !== roundPercent(next.weekdayRatePercent, DEFAULT_WEEKDAY_PERCENT)
    || roundPercent(current.weekendPercent, DEFAULT_WEEKEND_PERCENT) !== roundPercent(next.weekendRatePercent, DEFAULT_WEEKEND_PERCENT)
    || normalizePricingOptionType(current.pricingOptionType) !== normalizePricingOptionType(next.pricingOptionType)
}

function StatusBadge({ active }) {
  return <span className={`pricing-admin-pill ${active ? 'is-green' : 'is-red'}`}>{active ? '활성' : '비활성'}</span>
}

function MetricCard({ label, value, tone = '' }) {
  return (
    <div className={`pricing-admin-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PreviewCard({ label, value }) {
  return (
    <div className="pricing-admin-preview-card">
      <span>{label}</span>
      <strong>{formatMoney(value)}</strong>
    </div>
  )
}

function MoneyControl({ label, value, unit = '원', stepLabels, onChange, onStep, disabled }) {
  return (
    <div className="pricing-admin-control-card">
      <label>
        <span>{label}</span>
        <small>{unit === '%' ? '비율 직접 입력' : '1,000원 단위 저장'}</small>
      </label>
      <div className="pricing-admin-big-input-row">
        <input
          className={`pricing-admin-big-input ${unit === '%' ? 'is-percent' : ''}`}
          type="number"
          inputMode={unit === '%' ? 'decimal' : 'numeric'}
          min="0"
          step={unit === '%' ? '1' : '1000'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
        <strong>{unit}</strong>
      </div>
      <div className="pricing-admin-step-row">
        {stepLabels.map((item) => (
          <button key={item.label} type="button" className="btn btn-outline btn-sm" onClick={() => onStep(item.value)} disabled={disabled}>{item.label}</button>
        ))}
      </div>
    </div>
  )
}

export default function AdminPricingHubPage() {
  const navigate = useNavigate()
  const { loading, isAuthenticated, session, user, profile } = useAuth()
  const [groups, setGroups] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState('')
  const [selectedPricePolicyGroupId, setSelectedPricePolicyGroupId] = useState('')
  const [policyEditor, setPolicyEditor] = useState(null)
  const [policyEditorLoading, setPolicyEditorLoading] = useState(false)
  const [policyEditorError, setPolicyEditorError] = useState('')
  const [base24hInput, setBase24hInput] = useState('0')
  const [weekdayPercentInput, setWeekdayPercentInput] = useState(DEFAULT_WEEKDAY_PERCENT)
  const [weekendPercentInput, setWeekendPercentInput] = useState(DEFAULT_WEEKEND_PERCENT)
  const [pricingOptionTypeInput, setPricingOptionTypeInput] = useState(DEFAULT_PRICING_OPTION_TYPE)
  const [saving, setSaving] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [submitMessage, setSubmitMessage] = useState('')

  const hasAdminHint = useMemo(() => isAdminUser(user) || isAdminUser(profile), [profile, user])
  const sortedGroups = useMemo(() => sortGroupsByPrice(groups), [groups])
  const selectedGroup = sortedGroups.find((item) => item.pricePolicyGroupId === selectedPricePolicyGroupId) || null
  const selectedPolicyId = selectedGroup?.pricePolicyId || ''

  const currentAppliedPreview = useMemo(() => {
    if (!selectedGroup) return null
    return buildComputedRate(
      selectedGroup.legacyPolicy,
      selectedGroup.currentVariables?.base24h,
      selectedGroup.currentVariables?.weekdayPercent,
      selectedGroup.currentVariables?.weekendPercent,
      selectedGroup.pricingOptionType,
    )
  }, [selectedGroup])

  const editorPreview = useMemo(() => {
    const legacyPolicy = policyEditor?.policies?.[0]?.legacyPolicy || selectedGroup?.legacyPolicy || null
    if (!legacyPolicy) return null
    return buildComputedRate(legacyPolicy, base24hInput, weekdayPercentInput, weekendPercentInput, pricingOptionTypeInput)
  }, [policyEditor, selectedGroup, base24hInput, weekdayPercentInput, weekendPercentInput, pricingOptionTypeInput])

  const changed = hasChanged(selectedGroup?.currentVariables, editorPreview)
  const changedGroups = sortedGroups.filter((item) => item.pricePolicyGroupId === selectedPricePolicyGroupId && changed).length

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

  async function refreshGroupData(nextSelectedPricePolicyGroupId = '', overrideQuery = searchQuery) {
    const trimmedQuery = String(overrideQuery || '').trim()
    const result = await listPricingHubGroups(session, trimmedQuery ? { q: trimmedQuery } : {})
    const items = Array.isArray(result.items) ? result.items : []

    setGroups(items)
    setGroupsError('')

    const sortedItems = sortGroupsByPrice(items)
    const targetId = nextSelectedPricePolicyGroupId || selectedPricePolicyGroupId
    if (targetId && sortedItems.some((item) => item.pricePolicyGroupId === targetId)) {
      setSelectedPricePolicyGroupId(targetId)
    } else if (sortedItems[0]?.pricePolicyGroupId) {
      setSelectedPricePolicyGroupId(sortedItems[0].pricePolicyGroupId)
    } else {
      setSelectedPricePolicyGroupId('')
    }
  }

  useEffect(() => {
    let ignore = false
    if (!session?.access_token || !hasAdminHint) {
      setGroupsLoading(false)
      return () => {
        ignore = true
      }
    }

    setGroupsLoading(true)
    refreshGroupData('', searchQuery)
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
  }, [session, hasAdminHint, searchQuery])

  useEffect(() => {
    let ignore = false
    if (!session?.access_token || !selectedPolicyId) {
      setPolicyEditor(null)
      return () => {
        ignore = true
      }
    }

    setPolicyEditorLoading(true)
    getPricingHubPolicyEditor(session, { pricePolicyId: selectedPolicyId })
      .then((result) => {
        if (ignore) return
        setPolicyEditor(result)
        setPolicyEditorError('')
        const legacyPolicy = result?.policies?.[0]?.legacyPolicy || selectedGroup?.legacyPolicy || {}
        const editorState = result?.editorState || selectedGroup?.currentVariables || {}
        setBase24hInput(String(roundAmount(editorState.base24h || legacyPolicy.baseDailyPrice || 0)))
        setWeekdayPercentInput(roundPercent(editorState.weekdayPercent, DEFAULT_WEEKDAY_PERCENT))
        setWeekendPercentInput(roundPercent(editorState.weekendPercent, DEFAULT_WEEKEND_PERCENT))
        setPricingOptionTypeInput(normalizePricingOptionType(editorState.pricingOptionType || selectedGroup?.pricingOptionType))
      })
      .catch((error) => {
        if (ignore) return
        setPolicyEditor(null)
        setPolicyEditorError(error.message || '가격 수정 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (ignore) return
        setPolicyEditorLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [session, selectedPolicyId])

  function handleSearch() {
    setSearchQuery(searchInput)
  }

  function handleResetSearch() {
    setSearchInput('')
    setSearchQuery('')
  }

  function resetSelectedInputs() {
    if (!selectedGroup) return
    const legacyPolicy = policyEditor?.policies?.[0]?.legacyPolicy || selectedGroup.legacyPolicy || {}
    const currentVariables = selectedGroup.currentVariables || {}
    setBase24hInput(String(roundAmount(currentVariables.base24h || legacyPolicy.baseDailyPrice || 0)))
    setWeekdayPercentInput(roundPercent(currentVariables.weekdayPercent, DEFAULT_WEEKDAY_PERCENT))
    setWeekendPercentInput(roundPercent(currentVariables.weekendPercent, DEFAULT_WEEKEND_PERCENT))
    setPricingOptionTypeInput(normalizePricingOptionType(currentVariables.pricingOptionType || selectedGroup.pricingOptionType))
  }

  function adjustBase24h(delta) {
    setBase24hInput(String(Math.max(0, roundAmount(base24hInput) + delta)))
  }

  function adjustPercent(kind, delta) {
    if (kind === 'weekday') {
      setWeekdayPercentInput(roundPercent(toNumber(weekdayPercentInput, DEFAULT_WEEKDAY_PERCENT) + delta, DEFAULT_WEEKDAY_PERCENT))
      return
    }
    setWeekendPercentInput(roundPercent(toNumber(weekendPercentInput, DEFAULT_WEEKEND_PERCENT) + delta, DEFAULT_WEEKEND_PERCENT))
  }

  async function handleSaveEditor() {
    if (!session?.access_token || !selectedPolicyId || !selectedGroup) return

    setSaving(true)
    setSubmitMessage('')
    try {
      const nextBase24h = roundUpToThousand(base24hInput)
      const nextWeekdayPercent = roundPercent(weekdayPercentInput, DEFAULT_WEEKDAY_PERCENT)
      const nextWeekendPercent = roundPercent(weekendPercentInput, DEFAULT_WEEKEND_PERCENT)
      const nextPricingOptionType = normalizePricingOptionType(pricingOptionTypeInput)

      const nextPolicyEditor = await savePricingHubEditor(session, {
        pricePolicyId: selectedPolicyId,
        base24h: nextBase24h,
        weekdayPercent: nextWeekdayPercent,
        weekendPercent: nextWeekendPercent,
        pricingOptionType: nextPricingOptionType,
      })

      setPolicyEditor(nextPolicyEditor)
      setBase24hInput(String(nextBase24h))
      setWeekdayPercentInput(nextWeekdayPercent)
      setWeekendPercentInput(nextWeekendPercent)
      setPricingOptionTypeInput(nextPricingOptionType)
      await refreshGroupData(selectedPricePolicyGroupId, searchQuery)
      setSubmitMessage('홈페이지 가격이 저장되었습니다.')
    } catch (error) {
      setSubmitMessage(error.message || '가격 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || groupsLoading) {
    return (
      <PageShell>
        <section className="section-bg"><div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}><p className="field-note">가격조정 페이지를 불러오는 중입니다.</p></div></section>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <section className="section-bg pricing-admin-page">
        <style>{`
          .pricing-admin-page .pricing-admin-shell{max-width:1480px;margin:0 auto;padding:24px 18px;}
          .pricing-admin-top{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:16px;}
          .pricing-admin-top h1{margin:0;font-size:25px;letter-spacing:-.045em;}
          .pricing-admin-top p{margin:7px 0 0;color:#64748b;font-size:13px;}
          .pricing-admin-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;}
          .pricing-admin-layout{display:grid;grid-template-columns:300px minmax(560px,1fr) 430px;gap:14px;align-items:start;}
          .pricing-admin-panel{background:#fff;border:1px solid #dbe3ef;border-radius:18px;box-shadow:0 18px 45px rgba(15,23,42,.08);overflow:hidden;}
          .pricing-admin-panel-head{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:15px 16px;border-bottom:1px solid #dbe3ef;background:#fff;}
          .pricing-admin-panel-head strong{font-size:15px;}
          .pricing-admin-panel-body{padding:14px 16px;}
          .pricing-admin-muted{color:#64748b;font-size:12px;}
          .pricing-admin-pill{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:6px 9px;font-size:12px;font-weight:900;background:#f1f5f9;color:#334155;white-space:nowrap;}
          .pricing-admin-pill.is-green{background:#dcfce7;color:#15803d;}.pricing-admin-pill.is-red{background:#fee2e2;color:#b91c1c;}.pricing-admin-pill.is-blue{background:#dbeafe;color:#1d4ed8;}.pricing-admin-pill.is-amber{background:#fef3c7;color:#b45309;}
          .pricing-admin-search{display:grid;grid-template-columns:1fr auto auto;gap:8px;margin-bottom:10px;}
          .pricing-admin-group-list{display:grid;gap:8px;max-height:690px;overflow:auto;padding-right:3px;}
          .pricing-admin-group-card{display:block;width:100%;text-align:left;border:1px solid #dbe3ef;border-radius:14px;background:#fff;padding:12px;color:#111827;}
          .pricing-admin-group-card.is-selected{border-color:#2563eb;background:#eff6ff;}.pricing-admin-group-card.is-inactive{opacity:.58;}
          .pricing-admin-group-head{display:flex;justify-content:space-between;gap:8px;align-items:center;font-weight:900;}
          .pricing-admin-group-meta{display:grid;gap:4px;margin-top:8px;color:#475569;font-size:12px;}.pricing-admin-group-meta b{color:#111827;}
          .pricing-admin-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px;}
          .pricing-admin-metric{border:1px solid #dbe3ef;border-radius:15px;background:#fff;padding:12px;}.pricing-admin-metric span{display:block;color:#64748b;font-size:12px;}.pricing-admin-metric strong{display:block;font-size:17px;margin-top:4px;letter-spacing:-.03em;}.pricing-admin-metric.is-green{background:#f0fdf4;border-color:#bbf7d0;}.pricing-admin-metric.is-amber{background:#fffbeb;border-color:#fde68a;}
          .pricing-admin-notice{border:1px solid #bfdbfe;background:#eff6ff;color:#1e40af;border-radius:14px;padding:11px;font-weight:850;margin-bottom:12px;}
          .pricing-admin-table{border:1px solid #dbe3ef;border-radius:16px;overflow:hidden;}.pricing-admin-row{display:grid;grid-template-columns:minmax(160px,1.25fr) 100px 76px 76px 98px 98px 122px 76px;align-items:center;}.pricing-admin-row.is-head{background:#f8fafc;color:#475569;font-size:12px;font-weight:900;}.pricing-admin-cell{padding:10px;border-bottom:1px solid #dbe3ef;min-height:48px;}.pricing-admin-row:last-child .pricing-admin-cell{border-bottom:none;}.pricing-admin-num{text-align:right;font-weight:900;font-variant-numeric:tabular-nums;}.pricing-admin-num.is-changed{color:#15803d;}
          .pricing-admin-editor{position:sticky;top:16px;}.pricing-admin-selected-title{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:12px;}.pricing-admin-selected-title b{font-size:18px;}
          .pricing-admin-control-card{border:1px solid #dbe3ef;border-radius:16px;padding:14px;background:#fff;margin-bottom:12px;}.pricing-admin-control-card label{display:flex;justify-content:space-between;gap:8px;margin-bottom:8px;color:#475569;font-size:13px;font-weight:900;}.pricing-admin-control-card small{color:#64748b;font-weight:700;}
          .pricing-admin-big-input-row{display:grid;grid-template-columns:1fr auto;gap:9px;align-items:center;}.pricing-admin-big-input{width:100%;border:2px solid #c7d2fe;border-radius:14px;background:#eef2ff;padding:13px 14px;text-align:right;font-size:24px;font-weight:950;letter-spacing:-.04em;}.pricing-admin-big-input.is-percent{border-color:#bfdbfe;background:#eff6ff;}.pricing-admin-big-input-row strong{font-size:16px;color:#475569;}
          .pricing-admin-step-row{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:9px;}.pricing-admin-option-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}.pricing-admin-option-grid button{border:1px solid #dbe3ef;background:#f8fafc;border-radius:12px;padding:10px 8px;font-weight:900;}.pricing-admin-option-grid button.is-selected{background:#111827;color:#fff;border-color:#111827;}
          .pricing-admin-preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;}.pricing-admin-preview-card{border:1px solid #dbe3ef;border-radius:13px;padding:11px;background:#f8fafc;}.pricing-admin-preview-card span{display:block;color:#64748b;font-size:12px;}.pricing-admin-preview-card strong{display:block;text-align:right;margin-top:4px;font-size:17px;font-variant-numeric:tabular-nums;}
          .pricing-admin-section-label{margin:16px 0 8px;font-size:13px;color:#475569;font-weight:950;}.pricing-admin-diff{display:grid;gap:9px;}.pricing-admin-diff-row{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;border:1px solid #dbe3ef;border-radius:13px;padding:10px;background:#fff;}.pricing-admin-before{color:#64748b;text-decoration:line-through;}.pricing-admin-after{color:#15803d;font-weight:900;}.pricing-admin-log{background:#0f172a;color:#cbd5e1;border-radius:14px;padding:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;margin-top:12px;white-space:pre-line;}.pricing-admin-footer-actions{display:flex;gap:8px;margin-top:12px;}.pricing-admin-footer-actions .btn{flex:1;}
          @media (max-width: 1180px){.pricing-admin-layout{grid-template-columns:1fr;}.pricing-admin-editor{position:static;}.pricing-admin-row{grid-template-columns:minmax(150px,1fr) repeat(3,80px) repeat(2,92px) 112px 72px;}.pricing-admin-page .pricing-admin-shell{padding-left:12px;padding-right:12px;}}
        `}</style>
        <div className="pricing-admin-shell">
          <div className="pricing-admin-top">
            <div>
              <h1>홈페이지 가격조정</h1>
              <p>기준24, 주중%, 주말%, 등급만 수정합니다. 장기요금과 표시가는 자동 계산값으로 확인합니다.</p>
            </div>
            <div className="pricing-admin-actions">
              <span className="pricing-admin-pill is-green">홈페이지 가격 전용</span>
              <span className="pricing-admin-pill is-blue">외부 플랫폼 전송 없음</span>
              <Link className="btn btn-outline btn-md" to="/">메인으로</Link>
            </div>
          </div>

          <AdminNav />

          {groupsError ? <p className="field-note" style={{ color: '#be123c' }}>{groupsError}</p> : null}
          {policyEditorError ? <p className="field-note" style={{ color: '#be123c' }}>{policyEditorError}</p> : null}
          {submitMessage ? <p className="field-note">{submitMessage}</p> : null}

          <div className="pricing-admin-layout" style={{ marginTop: 14 }}>
            <aside className="pricing-admin-panel">
              <div className="pricing-admin-panel-head"><strong>그룹 선택</strong><span className="pricing-admin-muted">가격순</span></div>
              <div className="pricing-admin-panel-body">
                <div className="pricing-admin-search">
                  <input className="field-input" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleSearch() }} placeholder="그룹명 / 차량번호" />
                  <button type="button" className="btn btn-dark btn-sm" onClick={handleSearch}>검색</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={handleResetSearch}>초기화</button>
                </div>
                {!sortedGroups.length ? <p className="field-note">표시할 그룹이 없습니다.</p> : null}
                <div className="pricing-admin-group-list">
                  {sortedGroups.map((item) => {
                    const isSelected = selectedPricePolicyGroupId === item.pricePolicyGroupId
                    const isActive = item.groupSettingActive !== false
                    const optionType = normalizePricingOptionType(item.pricingOptionType)
                    return (
                      <button
                        key={item.pricePolicyGroupId}
                        type="button"
                        className={`pricing-admin-group-card ${isSelected ? 'is-selected' : ''} ${isActive ? '' : 'is-inactive'}`}
                        onClick={() => setSelectedPricePolicyGroupId(item.pricePolicyGroupId)}
                      >
                        <div className="pricing-admin-group-head"><span>{item.groupName}</span><StatusBadge active={isActive} /></div>
                        <div className="pricing-admin-group-meta">
                          <span>정책 <b>{item.policyName || '-'}</b></span>
                          <span>기준24 <b>{formatMoney(item.currentVariables?.base24h)}</b></span>
                          <span>주중/주말 <b>{roundPercent(item.currentVariables?.weekdayPercent, DEFAULT_WEEKDAY_PERCENT)}% / {roundPercent(item.currentVariables?.weekendPercent, DEFAULT_WEEKEND_PERCENT)}%</b></span>
                          <span>등급 <b>{PRICING_OPTION_LABELS[optionType]}</b></span>
                          <span>차량 <b>{item.carNumbers?.length ? item.carNumbers.join(', ') : '-'}</b></span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </aside>

            <main className="pricing-admin-panel">
              <div className="pricing-admin-panel-head"><strong>가격 모니터링</strong><span className="pricing-admin-muted">입력 불가 · 결과 확인용</span></div>
              <div className="pricing-admin-panel-body">
                <div className="pricing-admin-metrics">
                  <MetricCard label="전체 그룹" value={`${sortedGroups.length}개`} />
                  <MetricCard label="선택 그룹" value={selectedGroup?.groupName || '-'} tone="is-green" />
                  <MetricCard label="현재 기준24" value={formatMoney(currentAppliedPreview?.base24h)} />
                  <MetricCard label="변경 상태" value={changed ? '변경 대기' : '원본'} tone={changed ? 'is-amber' : ''} />
                </div>
                <div className="pricing-admin-notice">수정은 오른쪽 입력 패널에서만 합니다. 가운데 표는 그룹별 현재 적용가와 자동 계산 결과를 확인하는 용도입니다.</div>
                <div className="pricing-admin-table">
                  <div className="pricing-admin-row is-head">
                    <div className="pricing-admin-cell">그룹</div><div className="pricing-admin-cell pricing-admin-num">기준24</div><div className="pricing-admin-cell pricing-admin-num">주중%</div><div className="pricing-admin-cell pricing-admin-num">주말%</div><div className="pricing-admin-cell pricing-admin-num">주중24</div><div className="pricing-admin-cell pricing-admin-num">주말24</div><div className="pricing-admin-cell pricing-admin-num">7/14/30일</div><div className="pricing-admin-cell">상태</div>
                  </div>
                  {sortedGroups.map((item) => {
                    const isSelected = item.pricePolicyGroupId === selectedPricePolicyGroupId
                    const preview = isSelected && editorPreview ? editorPreview : buildComputedRate(item.legacyPolicy, item.currentVariables?.base24h, item.currentVariables?.weekdayPercent, item.currentVariables?.weekendPercent, item.pricingOptionType)
                    return (
                      <div key={item.pricePolicyGroupId} className="pricing-admin-row">
                        <div className="pricing-admin-cell"><strong>{item.groupName}</strong><br /><span className="pricing-admin-muted">{item.carNumbers?.length || 0}대 · {PRICING_OPTION_LABELS[preview.pricingOptionType]}</span></div>
                        <div className={`pricing-admin-cell pricing-admin-num ${isSelected && changed ? 'is-changed' : ''}`}>{formatMoney(preview.base24h)}</div>
                        <div className={`pricing-admin-cell pricing-admin-num ${isSelected && changed ? 'is-changed' : ''}`}>{preview.weekdayRatePercent}%</div>
                        <div className={`pricing-admin-cell pricing-admin-num ${isSelected && changed ? 'is-changed' : ''}`}>{preview.weekendRatePercent}%</div>
                        <div className={`pricing-admin-cell pricing-admin-num ${isSelected && changed ? 'is-changed' : ''}`}>{formatMoney(preview.weekdayApplied24h)}</div>
                        <div className={`pricing-admin-cell pricing-admin-num ${isSelected && changed ? 'is-changed' : ''}`}>{formatMoney(preview.weekendApplied24h)}</div>
                        <div className="pricing-admin-cell pricing-admin-num">{formatShortMoney(preview.week1Price)} / {formatShortMoney(preview.week2Price)} / {formatShortMoney(preview.month1Price)}</div>
                        <div className="pricing-admin-cell"><span className={`pricing-admin-pill ${isSelected && changed ? 'is-green' : ''}`}>{isSelected && changed ? '수정' : '원본'}</span></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </main>

            <aside className="pricing-admin-panel pricing-admin-editor">
              <div className="pricing-admin-panel-head"><strong>선택 그룹 입력</strong><span className="pricing-admin-pill is-blue">4개만 수정</span></div>
              <div className="pricing-admin-panel-body">
                {selectedGroup ? (
                  <>
                    <div className="pricing-admin-selected-title">
                      <div><b>{selectedGroup.groupName}</b><br /><span className="pricing-admin-muted">{selectedGroup.carNumbers?.length || 0}대 · {selectedGroup.policyName || '-'}</span></div>
                      <StatusBadge active={selectedGroup.groupSettingActive !== false} />
                    </div>

                    {policyEditorLoading ? <p className="field-note">가격 정보를 불러오는 중입니다.</p> : null}

                    <MoneyControl
                      label="기준 24시간 금액"
                      value={base24hInput}
                      unit="원"
                      stepLabels={[{ label: '-5,000', value: -5000 }, { label: '-1,000', value: -1000 }, { label: '+1,000', value: 1000 }, { label: '+5,000', value: 5000 }]}
                      onChange={setBase24hInput}
                      onStep={adjustBase24h}
                      disabled={!selectedPolicyId || saving}
                    />
                    <MoneyControl
                      label="주중 비율"
                      value={weekdayPercentInput}
                      unit="%"
                      stepLabels={[{ label: '-5%', value: -5 }, { label: '-1%', value: -1 }, { label: '+1%', value: 1 }, { label: '+5%', value: 5 }]}
                      onChange={setWeekdayPercentInput}
                      onStep={(value) => adjustPercent('weekday', value)}
                      disabled={!selectedPolicyId || saving}
                    />
                    <MoneyControl
                      label="주말 비율"
                      value={weekendPercentInput}
                      unit="%"
                      stepLabels={[{ label: '-5%', value: -5 }, { label: '-1%', value: -1 }, { label: '+1%', value: 1 }, { label: '+5%', value: 5 }]}
                      onChange={setWeekendPercentInput}
                      onStep={(value) => adjustPercent('weekend', value)}
                      disabled={!selectedPolicyId || saving}
                    />

                    <div className="pricing-admin-control-card">
                      <label><span>등급 조정</span><small>장기/1시간 계산 배수</small></label>
                      <div className="pricing-admin-option-grid">
                        {Object.entries(PRICING_OPTION_LABELS).map(([value, label]) => (
                          <button key={value} type="button" className={normalizePricingOptionType(pricingOptionTypeInput) === value ? 'is-selected' : ''} onClick={() => setPricingOptionTypeInput(value)} disabled={saving}>{label}</button>
                        ))}
                      </div>
                    </div>

                    <div className="pricing-admin-section-label">자동 계산 미리보기</div>
                    <div className="pricing-admin-preview-grid">
                      <PreviewCard label="주중24" value={editorPreview?.weekdayApplied24h} />
                      <PreviewCard label="주말24" value={editorPreview?.weekendApplied24h} />
                      <PreviewCard label="7일" value={editorPreview?.week1Price} />
                      <PreviewCard label="14일" value={editorPreview?.week2Price} />
                      <PreviewCard label="30일" value={editorPreview?.month1Price} />
                      <PreviewCard label="1시간" value={editorPreview?.fee1h} />
                    </div>

                    <div className="pricing-admin-section-label">변경 대기</div>
                    {changed ? (
                      <div className="pricing-admin-diff">
                        <div className="pricing-admin-diff-row"><strong>기준24</strong><span className="pricing-admin-before">{formatMoney(currentAppliedPreview?.base24h)}</span><span className="pricing-admin-after">{formatMoney(editorPreview?.base24h)}</span></div>
                        <div className="pricing-admin-diff-row"><strong>주중%</strong><span className="pricing-admin-before">{roundPercent(selectedGroup.currentVariables?.weekdayPercent, DEFAULT_WEEKDAY_PERCENT)}%</span><span className="pricing-admin-after">{editorPreview?.weekdayRatePercent}%</span></div>
                        <div className="pricing-admin-diff-row"><strong>주말%</strong><span className="pricing-admin-before">{roundPercent(selectedGroup.currentVariables?.weekendPercent, DEFAULT_WEEKEND_PERCENT)}%</span><span className="pricing-admin-after">{editorPreview?.weekendRatePercent}%</span></div>
                        <div className="pricing-admin-diff-row"><strong>등급</strong><span className="pricing-admin-before">{PRICING_OPTION_LABELS[normalizePricingOptionType(selectedGroup.currentVariables?.pricingOptionType || selectedGroup.pricingOptionType)]}</span><span className="pricing-admin-after">{PRICING_OPTION_LABELS[editorPreview?.pricingOptionType]}</span></div>
                      </div>
                    ) : <p className="field-note">현재 변경 대기 항목이 없습니다.</p>}

                    <div className="pricing-admin-log">저장 범위\n- 기준24, 주중%, 주말%, 등급만 저장\n- 7/14/30일은 계산 결과로 노출\n- 홈페이지 가격만 반영\n- 카모아/외부 플랫폼 전송 없음</div>
                    <div className="pricing-admin-footer-actions">
                      <button type="button" className="btn btn-outline btn-md" onClick={resetSelectedInputs} disabled={saving}>원본 다시 불러오기</button>
                      <button type="button" className="btn btn-dark btn-md" onClick={handleSaveEditor} disabled={!selectedPolicyId || saving || !changed}>{saving ? '저장중' : `변경 ${changedGroups || 1}건 저장`}</button>
                    </div>
                  </>
                ) : <p className="field-note">그룹을 선택하세요.</p>}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
