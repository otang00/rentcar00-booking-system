'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { mapDbCarsToDto } = require('../mapDbCarsToDto')

function createPriceRule() {
  return {
    ims_group_id: 23069,
    price_policy_id: 'policy_1',
    policy_name: '아반떼',
    base24h: 160000,
    weekday_24h_price: 56000,
    weekend_24h_price: 80000,
    hour_1_price: 5300,
    week_1_price: 880000,
    week_2_price: 1280000,
    month_1_price: 1920000,
  }
}

test('mapDbCarsToDto maps group policy pricing only', () => {
  const cars = [
    { id: 'car_a', source_car_id: 220644, source_group_id: 23069, name: '아반떼', seats: 5, model_year: 2024, rent_age: 26 },
  ]

  const dto = mapDbCarsToDto({
    cars,
    priceRules: [createPriceRule()],
    search: { pickupOption: 'delivery' },
    searchWindow: {
      startAt: new Date('2026-04-16T01:00:00.000Z'),
      endAt: new Date('2026-04-17T01:00:00.000Z'),
    },
    deliveryRegion: { round_trip_price: 20000 },
  })
  assert.equal(dto[0].carId, 220644)
  assert.equal(dto[0].groupId, 23069)
  assert.equal(dto[0].price, 160000)
  assert.equal(dto[0].discountPrice, 56000)
  assert.equal(dto[0].deliveryPrice, 20000)
})

 test('mapDbCarsToDto keeps one representative row per group', () => {
  const cars = [
    { id: 'car_a', source_car_id: 220644, source_group_id: 23069, name: '아반떼A', seats: 5, model_year: 2024, rent_age: 26 },
    { id: 'car_b', source_car_id: 220503, source_group_id: 23069, name: '아반떼B', seats: 5, model_year: 2023, rent_age: 26 },
  ]

  const dto = mapDbCarsToDto({
    cars,
    priceRules: [createPriceRule()],
    search: { pickupOption: 'pickup' },
    searchWindow: {
      startAt: new Date('2026-04-16T01:00:00.000Z'),
      endAt: new Date('2026-04-17T01:00:00.000Z'),
    },
  })

  assert.equal(dto.length, 1)
  assert.equal(dto[0].carId, 220644)
  assert.equal(dto[0].groupId, 23069)
})

test('mapDbCarsToDto skips cars without group policy', () => {
  const cars = [
    { id: 'car_a', source_car_id: 220644, source_group_id: 23069, name: '아반떼', seats: 5, model_year: 2024, rent_age: 26 },
  ]

  const dto = mapDbCarsToDto({
    cars,
    priceRules: [],
    search: { pickupOption: 'delivery' },
    searchWindow: {
      startAt: new Date('2026-04-16T01:00:00.000Z'),
      endAt: new Date('2026-04-17T01:00:00.000Z'),
    },
    deliveryRegion: { round_trip_price: 20000 },
  })

  assert.equal(dto.length, 0)
})

test('mapDbCarsToDto applies group policy pricing when available', () => {
  const cars = [
    { id: 'car_a', source_car_id: 220644, source_group_id: 23069, name: '아반떼', seats: 5, model_year: 2024, rent_age: 26 },
  ]

  const dto = mapDbCarsToDto({
    cars,
    priceRules: [createPriceRule()],
    search: { pickupOption: 'delivery' },
    searchWindow: {
      startAt: new Date('2026-04-16T01:00:00.000Z'),
      endAt: new Date('2026-04-17T01:00:00.000Z'),
    },
    deliveryRegion: { round_trip_price: 20000 },
  })

  assert.equal(dto[0].price, 160000)
  assert.equal(dto[0].discountPrice, 56000)
  assert.equal(dto[0].deliveryPrice, 20000)
})
