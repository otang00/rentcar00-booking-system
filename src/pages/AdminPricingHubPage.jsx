import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageShell } from '../components/Layout'
import { AdminNav } from '../components/AdminNav'
import { useAuth } from '../hooks/useAuth'
import { isAdminUser } from '../utils/adminAccess'
import {
  getPricingHubPolicyEditor,
  listPricingHubGroups,
  savePricingHubEditor,
  savePricingHubGroupSetting,
} from '../services/adminPricingHubApi'

function toNumber(value, fallback = 0) {
  const next = Number(value)
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
    if (a.groupSettingActive !== b.groupSettingActive) {
      return a.groupSettingActive ? -1 : 1
    }
    const aValue = toNumber(a?.currentRateSummary?.weekday24h, toNumber(a?.currentVariables?.base24h, 0))
    const bValue = toNumber(b?.currentRateSummary?.weekday24h, toNumber(b?.currentVariables?.base24h, 0))
    if (aValue !== bValue) return aValue - bValue
    return String(a?.groupName || '').localeCompare(String(b?.groupName || ''), 'ko')
  })
}

function getGroupCardStyle(isActive, isSelected) {
  if (isSelected && isActive) return { textAlign: 'left' }
  if (isSelected && !isActive) {
    return {
      textAlign: 'left',
      background: '#d1d5db',
      color: '#374151',
      borderColor: '#6b7280',
      opacity: 0.8,
    }
  }
  if (!isActive) {
    return {
      textAlign: 'left',
      background: '#e5e7eb',
      color: '#6b7280',
      borderColor: '#cbd5e1',
      opacity: 0.72,
    }
  }
  return { textAlign: 'left' }
}

function buildPolicySummary(editor, pricingOptionType) {
  const policy = editor?.policies?.[0] || null
  const editorState = editor?.editorState || {}
  if (!policy) return null
  return buildComputedRate(
    policy.legacyPolicy,
    editorState.base24h,
    editorState.weekdayPercent,
    editorState.weekendPercent,
    pricingOptionType,
  )
}

function ResultMoneyRow({ label, value }) {
  return <div className="reservation-result-row"><span>{label}</span><strong>{formatMoney(value)}</strong></div>
}

function StatusBadge({ active }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 74,
        padding: '6px 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        color: '#fff',
        background: active ? '#16a34a' : '#dc2626',
        boxShadow: active ? 'inset 0 -1px 0 rgba(0,0,0,0.12)' : 'inset 0 -1px 0 rgba(0,0,0,0.12)',
      }}
    >
      {active ? '활성' : '비활성'}
    </span>
  )
}

function InfoBlock({ title, children }) {
  return (
    <div style={{ display: 'grid', gap: 8, padding: 12, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
      <strong style={{ fontSize: 13 }}>{title}</strong>
      {children}
    </div>
  )
}

function MoneyGrid({ items = [] }) {
  return (
    <div className="pricing-hub-money-grid">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`pricing-hub-money-card ${index < 4 ? 'is-primary' : ''}`}
        >
          <span className="small-note">{item.label}</span>
          <strong>{formatMoney(item.value)}</strong>
        </div>
      ))}
    </div>
  )
}

function VehicleChipList({ carNumbers = [] }) {
  if (!carNumbers.length) return <span className="small-note">차량 없음</span>
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {carNumbers.map((carNumber) => (
        <button
          key={carNumber}
          type="button"
          className="btn btn-outline btn-sm"
          style={{ borderRadius: 999, padding: '6px 12px', background: '#f8fafc', cursor: 'default' }}
        >
          {carNumber}
        </button>
      ))}
    </div>
  )
}

export default function AdminPricingHubPage() {
  const navigate = useNavigate()
  const { loading, isAuthenticated, session, user, profile } = useAuth()
  const [groups, setGroups] = useState([])
  const [policyOptions, setPolicyOptions] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState('')
  const [selectedPricePolicyGroupId, setSelectedPricePolicyGroupId] = useState('')
  const [groupEditor, setGroupEditor] = useState(null)
  const [groupEditorLoading, setGroupEditorLoading] = useState(false)
  const [groupEditorError, setGroupEditorError] = useState('')
  const [selectedConnectionPolicyId, setSelectedConnectionPolicyId] = useState('')
  const [connectionActiveInput, setConnectionActiveInput] = useState(true)
  const [connectionPolicyEditor, setConnectionPolicyEditor] = useState(null)
  const [connectionPolicyLoading, setConnectionPolicyLoading] = useState(false)
  const [connectionPolicyError, setConnectionPolicyError] = useState('')
  const [policyEditorPolicyId, setPolicyEditorPolicyId] = useState('')
  const [policyEditor, setPolicyEditor] = useState(null)
  const [policyEditorLoading, setPolicyEditorLoading] = useState(false)
  const [policyEditorError, setPolicyEditorError] = useState('')
  const [policyPreviewOptionTypeInput, setPolicyPreviewOptionTypeInput] = useState(DEFAULT_PRICING_OPTION_TYPE)
  const [base24hInput, setBase24hInput] = useState('0')
  const [weekdayPercentInput, setWeekdayPercentInput] = useState(DEFAULT_WEEKDAY_PERCENT)
  const [weekendPercentInput, setWeekendPercentInput] = useState(DEFAULT_WEEKEND_PERCENT)
  const [saving, setSaving] = useState(false)
  const [savingGroupSetting, setSavingGroupSetting] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [submitMessage, setSubmitMessage] = useState('')
  const selectionCardRef = useRef(null)

  const hasAdminHint = useMemo(() => isAdminUser(user) || isAdminUser(profile), [profile, user])
  const sortedGroups = useMemo(() => sortGroupsByPrice(groups), [groups])
  const selectedGroup = sortedGroups.find((item) => item.pricePolicyGroupId === selectedPricePolicyGroupId) || null
  const selectedConnectionPolicyOption = useMemo(
    () => policyOptions.find((item) => item.pricePolicyId === selectedConnectionPolicyId) || null,
    [policyOptions, selectedConnectionPolicyId],
  )
  const selectedEditPolicyOption = useMemo(
    () => policyOptions.find((item) => item.pricePolicyId === policyEditorPolicyId) || null,
    [policyOptions, policyEditorPolicyId],
  )

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

  const connectionPolicyPreview = useMemo(
    () => buildPolicySummary(connectionPolicyEditor, selectedConnectionPolicyOption?.pricingOptionType),
    [connectionPolicyEditor, selectedConnectionPolicyOption],
  )

  const policyEditorPreview = useMemo(() => {
    const legacyPolicy = policyEditor?.policies?.[0]?.legacyPolicy || null
    if (!legacyPolicy) return null
    return buildComputedRate(legacyPolicy, base24hInput, weekdayPercentInput, weekendPercentInput, policyPreviewOptionTypeInput)
  }, [policyEditor, base24hInput, weekdayPercentInput, weekendPercentInput, policyPreviewOptionTypeInput])

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
    const nextPolicyOptions = Array.isArray(result.policyOptions) ? result.policyOptions : []

    setGroups(items)
    setPolicyOptions(nextPolicyOptions)
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
        setPolicyOptions([])
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
    if (!session?.access_token || !selectedPricePolicyGroupId) {
      setGroupEditor(null)
      return () => {
        ignore = true
      }
    }

    setGroupEditorLoading(true)
    getPricingHubPolicyEditor(session, { pricePolicyGroupId: selectedPricePolicyGroupId })
      .then((result) => {
        if (ignore) return
        setGroupEditor(result)
        setGroupEditorError('')
      })
      .catch((error) => {
        if (ignore) return
        setGroupEditor(null)
        setGroupEditorError(error.message || '차량그룹 상세를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (ignore) return
        setGroupEditorLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [session, selectedPricePolicyGroupId])

  useEffect(() => {
    if (!selectedPricePolicyGroupId || !selectionCardRef.current) return
    selectionCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedPricePolicyGroupId])

  useEffect(() => {
    if (!selectedGroup) return
    setSelectedConnectionPolicyId(selectedGroup.pricePolicyId || '')
    setConnectionActiveInput(selectedGroup.groupSettingActive !== false)
    setPolicyEditorPolicyId((prev) => prev || selectedGroup.pricePolicyId || '')
  }, [selectedGroup])

  useEffect(() => {
    let ignore = false
    if (!session?.access_token || !selectedConnectionPolicyId) {
      setConnectionPolicyEditor(null)
      return () => {
        ignore = true
      }
    }

    setConnectionPolicyLoading(true)
    getPricingHubPolicyEditor(session, { pricePolicyId: selectedConnectionPolicyId })
      .then((result) => {
        if (ignore) return
        setConnectionPolicyEditor(result)
        setConnectionPolicyError('')
      })
      .catch((error) => {
        if (ignore) return
        setConnectionPolicyEditor(null)
        setConnectionPolicyError(error.message || '선택 정책 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (ignore) return
        setConnectionPolicyLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [session, selectedConnectionPolicyId])

  useEffect(() => {
    let ignore = false
    if (!session?.access_token || !policyEditorPolicyId) {
      setPolicyEditor(null)
      return () => {
        ignore = true
      }
    }

    setPolicyEditorLoading(true)
    getPricingHubPolicyEditor(session, { pricePolicyId: policyEditorPolicyId })
      .then((result) => {
        if (ignore) return
        setPolicyEditor(result)
        setPolicyEditorError('')
        const legacyPolicy = result?.policies?.[0]?.legacyPolicy || {}
        const editorState = result?.editorState || {}
        setBase24hInput(String(roundAmount(editorState.base24h || legacyPolicy.baseDailyPrice || 0)))
        setWeekdayPercentInput(roundPercent(editorState.weekdayPercent, DEFAULT_WEEKDAY_PERCENT))
        setWeekendPercentInput(roundPercent(editorState.weekendPercent, DEFAULT_WEEKEND_PERCENT))
        setPolicyPreviewOptionTypeInput(normalizePricingOptionType(editorState.pricingOptionType || result?.policies?.[0]?.pricingOptionType || DEFAULT_PRICING_OPTION_TYPE))
      })
      .catch((error) => {
        if (ignore) return
        setPolicyEditor(null)
        setPolicyEditorError(error.message || '정책 수정 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (ignore) return
        setPolicyEditorLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [session, policyEditorPolicyId])

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

  async function handleSearch() {
    setSearchQuery(String(searchInput || '').trim())
  }

  async function handleResetSearch() {
    setSearchInput('')
    setSearchQuery('')
  }

  async function handleSaveGroupSetting() {
    if (!session?.access_token || !selectedGroup || !selectedConnectionPolicyId || savingGroupSetting) return

    setSavingGroupSetting(true)
    setSubmitMessage('')
    try {
      const result = await savePricingHubGroupSetting(session, {
        id: selectedGroup.pricePolicyGroupId,
        carGroupId: selectedGroup.carGroupId,
        pricePolicyId: selectedConnectionPolicyId,
        active: connectionActiveInput,
      })
      await refreshGroupData(result?.item?.pricePolicyGroupId || selectedGroup.pricePolicyGroupId, searchQuery)
      setSubmitMessage('연결 정책이 저장되었습니다.')
    } catch (error) {
      setSubmitMessage(error.message || '연결 정책 저장에 실패했습니다.')
    } finally {
      setSavingGroupSetting(false)
    }
  }

  async function handleSaveEditor() {
    if (!session?.access_token || !policyEditorPolicyId || !policyEditor?.policies?.[0] || saving) return

    setSaving(true)
    setSubmitMessage('')

    try {
      await savePricingHubEditor(session, {
        pricePolicyId: policyEditorPolicyId,
        base24h: policyEditorPreview?.base24h,
        weekdayPercent: policyEditorPreview?.weekdayRatePercent,
        weekendPercent: policyEditorPreview?.weekendRatePercent,
        pricingOptionType: policyEditorPreview?.pricingOptionType || policyPreviewOptionTypeInput,
      })

      const nextPolicyEditor = await getPricingHubPolicyEditor(session, { pricePolicyId: policyEditorPolicyId })
      setPolicyEditor(nextPolicyEditor)

      if (selectedConnectionPolicyId === policyEditorPolicyId) {
        const nextConnectionEditor = await getPricingHubPolicyEditor(session, { pricePolicyId: selectedConnectionPolicyId })
        setConnectionPolicyEditor(nextConnectionEditor)
      }

      if (selectedGroup?.pricePolicyId === policyEditorPolicyId) {
        const nextGroupEditor = await getPricingHubPolicyEditor(session, { pricePolicyGroupId: selectedGroup.pricePolicyGroupId })
        setGroupEditor(nextGroupEditor)
      }

      await refreshGroupData(selectedGroup?.pricePolicyGroupId || '', searchQuery)

      const legacyPolicy = nextPolicyEditor?.policies?.[0]?.legacyPolicy || {}
      const editorState = nextPolicyEditor?.editorState || {}
      setBase24hInput(String(roundAmount(editorState.base24h || legacyPolicy.baseDailyPrice || 0)))
      setWeekdayPercentInput(roundPercent(editorState.weekdayPercent, DEFAULT_WEEKDAY_PERCENT))
      setWeekendPercentInput(roundPercent(editorState.weekendPercent, DEFAULT_WEEKEND_PERCENT))
      setSubmitMessage('정책 가격이 저장되었습니다.')
    } catch (error) {
      setSubmitMessage(error.message || '정책 저장에 실패했습니다.')
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
                <p className="small-note" style={{ marginTop: 8 }}>차량그룹 현재 적용가 확인, 연결 정책 변경, 정책 가격 수정을 분리합니다.</p>
              </div>
              <Link className="btn btn-outline btn-md" to="/">메인으로</Link>
            </div>

            <AdminNav />

            {groupsError ? <p className="field-note" style={{ color: '#be123c', margin: 0 }}>{groupsError}</p> : null}
            {groupEditorError ? <p className="field-note" style={{ color: '#be123c', margin: 0 }}>{groupEditorError}</p> : null}
            {connectionPolicyError ? <p className="field-note" style={{ color: '#be123c', margin: 0 }}>{connectionPolicyError}</p> : null}
            {policyEditorError ? <p className="field-note" style={{ color: '#be123c', margin: 0 }}>{policyEditorError}</p> : null}
            {submitMessage ? <p className="field-note" style={{ margin: 0 }}>{submitMessage}</p> : null}

            <div className="pricing-hub-layout" style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(320px, 400px) minmax(0, 1fr)', alignItems: 'start' }}>
              <div className="panel-sub" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <strong>차량그룹 목록</strong>
                  <span className="small-note">낮은 가격순 · 비활성은 하단</span>
                </div>
                <div className="pricing-hub-search-row">
                  <input
                    className="field-input"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="차량번호 / 그룹명 / 정책명 검색"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearch()
                    }}
                  />
                  <button type="button" className="btn btn-dark btn-md" onClick={handleSearch}>검색</button>
                  <button type="button" className="btn btn-outline btn-md" onClick={handleResetSearch}>초기화</button>
                </div>
                {groupsLoading ? <p className="field-note" style={{ margin: 0 }}>불러오는 중입니다.</p> : null}
                {!groupsLoading && sortedGroups.length === 0 ? <p className="field-note" style={{ margin: 0 }}>표시할 그룹이 없습니다.</p> : null}
                {sortedGroups.map((item) => {
                  const isSelected = selectedPricePolicyGroupId === item.pricePolicyGroupId
                  const isActive = item.groupSettingActive !== false
                  return (
                    <button
                      key={item.pricePolicyGroupId}
                      type="button"
                      className={`btn pricing-hub-group-card ${isSelected ? 'is-active' : ''}`}
                      onClick={() => setSelectedPricePolicyGroupId(item.pricePolicyGroupId)}
                      style={getGroupCardStyle(isActive, isSelected)}
                    >
                      <div className="pricing-hub-group-card__head" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <span>{item.groupName}</span>
                        <StatusBadge active={isActive} />
                      </div>
                      <div className="pricing-hub-group-card__meta" style={{ display: 'grid', gap: 4 }}>
                        <span>정책 <strong>{item.policyName}</strong></span>
                        <span>정책등급 <strong>{PRICING_OPTION_LABELS[normalizePricingOptionType(item.pricingOptionType)]}</strong></span>
                        <span>기준24 <strong>{formatMoney(item.currentVariables?.base24h)}</strong></span>
                        <span>주중/주말 <strong>{item.currentVariables?.weekdayPercent}% / {item.currentVariables?.weekendPercent}%</strong></span>
                        <span>계산 주중24 <strong>{formatMoney(item.currentRateSummary?.weekday24h)}</strong></span>
                        <span>계산 주말24 <strong>{formatMoney(item.currentRateSummary?.weekend24h)}</strong></span>
                        <span>차량 <strong>{item.carNumbers?.length ? item.carNumbers.join(', ') : '-'}</strong></span>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="pricing-hub-editor-column" style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
                <div ref={selectionCardRef} className="panel-sub" style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>차량그룹 상세</strong>
                    {selectedGroup ? <StatusBadge active={selectedGroup.groupSettingActive !== false} /> : null}
                  </div>
                  {selectedGroup ? (
                    <>
                      {groupEditorLoading ? <p className="field-note" style={{ margin: 0 }}>차량그룹 상세를 불러오는 중입니다.</p> : null}
                      <div className="pricing-hub-two-col">
                        <InfoBlock title="기본 정보">
                          <div className="reservation-result-row"><span>IMS 그룹</span><strong>{selectedGroup.imsGroupId}</strong></div>
                          <div className="reservation-result-row"><span>그룹명</span><strong>{selectedGroup.groupName}</strong></div>
                        </InfoBlock>
                        <InfoBlock title="연결 정보">
                          <div className="reservation-result-row"><span>현재 연결 정책</span><strong>{selectedGroup.policyName}</strong></div>
                          <div className="reservation-result-row"><span>정책등급</span><strong style={{ color: '#1d4ed8' }}>{PRICING_OPTION_LABELS[normalizePricingOptionType(selectedGroup.pricingOptionType)]}</strong></div>
                        </InfoBlock>
                      </div>
                      <InfoBlock title="차량 번호">
                        <VehicleChipList carNumbers={groupEditor?.group?.carNumbers?.length ? groupEditor.group.carNumbers : selectedGroup.carNumbers || []} />
                      </InfoBlock>
                      <InfoBlock title="현재 적용 금액">
                        <MoneyGrid items={[
                          { label: '기준24', value: currentAppliedPreview?.base24h },
                          { label: '주말24', value: currentAppliedPreview?.weekendApplied24h },
                          { label: '1시간', value: currentAppliedPreview?.fee1h },
                          { label: '주중24', value: currentAppliedPreview?.weekdayApplied24h },
                          { label: '7일', value: currentAppliedPreview?.week1Price },
                          { label: '14일', value: currentAppliedPreview?.week2Price },
                          { label: '30일', value: currentAppliedPreview?.month1Price },
                        ]} />
                      </InfoBlock>
                    </>
                  ) : (
                    <p className="field-note" style={{ margin: 0 }}>그룹을 선택하세요.</p>
                  )}
                </div>

                <div className="panel-sub" style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <strong>연결 정책 선택</strong>
                    <button type="button" className="btn btn-dark btn-md" onClick={handleSaveGroupSetting} disabled={!selectedGroup || !selectedConnectionPolicyId || savingGroupSetting}>{savingGroupSetting ? '저장중' : '연결 저장'}</button>
                  </div>
                  <div className="pricing-hub-connection-grid">
                    <div className="reservation-result-row pricing-hub-adjust-row">
                      <span>연결할 정책</span>
                      <select className="field-input pricing-hub-select" value={selectedConnectionPolicyId} onChange={(e) => setSelectedConnectionPolicyId(e.target.value)} disabled={!selectedGroup || savingGroupSetting}>
                        {policyOptions.map((option) => (
                          <option key={option.pricePolicyId} value={option.pricePolicyId}>{option.policyName} · {PRICING_OPTION_LABELS[normalizePricingOptionType(option.pricingOptionType)]}</option>
                        ))}
                      </select>
                    </div>
                    <InfoBlock title="선택 정책등급">
                      <div className="reservation-result-row"><span>정책등급</span><strong>{PRICING_OPTION_LABELS[normalizePricingOptionType(selectedConnectionPolicyOption?.pricingOptionType)]}</strong></div>
                      <p className="small-note" style={{ margin: 0 }}>등급은 차량 연결이 아니라 정책 수정에서만 변경합니다.</p>
                    </InfoBlock>
                    <InfoBlock title="상태">
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                        <StatusBadge active={connectionActiveInput} />
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setConnectionActiveInput((prev) => !prev)} disabled={!selectedGroup || savingGroupSetting}>
                          {connectionActiveInput ? '비활성으로' : '활성으로'}
                        </button>
                      </div>
                    </InfoBlock>
                  </div>
                  {connectionPolicyLoading ? <p className="field-note" style={{ margin: 0 }}>선택 정책을 불러오는 중입니다.</p> : null}
                  {selectedConnectionPolicyOption ? (
                    <InfoBlock title={`선택 정책 가격 · ${selectedConnectionPolicyOption.policyName}`}>
                      <MoneyGrid items={[
                        { label: '기준24', value: connectionPolicyPreview?.base24h },
                        { label: '주말24', value: connectionPolicyPreview?.weekendApplied24h },
                        { label: '1시간', value: connectionPolicyPreview?.fee1h },
                        { label: '주중24', value: connectionPolicyPreview?.weekdayApplied24h },
                        { label: '7일', value: connectionPolicyPreview?.week1Price },
                        { label: '14일', value: connectionPolicyPreview?.week2Price },
                        { label: '30일', value: connectionPolicyPreview?.month1Price },
                      ]} />
                    </InfoBlock>
                  ) : null}
                </div>

                <div className="panel-sub" style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <strong>정책 수정</strong>
                    <button type="button" className="btn btn-dark btn-md" onClick={handleSaveEditor} disabled={!policyEditorPolicyId || saving}>{saving ? '저장중' : '정책 저장'}</button>
                  </div>
                  <div className="reservation-result-row pricing-hub-adjust-row">
                    <span>수정할 정책</span>
                    <select className="field-input pricing-hub-select" value={policyEditorPolicyId} onChange={(e) => setPolicyEditorPolicyId(e.target.value)} disabled={saving}>
                      {policyOptions.map((option) => (
                        <option key={option.pricePolicyId} value={option.pricePolicyId}>{option.policyName} · {PRICING_OPTION_LABELS[normalizePricingOptionType(option.pricingOptionType)]}</option>
                      ))}
                    </select>
                  </div>
                  {policyEditorLoading ? <p className="field-note" style={{ margin: 0 }}>정책 수정 데이터를 불러오는 중입니다.</p> : null}
                  {selectedEditPolicyOption ? <div className="reservation-result-row"><span>선택 정책명</span><strong>{selectedEditPolicyOption.policyName}</strong></div> : null}
                  <div className="reservation-result-row pricing-hub-adjust-row">
                    <span>기준 24시간 금액</span>
                    <div className="pricing-hub-inline-controls pricing-hub-base-control">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setBase24hInput(String(Math.max(0, roundAmount(base24hInput) - 10000)))} disabled={!policyEditorPolicyId || saving}>-1만</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setBase24hInput(String(Math.max(0, roundAmount(base24hInput) - 1000)))} disabled={!policyEditorPolicyId || saving}>-1천</button>
                      <input className="field-input pricing-hub-base-input" type="number" inputMode="numeric" min="0" step="1000" value={base24hInput} onChange={(e) => setBase24hInput(e.target.value)} disabled={!policyEditorPolicyId || saving} />
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setBase24hInput(String(roundAmount(base24hInput) + 1000))} disabled={!policyEditorPolicyId || saving}>+1천</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setBase24hInput(String(roundAmount(base24hInput) + 10000))} disabled={!policyEditorPolicyId || saving}>+1만</button>
                    </div>
                  </div>
                  <div className="reservation-result-row pricing-hub-adjust-row">
                    <span>주중 비율(%)</span>
                    <div className="pricing-hub-percent-control">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => adjustPercent('weekday', -5)} disabled={!policyEditorPolicyId || saving}>-</button>
                      <div className="pricing-hub-input-wrap">
                        <input className="field-input pricing-hub-percent-input" style={{ minWidth: 88, width: 88 }} type="number" inputMode="decimal" min="0" step="5" value={weekdayPercentInput} onChange={(e) => handlePercentChange('weekday', e.target.value)} disabled={!policyEditorPolicyId || saving} />
                        <span className="pricing-hub-percent-suffix">%</span>
                      </div>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => adjustPercent('weekday', 5)} disabled={!policyEditorPolicyId || saving}>+</button>
                    </div>
                  </div>
                  <div className="reservation-result-row pricing-hub-adjust-row">
                    <span>주말 비율(%)</span>
                    <div className="pricing-hub-percent-control">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => adjustPercent('weekend', -5)} disabled={!policyEditorPolicyId || saving}>-</button>
                      <div className="pricing-hub-input-wrap">
                        <input className="field-input pricing-hub-percent-input" style={{ minWidth: 88, width: 88 }} type="number" inputMode="decimal" min="0" step="5" value={weekendPercentInput} onChange={(e) => handlePercentChange('weekend', e.target.value)} disabled={!policyEditorPolicyId || saving} />
                        <span className="pricing-hub-percent-suffix">%</span>
                      </div>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => adjustPercent('weekend', 5)} disabled={!policyEditorPolicyId || saving}>+</button>
                    </div>
                  </div>
                  <div className="reservation-result-row pricing-hub-adjust-row">
                    <span>정책등급</span>
                    <select className="field-input pricing-hub-select" value={policyPreviewOptionTypeInput} onChange={(e) => setPolicyPreviewOptionTypeInput(normalizePricingOptionType(e.target.value))} disabled={!policyEditorPolicyId || saving}>
                      <option value="basic">기본</option>
                      <option value="semi_premium">세미프리미엄</option>
                      <option value="premium">프리미엄</option>
                    </select>
                  </div>
                  <div style={{ height: 1, background: '#e5e7eb', margin: '4px 0' }} />
                  <InfoBlock title="정책 가격 미리보기">
                    <MoneyGrid items={[
                      { label: '기준24', value: policyEditorPreview?.base24h },
                      { label: '주말24', value: policyEditorPreview?.weekendApplied24h },
                      { label: '1시간', value: policyEditorPreview?.fee1h },
                      { label: '주중24', value: policyEditorPreview?.weekdayApplied24h },
                      { label: '7일', value: policyEditorPreview?.week1Price },
                      { label: '14일', value: policyEditorPreview?.week2Price },
                      { label: '30일', value: policyEditorPreview?.month1Price },
                    ]} />
                  </InfoBlock>
                  <p className="small-note" style={{ margin: 0 }}>정책등급은 가격정책 자체에 저장되며 차량 연결에서는 변경하지 않습니다.</p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    </PageShell>
  )
}
