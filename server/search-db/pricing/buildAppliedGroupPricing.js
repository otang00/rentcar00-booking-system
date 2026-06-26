'use strict'

const { calculateGroupPrice } = require('./calculateGroupPrice')
const { roundFinalAppliedPrice } = require('./finalPriceRounding')

function getDeliveryPrice({ search = {}, deliveryRegion = null } = {}) {
  return search.pickupOption === 'delivery'
    ? Number(deliveryRegion?.round_trip_price || deliveryRegion?.roundTripPrice || 0)
    : 0
}

function buildAppliedGroupPricing({ policy, searchWindow, search = {}, deliveryRegion = null } = {}) {
  const deliveryPrice = getDeliveryPrice({ search, deliveryRegion })

  if (!policy) {
    return {
      pricingSource: 'missing-group-price-policy',
      basePrice: 0,
      discountPrice: 0,
      deliveryPrice,
      detailPricing: {
        rentalCost: 0,
        originCost: 0,
        insurancePrice: 0,
        delivery: {
          oneWay: Math.floor(deliveryPrice / 2),
          roundTrip: deliveryPrice,
        },
        finalPrice: deliveryPrice,
      },
    }
  }

  const computed = calculateGroupPrice({
    policy,
    searchWindow,
    deliveryPrice,
  })

  const basePrice = Number(computed?.price || 0)
  const rawDiscountPrice = Number(computed?.discountPrice || 0)
  const discountPrice = roundFinalAppliedPrice(rawDiscountPrice, computed?.durationBucket)
  const finalDeliveryPrice = Number(computed?.deliveryPrice || deliveryPrice || 0)
  const insurancePrice = 0

  return {
    pricingSource: 'group-price-policy',
    basePrice,
    discountPrice,
    deliveryPrice: finalDeliveryPrice,
    detailPricing: {
      rentalCost: discountPrice,
      originCost: basePrice,
      insurancePrice,
      delivery: {
        oneWay: Math.floor(finalDeliveryPrice / 2),
        roundTrip: finalDeliveryPrice,
      },
      finalPrice: discountPrice + insurancePrice + finalDeliveryPrice,
    },
  }
}

module.exports = {
  getDeliveryPrice,
  buildAppliedGroupPricing,
}
