'use strict'

const { createServerPrivilegedClient } = require('../../server/supabase/createServerClient')
const { getAccessTokenFromRequest } = require('../../server/auth/getAccessTokenFromRequest')
const { getUserFromAccessToken } = require('../../server/auth/getUserFromAccessToken')
const { assertAdminUser } = require('../../server/auth/adminAccess')

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeNumber(value, fallback = 0) {
  if (value == null || value === '') return fallback
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }

  return {}
}

function buildActorLabel(authUser) {
  return authUser?.phone || authUser?.user_metadata?.phone || authUser?.email || authUser?.id || 'admin'
}

function toMap(items, keyField) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const key = item?.[keyField]
    if (!key) return acc
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})
}

function roundAmount(value) {
  return Math.max(0, Math.round(normalizeNumber(value, 0)))
}

function roundUpToThousand(value) {
  return Math.max(0, Math.ceil(normalizeNumber(value, 0) / 1000) * 1000)
}

function roundPercent(value, fallback = 0) {
  const next = normalizeNumber(value, fallback)
  return Math.max(0, Math.round(next * 100) / 100)
}

const DEFAULT_PRICING_OPTION_TYPE = 'semi_premium'
const PRICING_OPTION_CONFIG = {
  basic: { hour1: 0.12, week1: 5.5, week2: 7.5, month1: 10.5 },
  semi_premium: { hour1: 0.12, week1: 5.5, week2: 8.0, month1: 12.0 },
  premium: { hour1: 0.14, week1: 6.5, week2: 9.0, month1: 14.0 },
}

function normalizePricingOptionType(value) {
  const normalized = normalizeText(value).toLowerCase()
  return PRICING_OPTION_CONFIG[normalized] ? normalized : DEFAULT_PRICING_OPTION_TYPE
}

function computeRatios(legacyPolicy) {
  const base24 = normalizeNumber(legacyPolicy?.baseDailyPrice ?? legacyPolicy?.base_daily_price, 0)
  if (base24 <= 0) {
    return {
      fee6h: 0.55,
      fee12h: 0.8,
      fee1h: 0.04,
      week1Price: 6.5,
      week2Price: 12.5,
      month1Price: 24,
      long24hPrice: 1,
      long1hPrice: 0.04,
    }
  }

  return {
    fee6h: normalizeNumber(legacyPolicy?.hour6Price ?? legacyPolicy?.hour_6_price, base24 * 0.55) / base24,
    fee12h: normalizeNumber(legacyPolicy?.hour12Price ?? legacyPolicy?.hour_12_price, base24 * 0.8) / base24,
    fee1h: normalizeNumber(legacyPolicy?.hour1Price ?? legacyPolicy?.hour_1_price, base24 * 0.04) / base24,
    week1Price: normalizeNumber(legacyPolicy?.weekday7dPlusPrice ?? legacyPolicy?.weekday_7d_plus_price, base24 * 6.5) / base24,
    week2Price: normalizeNumber(legacyPolicy?.weekend7dPlusPrice ?? legacyPolicy?.weekend_7d_plus_price, base24 * 12.5) / base24,
    month1Price: 24,
    long24hPrice: 1,
    long1hPrice: normalizeNumber(legacyPolicy?.hour1Price ?? legacyPolicy?.hour_1_price, base24 * 0.1) / base24,
  }
}

function buildRatePayloadFromBase(base24h, ratios, pricingOptionType) {
  const applied24h = roundUpToThousand(base24h)
  const option = PRICING_OPTION_CONFIG[normalizePricingOptionType(pricingOptionType)]
  return {
    fee6h: roundUpToThousand(applied24h * ratios.fee6h),
    fee12h: roundUpToThousand(applied24h * ratios.fee12h),
    fee24h: applied24h,
    fee1h: roundUpToThousand(applied24h * option.hour1),
    week1Price: roundUpToThousand(applied24h * option.week1),
    week2Price: roundUpToThousand(applied24h * option.week2),
    month1Price: roundUpToThousand(applied24h * option.month1),
    long24hPrice: roundUpToThousand(applied24h * ratios.long24hPrice),
    long1hPrice: roundUpToThousand(applied24h * ratios.long1hPrice),
  }
}

function buildComputedRate(legacyPolicy, base24Input, weekdayRatePercentInput, weekendRatePercentInput, pricingOptionTypeInput) {
  const base24h = roundUpToThousand(base24Input)
  const weekdayRatePercent = roundPercent(weekdayRatePercentInput, 100)
  const weekendRatePercent = roundPercent(weekendRatePercentInput, 100)
  const weekdayApplied24h = roundUpToThousand(base24h * (weekdayRatePercent / 100))
  const weekendApplied24h = roundUpToThousand(base24h * (weekendRatePercent / 100))
  const ratios = computeRatios(legacyPolicy)
  const pricingOptionType = normalizePricingOptionType(pricingOptionTypeInput)

  return {
    base24h,
    pricingOptionType,
    weekdayRatePercent,
    weekendRatePercent,
    weekdayApplied24h,
    weekendApplied24h,
    common: buildRatePayloadFromBase(base24h, ratios, pricingOptionType),
    weekday: buildRatePayloadFromBase(weekdayApplied24h, ratios, pricingOptionType),
    weekend: buildRatePayloadFromBase(weekendApplied24h, ratios, pricingOptionType),
  }
}

function getSeoulWeekdayFlag(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Seoul' }).format(date)
  const map = {
    Mon: 'apply_mon',
    Tue: 'apply_tue',
    Wed: 'apply_wed',
    Thu: 'apply_thu',
    Fri: 'apply_fri',
    Sat: 'apply_sat',
    Sun: 'apply_sun',
  }
  return map[weekday] || 'apply_mon'
}

function isPeriodActiveNow(period, now = new Date()) {
  if (!period || period.active === false) return false

  const startAt = period.start_at ? new Date(period.start_at) : null
  const endAt = period.end_at ? new Date(period.end_at) : null
  if (startAt && startAt > now) return false
  if (endAt && endAt < now) return false

  const weekdayFlag = getSeoulWeekdayFlag(now)
  return period[weekdayFlag] !== false
}

function buildCurrentRateSummary(row, periods = [], ratesByPeriodId = {}, now = new Date()) {
  const activePeriod = periods.find((period) => isPeriodActiveNow(period, now)) || null
  const activeRates = activePeriod ? (ratesByPeriodId[activePeriod.id] || []) : []
  const rateByScope = activeRates.reduce((acc, rate) => {
    const scope = normalizeText(rate?.rate_scope) || 'common'
    acc[scope] = rate
    return acc
  }, {})

  const base24h = roundAmount(row?.base_daily_price)
  const legacyWeekday24h = roundAmount(base24h * (normalizeNumber(row?.weekday_rate_percent, 100) / 100))
  const legacyWeekend24h = roundAmount(base24h * (normalizeNumber(row?.weekend_rate_percent, 100) / 100))
  const common24h = roundAmount(rateByScope.common?.fee_24h)
  const weekday24h = roundAmount(rateByScope.weekday?.fee_24h) || common24h || legacyWeekday24h
  const weekend24h = roundAmount(rateByScope.weekend?.fee_24h) || common24h || legacyWeekend24h

  return {
    activePeriodId: activePeriod?.id || null,
    activePeriodName: activePeriod?.period_name || null,
    pricingOptionType: normalizePricingOptionType(row?.pricing_option_type),
    weekday24h,
    weekend24h,
  }
}

async function fetchEditorBase(supabaseClient, { carGroupId, pricePolicyGroupId }) {
  let query = supabaseClient
    .from('v_pricing_hub_policy_editor')
    .select('*')
    .order('policy_name', { ascending: true })

  if (pricePolicyGroupId) {
    query = query.eq('price_policy_group_id', pricePolicyGroupId)
  } else {
    query = query.eq('car_group_id', carGroupId)
  }

  const { data, error } = await query

  if (error) throw error
  return Array.isArray(data) ? data : []
}

async function fetchPeriods(supabaseClient, pricePolicyIds) {
  if (!Array.isArray(pricePolicyIds) || pricePolicyIds.length === 0) return []
  const { data, error } = await supabaseClient
    .from('pricing_hub_periods')
    .select('*')
    .in('price_policy_id', pricePolicyIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  return Array.isArray(data) ? data : []
}

async function fetchRates(supabaseClient, periodIds) {
  if (!Array.isArray(periodIds) || periodIds.length === 0) return []
  const { data, error } = await supabaseClient
    .from('pricing_hub_rates')
    .select('*')
    .in('pricing_hub_period_id', periodIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  return Array.isArray(data) ? data : []
}

async function fetchCarNumbersByImsGroupIds(supabaseClient, imsGroupIds) {
  const normalizedIds = [...new Set((Array.isArray(imsGroupIds) ? imsGroupIds : []).filter(Boolean).map(Number))]
  if (normalizedIds.length === 0) return {}

  const { data, error } = await supabaseClient
    .from('cars')
    .select('source_group_id, car_number')
    .in('source_group_id', normalizedIds)
    .order('car_number', { ascending: true })

  if (error) throw error

  return (Array.isArray(data) ? data : []).reduce((acc, item) => {
    const key = String(item?.source_group_id || '')
    if (!key) return acc
    if (!acc[key]) acc[key] = []
    if (item?.car_number) acc[key].push(String(item.car_number))
    return acc
  }, {})
}

async function fetchActiveCarGroups(supabaseClient) {
  const { data, error } = await supabaseClient
    .from('car_groups')
    .select('id, ims_group_id, group_name, active')
    .eq('active', true)
    .order('ims_group_id', { ascending: true })

  if (error) throw error
  return Array.isArray(data) ? data : []
}

async function fetchActivePolicies(supabaseClient) {
  const { data, error } = await supabaseClient
    .from('price_policies')
    .select('id, policy_name, active, base_daily_price, weekday_rate_percent, weekend_rate_percent')
    .eq('active', true)
    .order('policy_name', { ascending: true })

  if (error) throw error
  return Array.isArray(data) ? data : []
}

async function fetchGroupMappings(supabaseClient, carGroupIds) {
  let query = supabaseClient
    .from('price_policy_groups')
    .select('id, car_group_id, price_policy_id, pricing_option_type, active, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (Array.isArray(carGroupIds) && carGroupIds.length > 0) {
    query = query.in('car_group_id', carGroupIds)
  }

  const { data, error } = await query

  if (error) throw error
  return Array.isArray(data) ? data : []
}

function buildRateByScope(rates = []) {
  return (Array.isArray(rates) ? rates : []).reduce((acc, rate) => {
    const scope = normalizeText(rate?.rate_scope) || 'common'
    acc[scope] = rate
    return acc
  }, {})
}

function getActivePeriod(periods = [], now = new Date()) {
  const items = Array.isArray(periods) ? periods : []
  return items.find((period) => isPeriodActiveNow(period, now)) || items.find((period) => period?.active !== false) || items[0] || null
}

function buildEditorState(baseRow, periods = [], ratesByPeriodId = {}, now = new Date()) {
  const relatedPeriods = (Array.isArray(periods) ? periods : []).filter((period) => period?.price_policy_id === baseRow?.price_policy_id)
  const activePeriod = getActivePeriod(relatedPeriods, now)
  const rateByScope = buildRateByScope(activePeriod ? ratesByPeriodId[activePeriod.id] || [] : [])
  const base24h = roundAmount(rateByScope.common?.fee_24h || baseRow?.base_daily_price)
  const fallbackWeekday24h = roundAmount(base24h * (normalizeNumber(baseRow?.weekday_rate_percent, 100) / 100))
  const fallbackWeekend24h = roundAmount(base24h * (normalizeNumber(baseRow?.weekend_rate_percent, 100) / 100))
  const weekday24h = roundAmount(rateByScope.weekday?.fee_24h || fallbackWeekday24h)
  const weekend24h = roundAmount(rateByScope.weekend?.fee_24h || fallbackWeekend24h)

  return {
    activePeriodId: activePeriod?.id || null,
    activePeriodName: activePeriod?.period_name || null,
    pricingOptionType: normalizePricingOptionType(baseRow?.pricing_option_type),
    base24h,
    weekdayPercent: base24h > 0 ? roundPercent((weekday24h / base24h) * 100, normalizeNumber(baseRow?.weekday_rate_percent, 100)) : roundPercent(baseRow?.weekday_rate_percent, 100),
    weekendPercent: base24h > 0 ? roundPercent((weekend24h / base24h) * 100, normalizeNumber(baseRow?.weekend_rate_percent, 100)) : roundPercent(baseRow?.weekend_rate_percent, 100),
    weekday24h,
    weekend24h,
  }
}

async function handleList(req, res, supabaseClient) {
  const q = normalizeText(req.query?.q).toLowerCase()

  const { data, error } = await supabaseClient
    .from('v_pricing_hub_policy_editor')
    .select('*')
    .order('ims_group_id', { ascending: true })

  if (error) {
    return res.status(500).json({ error: 'pricing_hub_list_failed', message: error.message })
  }

  const rows = Array.isArray(data) ? data : []
  const filteredRows = q
    ? rows.filter((row) => [row.group_name, row.policy_name, row.ims_group_id].some((value) => String(value || '').toLowerCase().includes(q)))
    : rows

  const pricePolicyIds = [...new Set(filteredRows.map((row) => row.price_policy_id).filter(Boolean))]
  const periodsResult = await fetchPeriods(supabaseClient, pricePolicyIds)
  const ratesResult = await fetchRates(supabaseClient, periodsResult.map((item) => item.id))
  const activeCarGroups = await fetchActiveCarGroups(supabaseClient)
  const activePolicies = await fetchActivePolicies(supabaseClient)
  const mappings = await fetchGroupMappings(supabaseClient, activeCarGroups.map((item) => item.id))

  const periodsByPolicyId = toMap(periodsResult, 'price_policy_id')
  const ratesByPeriodId = toMap(ratesResult, 'pricing_hub_period_id')

  const items = filteredRows.map((row) => {
    const relatedPeriods = periodsByPolicyId[row.price_policy_id] || []
    const currentRateSummary = buildCurrentRateSummary(row, relatedPeriods, ratesByPeriodId)
    const editorState = buildEditorState(row, relatedPeriods, ratesByPeriodId)

    return {
      carGroupId: row.car_group_id,
      imsGroupId: row.ims_group_id,
      groupName: row.group_name,
      pricePolicyGroupId: row.price_policy_group_id,
      pricePolicyId: row.price_policy_id,
      policyName: row.policy_name,
      pricingOptionType: normalizePricingOptionType(row.pricing_option_type),
      legacyPolicy: {
        baseDailyPrice: row.base_daily_price,
        weekdayRatePercent: row.weekday_rate_percent,
        weekendRatePercent: row.weekend_rate_percent,
        hour1Price: row.hour_1_price,
        hour6Price: row.hour_6_price,
        hour12Price: row.hour_12_price,
        effectiveFrom: row.effective_from,
        effectiveTo: row.effective_to,
        active: row.policy_active,
      },
      currentRateSummary,
      currentVariables: {
        base24h: editorState.base24h,
        weekdayPercent: editorState.weekdayPercent,
        weekendPercent: editorState.weekendPercent,
      },
      groupSettingActive: row.active !== false,
      hubPeriodsCount: relatedPeriods.length,
      hubOverridesCount: 0,
    }
  }).sort((a, b) => {
    const aValue = normalizeNumber(a?.currentRateSummary?.weekday24h, normalizeNumber(a?.currentVariables?.base24h, 0))
    const bValue = normalizeNumber(b?.currentRateSummary?.weekday24h, normalizeNumber(b?.currentVariables?.base24h, 0))
    if (aValue !== bValue) return aValue - bValue
    return String(a?.groupName || '').localeCompare(String(b?.groupName || ''), 'ko')
  })

  const activeMappedCarGroupIds = new Set(
    mappings
      .filter((item) => item?.active !== false)
      .map((item) => String(item?.car_group_id || ''))
      .filter(Boolean),
  )

  const unconfiguredGroups = activeCarGroups
    .filter((item) => !activeMappedCarGroupIds.has(String(item.id || '')))
    .filter((row) => !q || [row.group_name, row.ims_group_id].some((value) => String(value || '').toLowerCase().includes(q)))
    .map((row) => ({
      carGroupId: row.id,
      imsGroupId: row.ims_group_id,
      groupName: row.group_name,
    }))

  const policyOptions = activePolicies.map((policy) => ({
    pricePolicyId: policy.id,
    policyName: policy.policy_name,
    baseDailyPrice: policy.base_daily_price,
    weekdayRatePercent: policy.weekday_rate_percent,
    weekendRatePercent: policy.weekend_rate_percent,
  }))

  return res.status(200).json({ items, unconfiguredGroups, policyOptions })
}

async function handleGetPolicyEditor(req, res, supabaseClient) {
  const pricePolicyGroupId = normalizeText(req.query?.pricePolicyGroupId)
  const carGroupId = normalizeText(req.query?.carGroupId)
  if (!pricePolicyGroupId && !carGroupId) {
    return res.status(400).json({ error: 'missing_price_policy_group_id', message: 'pricePolicyGroupId 가 필요합니다.' })
  }

  const baseRows = await fetchEditorBase(supabaseClient, { carGroupId, pricePolicyGroupId })
  if (baseRows.length === 0) {
    return res.status(404).json({ error: 'group_not_found', message: '대상 그룹을 찾지 못했습니다.' })
  }

  const pricePolicyIds = [...new Set(baseRows.map((row) => row.price_policy_id).filter(Boolean))]
  const periods = await fetchPeriods(supabaseClient, pricePolicyIds)
  const rates = await fetchRates(supabaseClient, periods.map((item) => item.id))
  const carNumbersByGroupId = await fetchCarNumbersByImsGroupIds(supabaseClient, [baseRows[0]?.ims_group_id])

  const ratesByPeriodId = toMap(rates, 'pricing_hub_period_id')
  const editorState = buildEditorState(baseRows[0], periods, ratesByPeriodId)

  const policies = pricePolicyIds.map((pricePolicyId) => {
    const base = baseRows.find((row) => row.price_policy_id === pricePolicyId)
    const relatedPeriods = periods
      .filter((item) => item.price_policy_id === pricePolicyId)
      .map((period) => ({
        ...period,
        rates: ratesByPeriodId[period.id] || [],
      }))

    return {
      pricePolicyId,
      policyName: base?.policy_name || '-',
      legacyPolicy: {
        baseDailyPrice: base?.base_daily_price,
        weekdayRatePercent: base?.weekday_rate_percent,
        weekendRatePercent: base?.weekend_rate_percent,
        weekday12dPrice: base?.weekday_1_2d_price,
        weekday34dPrice: base?.weekday_3_4d_price,
        weekday56dPrice: base?.weekday_5_6d_price,
        weekday7dPlusPrice: base?.weekday_7d_plus_price,
        weekend12dPrice: base?.weekend_1_2d_price,
        weekend34dPrice: base?.weekend_3_4d_price,
        weekend56dPrice: base?.weekend_5_6d_price,
        weekend7dPlusPrice: base?.weekend_7d_plus_price,
        hour1Price: base?.hour_1_price,
        hour6Price: base?.hour_6_price,
        hour12Price: base?.hour_12_price,
        effectiveFrom: base?.effective_from,
        effectiveTo: base?.effective_to,
        active: base?.policy_active,
      },
      periods: relatedPeriods,
    }
  })

  return res.status(200).json({
    group: {
      carGroupId: baseRows[0].car_group_id,
      imsGroupId: baseRows[0].ims_group_id,
      groupName: baseRows[0].group_name,
      pricePolicyGroupId: baseRows[0].price_policy_group_id,
      pricingOptionType: normalizePricingOptionType(baseRows[0].pricing_option_type),
      carNumbers: carNumbersByGroupId[String(baseRows[0].ims_group_id)] || [],
    },
    editorState,
    policies,
    overrides: [],
  })
}


async function handleSaveGroupSetting(req, res, supabaseClient, authUser) {
  const body = await parseJsonBody(req)
  const id = normalizeText(body.id || body.pricePolicyGroupId)
  const carGroupId = normalizeText(body.carGroupId)
  const pricePolicyId = normalizeText(body.pricePolicyId)
  const pricingOptionType = normalizePricingOptionType(body.pricingOptionType)
  const active = body.active !== false

  if (!carGroupId || !pricePolicyId) {
    return res.status(400).json({ error: 'invalid_group_setting_payload', message: 'carGroupId 와 pricePolicyId 가 필요합니다.' })
  }

  const mappings = await fetchGroupMappings(supabaseClient, [carGroupId])
  const duplicatePair = mappings.find((item) => item.car_group_id === carGroupId && item.price_policy_id === pricePolicyId)
  let targetId = id

  if (duplicatePair && (!id || duplicatePair.id !== id)) {
    targetId = duplicatePair.id
  }

  if (active) {
    const { error: deactivateError } = await supabaseClient
      .from('price_policy_groups')
      .update({ active: false })
      .eq('car_group_id', carGroupId)

    if (deactivateError) {
      return res.status(500).json({ error: 'save_group_setting_deactivate_failed', message: deactivateError.message })
    }
  }

  const metadata = {
    source: 'admin-pricing-hub-group-setting',
    savedBy: buildActorLabel(authUser),
    savedAt: new Date().toISOString(),
  }

  const basePayload = {
    price_policy_id: pricePolicyId,
    pricing_option_type: pricingOptionType,
    active,
    metadata,
  }

  const query = targetId
    ? supabaseClient
        .from('price_policy_groups')
        .update(basePayload)
        .eq('id', targetId)
        .select('*')
        .single()
    : supabaseClient
        .from('price_policy_groups')
        .insert({
          car_group_id: carGroupId,
          ...basePayload,
          match_source: 'admin',
        })
        .select('*')
        .single()

  const { data, error } = await query
  if (error) {
    return res.status(500).json({ error: 'save_group_setting_failed', message: error.message })
  }

  return res.status(200).json({
    item: {
      pricePolicyGroupId: data.id,
      carGroupId: data.car_group_id,
      pricePolicyId: data.price_policy_id,
      pricingOptionType: normalizePricingOptionType(data.pricing_option_type),
      active: data.active !== false,
    },
  })
}

async function handleSaveEditor(req, res, supabaseClient, authUser) {
  const body = await parseJsonBody(req)
  const pricePolicyGroupId = normalizeText(body.pricePolicyGroupId)
  const carGroupId = normalizeText(body.carGroupId)
  if (!pricePolicyGroupId && !carGroupId) {
    return res.status(400).json({ error: 'missing_price_policy_group_id', message: 'pricePolicyGroupId 가 필요합니다.' })
  }

  const baseRows = await fetchEditorBase(supabaseClient, { carGroupId, pricePolicyGroupId })
  if (baseRows.length === 0) {
    return res.status(404).json({ error: 'group_not_found', message: '대상 그룹을 찾지 못했습니다.' })
  }

  const base = baseRows[0]
  const periods = await fetchPeriods(supabaseClient, [base.price_policy_id])
  let activePeriod = getActivePeriod(periods.filter((item) => item.price_policy_id === base.price_policy_id))

  if (!activePeriod) {
    const { data: createdPeriod, error: periodError } = await supabaseClient
      .from('pricing_hub_periods')
      .insert({
        price_policy_id: base.price_policy_id,
        period_name: '기본',
        active: true,
        metadata: {
          source: 'admin-pricing-hub-editor',
          createdBy: buildActorLabel(authUser),
        },
      })
      .select('*')
      .single()

    if (periodError) {
      return res.status(500).json({ error: 'save_editor_period_failed', message: periodError.message })
    }

    activePeriod = createdPeriod
  }

  const computed = buildComputedRate(base, body.base24h, body.weekdayPercent, body.weekendPercent, body.pricingOptionType)

  const { error: mappingError } = await supabaseClient
    .from('price_policy_groups')
    .update({ pricing_option_type: computed.pricingOptionType })
    .eq('id', base.price_policy_group_id)

  if (mappingError) {
    return res.status(500).json({ error: 'save_editor_mapping_failed', message: mappingError.message })
  }

  const metadata = {
    source: 'admin-pricing-hub-editor',
    savedBy: buildActorLabel(authUser),
    savedAt: new Date().toISOString(),
    base24h: computed.base24h,
    weekdayPercent: computed.weekdayRatePercent,
    weekendPercent: computed.weekendRatePercent,
    pricingOptionType: computed.pricingOptionType,
  }

  const rows = [
    { rate_scope: 'common', ...computed.common },
    { rate_scope: 'weekday', ...computed.weekday },
    { rate_scope: 'weekend', ...computed.weekend },
  ].map((item) => ({
    pricing_hub_period_id: activePeriod.id,
    rate_scope: item.rate_scope,
    fee_6h: item.fee6h,
    fee_12h: item.fee12h,
    fee_24h: item.fee24h,
    fee_1h: item.fee1h,
    week_1_price: item.week1Price,
    week_2_price: item.week2Price,
    month_1_price: item.month1Price,
    long_24h_price: item.long24hPrice,
    long_1h_price: item.long1hPrice,
    metadata,
  }))

  const { data: savedRates, error: ratesError } = await supabaseClient
    .from('pricing_hub_rates')
    .upsert(rows, { onConflict: 'pricing_hub_period_id,rate_scope' })
    .select('*')

  if (ratesError) {
    return res.status(500).json({ error: 'save_editor_rates_failed', message: ratesError.message })
  }

  return res.status(200).json({
    item: {
      activePeriod,
      rates: savedRates,
      editorState: {
        activePeriodId: activePeriod.id,
        activePeriodName: activePeriod.period_name,
        pricingOptionType: computed.pricingOptionType,
        base24h: computed.base24h,
        weekdayPercent: computed.weekdayRatePercent,
        weekendPercent: computed.weekendRatePercent,
        weekday24h: computed.weekdayApplied24h,
        weekend24h: computed.weekendApplied24h,
      },
    },
  })
}

async function handleSavePeriod(req, res, supabaseClient) {
  const body = await parseJsonBody(req)
  const id = normalizeText(body.id)
  const payload = {
    price_policy_id: normalizeText(body.pricePolicyId),
    period_name: normalizeText(body.periodName),
    start_at: body.startAt || null,
    end_at: body.endAt || null,
    apply_mon: body.applyMon !== false,
    apply_tue: body.applyTue !== false,
    apply_wed: body.applyWed !== false,
    apply_thu: body.applyThu !== false,
    apply_fri: body.applyFri !== false,
    apply_sat: body.applySat !== false,
    apply_sun: body.applySun !== false,
    active: body.active !== false,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  }

  if (!payload.price_policy_id || !payload.period_name) {
    return res.status(400).json({ error: 'invalid_period_payload', message: 'pricePolicyId 와 periodName 이 필요합니다.' })
  }

  const query = id
    ? supabaseClient.from('pricing_hub_periods').update(payload).eq('id', id).select('*').single()
    : supabaseClient.from('pricing_hub_periods').insert(payload).select('*').single()

  const { data, error } = await query
  if (error) {
    return res.status(500).json({ error: 'save_period_failed', message: error.message })
  }

  return res.status(200).json({ item: data })
}

async function handleSaveRate(req, res, supabaseClient) {
  const body = await parseJsonBody(req)
  const id = normalizeText(body.id)
  const payload = {
    pricing_hub_period_id: normalizeText(body.pricingHubPeriodId),
    rate_scope: normalizeText(body.rateScope) || 'common',
    fee_6h: normalizeNumber(body.fee6h, 0),
    fee_12h: normalizeNumber(body.fee12h, 0),
    fee_24h: normalizeNumber(body.fee24h, 0),
    fee_1h: normalizeNumber(body.fee1h, 0),
    discount_percent: body.discountPercent == null || body.discountPercent === '' ? null : normalizeNumber(body.discountPercent, 0),
    discount_amount: body.discountAmount == null || body.discountAmount === '' ? null : normalizeNumber(body.discountAmount, 0),
    week_1_price: body.week1Price == null || body.week1Price === '' ? null : normalizeNumber(body.week1Price, 0),
    week_2_price: body.week2Price == null || body.week2Price === '' ? null : normalizeNumber(body.week2Price, 0),
    month_1_price: body.month1Price == null || body.month1Price === '' ? null : normalizeNumber(body.month1Price, 0),
    long_24h_price: body.long24hPrice == null || body.long24hPrice === '' ? null : normalizeNumber(body.long24hPrice, 0),
    long_1h_price: body.long1hPrice == null || body.long1hPrice === '' ? null : normalizeNumber(body.long1hPrice, 0),
    weekend_days: normalizeText(body.weekendDays) || null,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  }

  if (!payload.pricing_hub_period_id) {
    return res.status(400).json({ error: 'invalid_rate_payload', message: 'pricingHubPeriodId 가 필요합니다.' })
  }

  const query = id
    ? supabaseClient.from('pricing_hub_rates').update(payload).eq('id', id).select('*').single()
    : supabaseClient.from('pricing_hub_rates').upsert(payload, { onConflict: 'pricing_hub_period_id,rate_scope' }).select('*').single()

  const { data, error } = await query
  if (error) {
    return res.status(500).json({ error: 'save_rate_failed', message: error.message })
  }

  return res.status(200).json({ item: data })
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const supabaseClient = createServerPrivilegedClient()
  if (!supabaseClient) {
    return res.status(500).json({ error: 'supabase_client_unavailable' })
  }

  const accessToken = getAccessTokenFromRequest(req)
  if (!accessToken) {
    return res.status(401).json({ error: 'missing_access_token', message: '로그인이 필요합니다.' })
  }

  try {
    const authUser = await getUserFromAccessToken({ supabaseClient, accessToken })
    if (!authUser) {
      return res.status(401).json({ error: 'invalid_access_token', message: '로그인이 필요합니다.' })
    }

    const access = assertAdminUser(authUser)
    if (!access.ok) {
      return res.status(access.status).json({ error: access.code, message: access.message })
    }

    const action = normalizeText(req.query?.action || req.body?.action).toLowerCase()

    if (req.method === 'GET' && (action === 'list-groups' || !action)) {
      return handleList(req, res, supabaseClient)
    }

    if (req.method === 'GET' && action === 'get-policy-editor') {
      return handleGetPolicyEditor(req, res, supabaseClient)
    }

    if (req.method === 'POST' && action === 'save-period') {
      return handleSavePeriod(req, res, supabaseClient)
    }

    if (req.method === 'POST' && action === 'save-rate') {
      return handleSaveRate(req, res, supabaseClient)
    }

    if (req.method === 'POST' && action === 'save-editor') {
      return handleSaveEditor(req, res, supabaseClient, authUser)
    }

    if (req.method === 'POST' && action === 'save-group-setting') {
      return handleSaveGroupSetting(req, res, supabaseClient, authUser)
    }

    return res.status(404).json({ error: 'not_found' })
  } catch (error) {
    return res.status(500).json({
      error: 'pricing_hub_failed',
      message: error?.message || 'pricing_hub_failed',
    })
  }
}
