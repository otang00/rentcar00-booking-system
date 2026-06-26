'use strict'

const crypto = require('node:crypto')

const PRICE_FIELDS = ['price', 'discountPrice', 'deliveryPrice']
const MAX_ORDER_VARIANCE = 10

function createSearchHash(search) {
  const serialized = JSON.stringify(search || {})
  return crypto.createHash('sha1').update(serialized).digest('hex')
}

function indexByCarId(cars = []) {
  return cars.reduce((acc, car, index) => {
    if (!car || !car.carId) return acc
    acc.map[car.carId] = { car, index }
    acc.list.push(car.carId)
    return acc
  }, { map: {}, list: [] })
}

function diffPrice(partnerCar, dbCar) {
  if (!partnerCar || !dbCar) return null
  const deltas = PRICE_FIELDS.map((field) => ({
    field,
    partner: Number(partnerCar[field] || 0),
    db: Number(dbCar[field] || 0),
  })).filter((entry) => entry.partner !== entry.db)

  if (deltas.length === 0) return null

  return {
    carId: partnerCar.carId,
    deltas,
  }
}

function computeOrderVariance(partnerIndexMap, dbIndexMap) {
  const deltas = []
  for (const carId of Object.keys(partnerIndexMap.map)) {
    if (!dbIndexMap.map[carId]) continue
    const partnerIndex = partnerIndexMap.map[carId].index
    const dbIndex = dbIndexMap.map[carId].index
    if (partnerIndex !== dbIndex) {
      deltas.push({ carId, partnerIndex, dbIndex })
      if (deltas.length >= MAX_ORDER_VARIANCE) break
    }
  }
  return deltas
}

function computeSearchDiff({ partnerDto, dbDto, normalizedSearch }) {
  const partnerIndexMap = indexByCarId(partnerDto?.cars)
  const dbIndexMap = indexByCarId(dbDto?.cars)

  const partnerIds = new Set(partnerIndexMap.list)
  const dbIds = new Set(dbIndexMap.list)

  const missingInDb = partnerIndexMap.list.filter((carId) => !dbIds.has(carId))
  const extraInDb = dbIndexMap.list.filter((carId) => !partnerIds.has(carId))

  const priceDiffs = partnerIndexMap.list
    .map((carId) => diffPrice(partnerIndexMap.map[carId]?.car, dbIndexMap.map[carId]?.car))
    .filter(Boolean)

  return {
    searchHash: createSearchHash(normalizedSearch),
    diff: {
      resultCountDelta: (partnerDto?.totalCount || partnerIndexMap.list.length) - (dbDto?.totalCount || dbIndexMap.list.length),
      missingInDb,
      extraInDb,
      orderVariance: computeOrderVariance(partnerIndexMap, dbIndexMap),
      priceDiffs,
      exclusionVariance: [],
    },
  }
}

module.exports = {
  computeSearchDiff,
  createSearchHash,
}
