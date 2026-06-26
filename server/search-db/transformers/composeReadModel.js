'use strict'

const { filterAvailableCars } = require('../helpers/filterAvailableCars')
const { mapDbCarsToDto } = require('./mapDbCarsToDto')

function compareNumbers(a, b, direction = 'asc') {
  const left = Number(a || 0)
  const right = Number(b || 0)
  return direction === 'desc' ? right - left : left - right
}

function compareStrings(a, b, direction = 'asc') {
  const left = String(a || '')
  const right = String(b || '')
  const value = left.localeCompare(right, 'ko-KR')
  return direction === 'desc' ? -value : value
}

function sortDtoCars(dtoCars = [], search = {}) {
  const order = search.order || 'lower'
  const nextCars = [...dtoCars]

  nextCars.sort((a, b) => {
    if (order === 'higher') {
      return (
        compareNumbers(a.discountPrice || a.price, b.discountPrice || b.price, 'desc') ||
        compareNumbers(a.price, b.price, 'desc') ||
        compareNumbers(a.maxModelYear || a.minModelYear, b.maxModelYear || b.minModelYear, 'desc') ||
        compareStrings(a.carId, b.carId, 'asc')
      )
    }

    if (order === 'newer') {
      return (
        compareNumbers(a.maxModelYear || a.minModelYear, b.maxModelYear || b.minModelYear, 'desc') ||
        compareNumbers(a.discountPrice || a.price, b.discountPrice || b.price, 'asc') ||
        compareStrings(a.carId, b.carId, 'asc')
      )
    }

    return (
      compareNumbers(a.discountPrice || a.price, b.discountPrice || b.price, 'asc') ||
      compareNumbers(a.price, b.price, 'asc') ||
      compareNumbers(a.maxModelYear || a.minModelYear, b.maxModelYear || b.minModelYear, 'desc') ||
      compareStrings(a.carId, b.carId, 'asc')
    )
  })

  return nextCars
}

function composeReadModel({ cars = [], reservations = [], priceRules = [], deliveryRegion = null, searchWindow, search } = {}) {
  if (!searchWindow) {
    throw new Error('search window is required')
  }

  const availableCars = filterAvailableCars({ cars, reservations, searchWindow })
  const dtoCars = sortDtoCars(
    mapDbCarsToDto({ cars: availableCars, priceRules, deliveryRegion, search, searchWindow }),
    search,
  )

  return {
    cars: availableCars,
    reservations,
    dtoCars,
  }
}

module.exports = {
  composeReadModel,
  sortDtoCars,
}
