'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { calculateGroupPrice } = require('../calculateGroupPrice')

const policy = {
  price_policy_id: 'policy_1',
  policy_name: '테슬라 모델3',
  ims_group_id: 22015,
  base24h: 240000,
  weekday_24h_price: 108000,
  weekend_24h_price: 120000,
  hour_1_price: 10800,
  week_1_price: 1320000,
  week_2_price: 1920000,
  month_1_price: 2880000,
}

test('calculateGroupPrice returns weekday 24h daily price', () => {
  const result = calculateGroupPrice({
    policy,
    searchWindow: {
      startAt: new Date('2026-04-16T01:00:00.000Z'),
      endAt: new Date('2026-04-17T01:00:00.000Z'),
    },
  })

  assert.equal(result.durationBucket, 'days_under_7')
  assert.equal(result.billableDays, 1)
  assert.equal(result.weekdayDays, 1)
  assert.equal(result.weekendDays, 0)
  assert.equal(result.discountPrice, 108000)
  assert.equal(result.price, 240000)
})

test('calculateGroupPrice returns weekend 24h daily price', () => {
  const result = calculateGroupPrice({
    policy,
    searchWindow: {
      startAt: new Date('2026-04-18T01:00:00.000Z'),
      endAt: new Date('2026-04-19T01:00:00.000Z'),
    },
  })

  assert.equal(result.durationBucket, 'days_under_7')
  assert.equal(result.weekdayDays, 0)
  assert.equal(result.weekendDays, 1)
  assert.equal(result.discountPrice, 120000)
})

test('calculateGroupPrice returns hourly price for 6h', () => {
  const result = calculateGroupPrice({
    policy,
    searchWindow: {
      startAt: new Date('2026-04-13T01:00:00.000Z'),
      endAt: new Date('2026-04-13T07:00:00.000Z'),
    },
  })

  assert.equal(result.durationBucket, 'hours_under_24')
  assert.equal(result.discountPrice, 64800)
  assert.equal(result.price, 240000)
})

test('calculateGroupPrice applies short-rental bucket weight and hourly add for 3d + 5h', () => {
  const result = calculateGroupPrice({
    policy,
    searchWindow: {
      startAt: new Date('2026-04-13T01:00:00.000Z'),
      endAt: new Date('2026-04-16T06:00:00.000Z'),
    },
  })

  assert.equal(result.durationBucket, 'days_under_7')
  assert.equal(result.billableDays, 4)
  assert.equal(result.weekdayDays, 3)
  assert.equal(result.weekendDays, 0)
  assert.equal(result.discountPrice, 345600)
  assert.equal(result.price, 960000)
})

test('calculateGroupPrice applies 7~14 day anchor formula', () => {
  const result = calculateGroupPrice({
    policy,
    searchWindow: {
      startAt: new Date('2026-04-13T01:00:00.000Z'),
      endAt: new Date('2026-04-23T01:00:00.000Z'),
    },
  })

  assert.equal(result.durationBucket, 'days_7_14')
  assert.equal(result.billableDays, 10)
  assert.equal(result.discountPrice, 1680000)
  assert.equal(result.price, 2400000)
})

test('calculateGroupPrice applies 15~30 day anchor formula', () => {
  const result = calculateGroupPrice({
    policy,
    searchWindow: {
      startAt: new Date('2026-04-13T01:00:00.000Z'),
      endAt: new Date('2026-05-03T01:00:00.000Z'),
    },
  })

  assert.equal(result.durationBucket, 'days_15_30')
  assert.equal(result.billableDays, 20)
  assert.equal(result.discountPrice, 2424000)
  assert.equal(result.price, 4800000)
})

test('calculateGroupPrice throws when search window exceeds 30 days', () => {
  assert.throws(() => calculateGroupPrice({
    policy,
    searchWindow: {
      startAt: new Date('2026-04-13T01:00:00.000Z'),
      endAt: new Date('2026-05-14T02:00:00.000Z'),
    },
  }), /exceeds 30 days/)
})
