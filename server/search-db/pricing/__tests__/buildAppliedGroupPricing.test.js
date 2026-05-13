'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { buildAppliedGroupPricing } = require('../buildAppliedGroupPricing')

function createPolicy() {
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

test('buildAppliedGroupPricing returns search and detail pricing from one policy', () => {
  const applied = buildAppliedGroupPricing({
    policy: createPolicy(),
    search: { pickupOption: 'delivery' },
    searchWindow: {
      startAt: new Date('2026-04-16T01:00:00.000Z'),
      endAt: new Date('2026-04-17T01:00:00.000Z'),
    },
    deliveryRegion: { round_trip_price: 20000 },
  })

  assert.equal(applied.pricingSource, 'group-price-policy')
  assert.equal(applied.basePrice, 160000)
  assert.equal(applied.discountPrice, 56000)
  assert.equal(applied.deliveryPrice, 20000)
  assert.equal(applied.detailPricing.rentalCost, 56000)
  assert.equal(applied.detailPricing.originCost, 160000)
  assert.equal(applied.detailPricing.finalPrice, 76000)
})

test('buildAppliedGroupPricing returns zero rental when policy is missing', () => {
  const applied = buildAppliedGroupPricing({
    policy: null,
    search: { pickupOption: 'delivery' },
    searchWindow: {
      startAt: new Date('2026-04-16T01:00:00.000Z'),
      endAt: new Date('2026-04-17T01:00:00.000Z'),
    },
    deliveryRegion: { round_trip_price: 20000 },
  })

  assert.equal(applied.pricingSource, 'missing-group-price-policy')
  assert.equal(applied.basePrice, 0)
  assert.equal(applied.discountPrice, 0)
  assert.equal(applied.deliveryPrice, 20000)
  assert.equal(applied.detailPricing.finalPrice, 20000)
})
