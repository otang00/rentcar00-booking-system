'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { dbSearchService } = require('../dbSearchService')

function createGroupPolicy({ imsGroupId, policyName, baseDailyPrice, weekdayPrice } = {}) {
  return {
    ims_group_id: imsGroupId,
    price_policy_id: `policy_${imsGroupId}`,
    policy_name: policyName,
    base24h: baseDailyPrice,
    weekday_24h_price: weekdayPrice,
    weekend_24h_price: weekdayPrice,
    hour_1_price: Math.floor(weekdayPrice / 10),
    week_1_price: Math.round(baseDailyPrice * 5.5),
    week_2_price: Math.round(baseDailyPrice * 8.0),
    month_1_price: Math.round(baseDailyPrice * 12.0),
  }
}

function withDefaults(repositories = {}) {
  return {
    async fetchBlockingBookingOrders() {
      return []
    },
    ...repositories,
  }
}

test('dbSearchService filters unavailable cars and maps group pricing', async () => {
  const search = {
    deliveryDateTime: '2026-04-15 10:00',
    returnDateTime: '2026-04-16 10:00',
    pickupOption: 'pickup',
    driverAge: 26,
    order: 'lower',
  }

  const repositories = withDefaults({
    async fetchCandidateCars() {
      return [
        { id: 'car_a', source_group_id: 101, name: '차A', seats: 5, model_year: 2024, rent_age: 26 },
        { id: 'car_b', source_group_id: 102, name: '차B', seats: 5, model_year: 2024, rent_age: 26 },
      ]
    },
    async fetchBlockingReservations() {
      return [
        { car_id: 'car_a', start_at: '2026-04-15T00:00:00Z', end_at: '2026-04-17T00:00:00Z' },
      ]
    },
    async fetchPriceRules() {
      return [
        createGroupPolicy({ imsGroupId: 102, policyName: '차B', baseDailyPrice: 90000, weekdayPrice: 80000 }),
      ]
    },
    async fetchDeliveryRegions() {
      return []
    },
  })

  const result = await dbSearchService.run({ search, repositories })

  assert.equal(result.totalCount, 1)
  assert.equal(result.cars[0].carId, 'car_b')
  assert.equal(result.cars[0].price, 90000)
  assert.equal(result.cars[0].discountPrice, 80000)
})

test('dbSearchService applies group policy pricing when available', async () => {
  const search = {
    deliveryDateTime: '2026-04-16 10:00',
    returnDateTime: '2026-04-17 10:00',
    pickupOption: 'pickup',
    driverAge: 26,
    order: 'lower',
  }

  const repositories = withDefaults({
    async fetchCandidateCars() {
      return [
        { id: 'car_a', source_group_id: 23069, name: '차A', seats: 5, model_year: 2024, rent_age: 26 },
      ]
    },
    async fetchBlockingReservations() {
      return []
    },
    async fetchPriceRules() {
      return [
        createGroupPolicy({ imsGroupId: 23069, policyName: '아반떼', baseDailyPrice: 160000, weekdayPrice: 56000 }),
      ]
    },
    async fetchDeliveryRegions() {
      return []
    },
  })

  const result = await dbSearchService.run({ search, repositories })
  assert.equal(result.totalCount, 1)
  assert.equal(result.cars[0].carId, 'car_a')
  assert.equal(result.cars[0].groupId, 23069)
  assert.equal(result.cars[0].price, 160000)
  assert.equal(result.cars[0].discountPrice, 56000)
})

test('dbSearchService applies higher and newer ordering', async () => {
  const baseSearch = {
    deliveryDateTime: '2026-04-15 10:00',
    returnDateTime: '2026-04-16 10:00',
    pickupOption: 'pickup',
    driverAge: 26,
  }

  const repositories = withDefaults({
    async fetchCandidateCars() {
      return [
        { id: 'car_a', source_group_id: 101, name: '차A', seats: 5, model_year: 2022, rent_age: 26 },
        { id: 'car_b', source_group_id: 102, name: '차B', seats: 5, model_year: 2025, rent_age: 26 },
        { id: 'car_c', source_group_id: 103, name: '차C', seats: 5, model_year: 2024, rent_age: 26 },
      ]
    },
    async fetchBlockingReservations() {
      return []
    },
    async fetchPriceRules() {
      return [
        createGroupPolicy({ imsGroupId: 101, policyName: '차A', baseDailyPrice: 100000, weekdayPrice: 90000 }),
        createGroupPolicy({ imsGroupId: 102, policyName: '차B', baseDailyPrice: 130000, weekdayPrice: 120000 }),
        createGroupPolicy({ imsGroupId: 103, policyName: '차C', baseDailyPrice: 110000, weekdayPrice: 80000 }),
      ]
    },
    async fetchDeliveryRegions() {
      return []
    },
  })

  const higherResult = await dbSearchService.run({ search: { ...baseSearch, order: 'higher' }, repositories })
  assert.deepEqual(higherResult.cars.map((car) => car.carId), ['car_b', 'car_a', 'car_c'])

  const newerResult = await dbSearchService.run({ search: { ...baseSearch, order: 'newer' }, repositories })
  assert.deepEqual(newerResult.cars.map((car) => car.carId), ['car_b', 'car_c', 'car_a'])
})

test('dbSearchService applies delivery region price for valid dong', async () => {
  const search = {
    deliveryDateTime: '2026-04-15 10:00',
    returnDateTime: '2026-04-16 10:00',
    pickupOption: 'delivery',
    driverAge: 26,
    dongId: 1123010600,
    order: 'lower',
  }

  const repositories = withDefaults({
    async fetchCandidateCars() {
      return [
        { id: 'car_a', source_group_id: 101, name: '차A', seats: 5, model_year: 2024, rent_age: 26 },
      ]
    },
    async fetchBlockingReservations() {
      return []
    },
    async fetchPriceRules() {
      return [
        createGroupPolicy({ imsGroupId: 101, policyName: '차A', baseDailyPrice: 100000, weekdayPrice: 90000 }),
      ]
    },
    async fetchDeliveryRegions({ dongId } = {}) {
      const rows = [
        {
          province_id: 11,
          province_name: '서울',
          city_id: 11230,
          city_name: '동대문구',
          dong_id: 1123010600,
          dong_name: '용두동',
          round_trip_price: 30000,
          full_label: '서울 동대문구 용두동',
        },
      ]
      return dongId != null ? rows.filter((row) => row.dong_id === Number(dongId)) : rows
    },
  })

  const result = await dbSearchService.run({ search, repositories })

  assert.equal(result.totalCount, 1)
  assert.equal(result.cars[0].deliveryPrice, 30000)
  assert.equal(result.company.deliveryCostList.length, 1)
})

test('dbSearchService returns zero cars when delivery dong is not allowed', async () => {
  const search = {
    deliveryDateTime: '2026-04-15 10:00',
    returnDateTime: '2026-04-16 10:00',
    pickupOption: 'delivery',
    driverAge: 26,
    dongId: 9999999999,
    order: 'lower',
  }

  const repositories = withDefaults({
    async fetchCandidateCars() {
      return [
        { id: 'car_a', source_group_id: 101, name: '차A', seats: 5, model_year: 2024, rent_age: 26 },
      ]
    },
    async fetchBlockingReservations() {
      return []
    },
    async fetchPriceRules() {
      return [
        createGroupPolicy({ imsGroupId: 101, policyName: '차A', baseDailyPrice: 100000, weekdayPrice: 90000 }),
      ]
    },
    async fetchDeliveryRegions({ dongId } = {}) {
      const rows = [
        {
          province_id: 11,
          province_name: '서울',
          city_id: 11230,
          city_name: '동대문구',
          dong_id: 1123010600,
          dong_name: '용두동',
          round_trip_price: 30000,
          full_label: '서울 동대문구 용두동',
        },
      ]
      return dongId != null ? rows.filter((row) => row.dong_id === Number(dongId)) : rows
    },
  })

  const result = await dbSearchService.run({ search, repositories })

  assert.equal(result.totalCount, 0)
  assert.deepEqual(result.cars, [])
})

test('dbSearchService blocks cars when reservation car_id matches source_car_id instead of uuid id', async () => {
  const search = {
    deliveryDateTime: '2026-04-17 10:00',
    returnDateTime: '2026-04-18 10:00',
    pickupOption: 'pickup',
    driverAge: 26,
    order: 'lower',
  }

  const repositories = withDefaults({
    async fetchCandidateCars() {
      return [
        {
          id: '61d37789-c3a9-4a1b-9522-0bf931934734',
          source_car_id: 233063,
          source_group_id: 24154,
          name: '카니발',
          seats: 9,
          model_year: 2025,
          rent_age: 26,
        },
        {
          id: '109a8c1c-e9c0-4db7-bf6d-a11890b8de56',
          source_car_id: 226059,
          source_group_id: 23032,
          name: '카니발 가솔린',
          seats: 9,
          model_year: 2025,
          rent_age: 26,
        },
      ]
    },
    async fetchBlockingReservations() {
      return [
        {
          car_id: '233063',
          status: 'confirmed',
          start_at: '2026-04-17T09:00:00Z',
          end_at: '2026-04-18T09:00:00Z',
        },
      ]
    },
    async fetchPriceRules() {
      return [
        createGroupPolicy({ imsGroupId: 24154, policyName: '카니발', baseDailyPrice: 200000, weekdayPrice: 180000 }),
        createGroupPolicy({ imsGroupId: 23032, policyName: '카니발 가솔린', baseDailyPrice: 190000, weekdayPrice: 170000 }),
      ]
    },
    async fetchDeliveryRegions() {
      return []
    },
  })

  const result = await dbSearchService.run({ search, repositories })

  assert.equal(result.totalCount, 1)
  assert.equal(result.cars[0].carId, 226059)
})
