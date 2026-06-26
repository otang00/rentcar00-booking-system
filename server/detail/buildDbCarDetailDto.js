'use strict'

const { buildSearchWindow } = require('../search-db/helpers/buildSearchWindow')
const { fetchDeliveryRegions } = require('../search-db/repositories/fetchDeliveryRegions')
const { fetchPriceRules } = require('../search-db/repositories/fetchPriceRules')
const { mapDeliveryRegionsToCompany } = require('../search-db/transformers/mapDeliveryRegionsToCompany')
const { buildAppliedGroupPricing } = require('../search-db/pricing/buildAppliedGroupPricing')

const DEFAULT_DELIVERY_TIMES = [
  { dayOfWeek: '월', startAt: '09:00', endAt: '21:00', holiday: false },
  { dayOfWeek: '화', startAt: '09:00', endAt: '21:00', holiday: false },
  { dayOfWeek: '수', startAt: '09:00', endAt: '21:00', holiday: false },
  { dayOfWeek: '목', startAt: '09:00', endAt: '21:00', holiday: false },
  { dayOfWeek: '금', startAt: '09:00', endAt: '21:00', holiday: false },
  { dayOfWeek: '토', startAt: '09:00', endAt: '21:00', holiday: false },
  { dayOfWeek: '일', startAt: '09:00', endAt: '21:00', holiday: false },
]

const DEFAULT_COMPANY = {
  companyId: 35457,
  companyName: '빵빵카(주)',
  companyTel: '025920079',
  fullGarageAddress: '서울 서초구 신반포로23길 78-9 (수푸레하우스) 1층 빵빵카(주)',
  garageLat: 0,
  garageLng: 0,
  deliveryTimes: DEFAULT_DELIVERY_TIMES,
  deliveryCostList: [],
}

function getMetadataValue(metadata, keys = [], fallback = null) {
  if (!metadata || typeof metadata !== 'object') return fallback

  for (const key of keys) {
    const value = metadata[key]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return fallback
}

async function fetchCarRow({ supabaseClient, carId } = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const numericCarId = Number(carId)
  if (!Number.isInteger(numericCarId) || numericCarId <= 0) {
    return null
  }

  const { data, error } = await supabaseClient
    .from('cars')
    .select('*')
    .eq('active', true)
    .eq('source_car_id', numericCarId)
    .limit(1)

  if (error) {
    throw error
  }

  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

function buildCompany({ deliveryRegions = [] } = {}) {
  return {
    ...DEFAULT_COMPANY,
    deliveryTimes: DEFAULT_DELIVERY_TIMES,
    deliveryCostList: mapDeliveryRegionsToCompany(deliveryRegions),
  }
}

function buildPricing({ priceRule, searchWindow, search, deliveryRegion } = {}) {
  return buildAppliedGroupPricing({
    policy: priceRule,
    searchWindow,
    search,
    deliveryRegion,
  }).detailPricing
}

function buildInsurance() {
  return {
    general: {
      category: 'general',
      fee: 0,
      coverage: 0,
      indemnificationFee: 0,
    },
    full: null,
  }
}

function buildCar({ car } = {}) {
  const metadata = car?.metadata || {}
  const drivingYears = Number(getMetadataValue(metadata, ['driving_years', 'drivingYears'], 0) || 0)
  const manufacturerName = String(getMetadataValue(metadata, ['manufacturer_name', 'manufacturerName'], '') || '')
  const model = String(getMetadataValue(metadata, ['model'], '') || '')

  return {
    carId: Number(car?.source_car_id || car?.id || 0),
    name: car?.name || car?.display_name || '',
    displayName: car?.display_name || car?.name || '',
    imageUrl: car?.image_url || '',
    fuelType: car?.fuel_type || '',
    capacity: Number(car?.seats || 0),
    minModelYear: Number(car?.model_year || 0),
    maxModelYear: Number(car?.model_year || 0),
    manufacturerName,
    model,
    rentAge: Number(car?.rent_age || 0),
    drivingYears,
    options: Array.isArray(car?.options_json?.names) ? car.options_json.names : [],
  }
}

async function buildDbCarDetailDto({ supabaseClient, carId, search } = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const car = await fetchCarRow({ supabaseClient, carId })
  if (!car) {
    return null
  }

  const searchWindow = buildSearchWindow(search)
  const [deliveryRegions, deliveryRegionRows, groupPolicies] = await Promise.all([
    fetchDeliveryRegions({ supabaseClient }),
    search.pickupOption === 'delivery' && search.dongId != null
      ? fetchDeliveryRegions({ supabaseClient, dongId: search.dongId })
      : Promise.resolve([]),
    fetchPriceRules({
      supabaseClient,
      carIds: [car.id, car.source_car_id].filter(Boolean),
      sourceGroupIds: [car.source_group_id].filter((value) => value != null),
      searchWindow,
    }),
  ])

  const priceRule = Array.isArray(groupPolicies) && groupPolicies.length > 0 ? groupPolicies[0] : null
  const deliveryRegion = Array.isArray(deliveryRegionRows) && deliveryRegionRows.length > 0
    ? deliveryRegionRows[0]
    : null

  return {
    search,
    company: buildCompany({ deliveryRegions }),
    car: buildCar({ car }),
    pricing: buildPricing({ priceRule, searchWindow, search, deliveryRegion }),
    insurance: buildInsurance(),
    meta: {
      source: 'db-detail',
      carSource: 'supabase',
      pricingSource: (priceRule?.source_group_id || priceRule?.ims_group_id) ? 'group-price-policy' : 'missing-group-price-policy',
      groupId: car.source_group_id == null ? null : Number(car.source_group_id),
    },
  }
}

module.exports = {
  DEFAULT_COMPANY,
  DEFAULT_DELIVERY_TIMES,
  buildDbCarDetailDto,
}
