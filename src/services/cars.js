import { buildSearchQuery } from '../utils/searchQuery'
import { cars as mockCars } from '../data/mock'
import { parseApiResponse } from '../utils/apiResponse'

function sortCars(cars, order) {
  const nextCars = [...cars]

  if (order === 'higher') {
    return nextCars.sort((a, b) => parsePrice(b.dayPrice) - parsePrice(a.dayPrice))
  }

  if (order === 'newer') {
    return nextCars.sort((a, b) => parseYearLabel(b.yearLabel) - parseYearLabel(a.yearLabel))
  }

  return nextCars.sort((a, b) => parsePrice(a.dayPrice) - parsePrice(b.dayPrice))
}

function parsePrice(priceText) {
  return Number(String(priceText || '').replace(/[^\d]/g, '')) || 0
}

function parseYearLabel(yearLabel) {
  const matches = String(yearLabel || '').match(/\d+/g)
  if (!matches?.length) return 0
  return Math.max(...matches.map((value) => Number(value)))
}

function applyAgeFilter(cars, driverAge) {
  if (Number(driverAge) === 26) {
    return cars.filter((car) => car.ageLabel.includes('26'))
  }

  return cars
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`
}

function formatYearLabel(minModelYear, maxModelYear) {
  const min = Number(minModelYear)
  const max = Number(maxModelYear)

  if (!min && !max) return '-'
  if (min && max && min !== max) return `${String(min).slice(-2)}~${String(max).slice(-2)}년식`
  return `${String(max || min).slice(-2)}년식`
}

function toCardModel(car, searchState) {
  const deliveryPrice = Number(car.deliveryPrice || 0)
  const isDelivery = searchState.pickupOption === 'delivery'
  const finalDiscountPrice = Number(car.discountPrice || 0) + (isDelivery ? deliveryPrice : 0)
  const finalOriginPrice = Number(car.price || 0) + (isDelivery ? deliveryPrice : 0)

  return {
    id: String(car.carId),
    groupId: car.groupId == null ? null : String(car.groupId),
    detailToken: car.detailToken || '',
    name: car.name,
    image: car.imageUrl,
    yearLabel: formatYearLabel(car.minModelYear, car.maxModelYear),
    ageLabel: `만${car.insuranceAge}세`,
    fuelType: car.oilType,
    seats: `${car.capacity}인승`,
    dayPrice: formatMoney(finalDiscountPrice),
    totalPrice: formatMoney(finalOriginPrice),
    features: Array.isArray(car.options) ? car.options : [],
    raw: car,
  }
}

function buildRequestQuery(searchState) {
  return buildSearchQuery(searchState)
}

export function getMockCars(searchState) {
  const filteredCars = applyAgeFilter(mockCars, searchState.driverAge)
  const sortedCars = sortCars(filteredCars, searchState.order)

  return {
    cars: sortedCars,
    totalCount: sortedCars.length,
  }
}

export async function fetchSearchCars(searchState) {
  const query = buildRequestQuery(searchState)
  const response = await fetch(`/api/search-cars?${query}`)
  const payload = await parseApiResponse(response, '차량 조회에 실패했습니다.')
  const mappedCars = Array.isArray(payload.cars) ? payload.cars.map((car) => toCardModel(car, searchState)) : []
  const sortedCars = sortCars(mappedCars, searchState.order)

  return {
    search: payload.search,
    company: payload.company,
    totalCount: payload.totalCount,
    cars: sortedCars,
    meta: payload.meta,
  }
}

