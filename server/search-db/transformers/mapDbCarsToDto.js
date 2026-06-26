'use strict'

const { buildAppliedGroupPricing } = require('../pricing/buildAppliedGroupPricing')

function buildGroupPolicyIndex(priceRules = []) {
  return priceRules.reduce((acc, rule) => {
    const groupId = rule.source_group_id || rule.ims_group_id
    if (groupId == null) return acc
    acc[String(groupId)] = rule
    return acc
  }, {})
}

function mapOptions(car) {
  if (!car) return []
  if (Array.isArray(car.options)) return car.options
  if (car.options_json && Array.isArray(car.options_json.names)) {
    return car.options_json.names
  }
  return []
}

function mapDbCarsToDto({ cars = [], priceRules = [], deliveryRegion = null, search = {}, searchWindow } = {}) {
  const groupPolicyIndex = buildGroupPolicyIndex(priceRules)
  const seenGroupIds = new Set()
  const dtoCars = []

  for (const car of cars) {
    if (!car) continue
    const vehicleId = car.source_car_id || car.car_id || car.id
    if (!vehicleId) continue

    const groupId = car.source_group_id || null
    const groupKey = groupId != null ? String(groupId) : null
    const groupPolicy = groupKey ? groupPolicyIndex[groupKey] : null
    if (!groupPolicy) {
      continue
    }

    if (groupKey && seenGroupIds.has(groupKey)) {
      continue
    }

    if (groupKey) {
      seenGroupIds.add(groupKey)
    }

    const appliedPricing = buildAppliedGroupPricing({
      policy: groupPolicy,
      searchWindow,
      search,
      deliveryRegion,
    })

    dtoCars.push({
      carId: vehicleId,
      groupId,
      name: car.display_name || car.name || '',
      imageUrl: car.image_url || '',
      oilType: car.fuel_type || '',
      capacity: Number(car.seats || 0),
      minModelYear: car.model_year || 0,
      maxModelYear: car.model_year || 0,
      insuranceAge: car.rent_age || 0,
      options: mapOptions(car),
      price: appliedPricing.basePrice,
      discountPrice: appliedPricing.discountPrice,
      deliveryPrice: appliedPricing.deliveryPrice,
    })
  }

  return dtoCars
}

module.exports = {
  mapDbCarsToDto,
}
