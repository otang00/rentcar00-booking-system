'use strict'

const { buildSearchWindow } = require('./helpers/buildSearchWindow')
const { composeReadModel } = require('./transformers/composeReadModel')
const { mapDeliveryRegionsToCompany } = require('./transformers/mapDeliveryRegionsToCompany')
const { fetchCandidateCars } = require('./repositories/fetchCandidateCars')
const { fetchBlockingReservations } = require('./repositories/fetchBlockingReservations')
const { fetchBlockingBookingOrders } = require('./repositories/fetchBlockingBookingOrders')
const { fetchPriceRules } = require('./repositories/fetchPriceRules')
const { fetchDeliveryRegions } = require('./repositories/fetchDeliveryRegions')
const { normalizeSearchState } = require('../search/searchState')

async function run({
  search,
  supabaseClient,
  options = {},
  repositories = {},
} = {}) {
  if (!search) {
    throw new Error('search state is required')
  }

  if (!supabaseClient && !repositories.fetchCandidateCars) {
    throw new Error('supabase client is required')
  }

  const normalizedSearch = normalizeSearchState(search)
  const searchWindow = buildSearchWindow(normalizedSearch)

  const fetchCars = repositories.fetchCandidateCars || fetchCandidateCars
  const fetchReservations = repositories.fetchBlockingReservations || fetchBlockingReservations
  const fetchBookings = repositories.fetchBlockingBookingOrders || fetchBlockingBookingOrders
  const fetchPrices = repositories.fetchPriceRules || fetchPriceRules
  const fetchDelivery = repositories.fetchDeliveryRegions || fetchDeliveryRegions

  const [deliveryRegions, deliveryRegionRows, candidateCars] = await Promise.all([
    fetchDelivery({ supabaseClient }),
    normalizedSearch.pickupOption === 'delivery' && normalizedSearch.dongId != null
      ? fetchDelivery({ supabaseClient, dongId: normalizedSearch.dongId })
      : Promise.resolve([]),
    fetchCars({
      supabaseClient,
      search: normalizedSearch,
      searchWindow,
    }),
  ])

  const deliveryRegion = deliveryRegionRows[0] || null

  if (normalizedSearch.pickupOption === 'delivery' && !deliveryRegion) {
    return {
      search: normalizedSearch,
      company: {
        ...(options.company || {}),
        deliveryCostList: mapDeliveryRegionsToCompany(deliveryRegions),
      },
      totalCount: 0,
      cars: [],
      meta: {
        source: 'db-search',
        stage: options.stage || 'scaffold',
      },
    }
  }

  const carIds = candidateCars
    .map((car) => car.source_car_id || car.car_id || car.id)
    .filter(Boolean)
  const sourceGroupIds = candidateCars.map((car) => car.source_group_id).filter((value) => value != null)

  const dbCarIds = candidateCars.map((car) => car.id).filter(Boolean)

  const [reservations, bookingOrders, groupPolicies] = await Promise.all([
    fetchReservations({ supabaseClient, carIds, searchWindow }),
    fetchBookings({
      supabaseClient,
      dbCarIds,
      pickupAt: searchWindow.startIso,
      returnAt: searchWindow.endIso,
    }),
    fetchPrices({ supabaseClient, carIds, sourceGroupIds, searchWindow }),
  ])

  const readModel = composeReadModel({
    cars: candidateCars,
    reservations: [...reservations, ...bookingOrders],
    priceRules: groupPolicies,
    deliveryRegion,
    searchWindow,
    search: normalizedSearch,
  })

  return {
    search: normalizedSearch,
    company: {
      ...(options.company || {}),
      deliveryCostList: mapDeliveryRegionsToCompany(deliveryRegions),
    },
    totalCount: readModel.dtoCars.length,
    cars: readModel.dtoCars,
    meta: {
      source: 'db-search',
      stage: options.stage || 'scaffold',
    },
  }
}

module.exports = {
  dbSearchService: {
    run,
  },
}
