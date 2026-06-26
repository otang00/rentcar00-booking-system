'use strict'

const { BOOKING_ORDER_BLOCKING_STATUSES } = require('../../booking-core/bookingAvailabilityService')

async function fetchBlockingBookingOrders({
  supabaseClient,
  dbCarIds,
  pickupAt,
  returnAt,
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  if (!Array.isArray(dbCarIds) || dbCarIds.length === 0) {
    return []
  }

  const { data, error } = await supabaseClient
    .from('booking_orders')
    .select('id, car_id, pickup_at, return_at, booking_status')
    .in('car_id', dbCarIds)
    .in('booking_status', BOOKING_ORDER_BLOCKING_STATUSES)
    .lt('pickup_at', returnAt)
    .gt('return_at', pickupAt)

  if (error) {
    throw error
  }

  return (Array.isArray(data) ? data : []).map((item) => ({
    id: item.id,
    car_id: item.car_id,
    start_at: item.pickup_at,
    end_at: item.return_at,
    booking_status: item.booking_status,
  }))
}

module.exports = {
  fetchBlockingBookingOrders,
}
