'use strict'

const { isRangeOverlapping } = require('./overlap')

function resolveReservationCarKey(reservation = {}) {
  return reservation.car_id || reservation.carId || reservation.source_car_id || null
}

function resolveCarKey(car = {}) {
  return car.source_car_id || car.car_id || car.id || null
}

function resolveCarKeys(car = {}) {
  return [car.source_car_id, car.car_id, car.id].filter(Boolean)
}

function buildReservationIndex(reservations = []) {
  return reservations.reduce((acc, reservation) => {
    const carId = resolveReservationCarKey(reservation)
    if (!carId) return acc
    if (!acc[carId]) {
      acc[carId] = []
    }
    acc[carId].push(reservation)
    return acc
  }, {})
}

function reservationToRange(reservation) {
  return {
    startAt: reservation.start_at || reservation.startAt,
    endAt: reservation.end_at || reservation.endAt,
  }
}

function isCarAvailable({ car, reservations, searchWindow, overlapOptions }) {
  if (!reservations || reservations.length === 0) {
    return true
  }

  return reservations.every((reservation) =>
    !isRangeOverlapping(reservationToRange(reservation), searchWindow, overlapOptions),
  )
}

function filterAvailableCars({ cars = [], reservations = [], searchWindow, overlapOptions } = {}) {
  if (!searchWindow) {
    throw new Error('search window is required to filter cars')
  }

  const reservationIndex = buildReservationIndex(reservations)

  return cars.filter((car) => {
    const carReservations = resolveCarKeys(car).flatMap((carId) => reservationIndex[carId] || [])
    return isCarAvailable({
      car,
      reservations: carReservations,
      searchWindow,
      overlapOptions,
    })
  })
}

module.exports = {
  buildReservationIndex,
  filterAvailableCars,
  resolveCarKey,
  resolveReservationCarKey,
}
