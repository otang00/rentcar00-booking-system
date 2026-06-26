'use strict'

const BOOKING_ORDER_BLOCKING_STATUSES = [
  'confirmed',
]

async function fetchBlockingImsReservations({
  supabaseClient,
  sourceCarId,
  pickupAt,
  returnAt,
} = {}) {
  const { data, error } = await supabaseClient
    .from('ims_sync_reservations')
    .select('*')
    .eq('car_id', sourceCarId)
    .lt('start_at', returnAt)
    .gt('end_at', pickupAt)

  if (error) {
    throw error
  }

  return Array.isArray(data) ? data : []
}

async function fetchBlockingBookingOrders({
  supabaseClient,
  dbCarId,
  pickupAt,
  returnAt,
} = {}) {
  const { data, error } = await supabaseClient
    .from('booking_orders')
    .select('*')
    .eq('car_id', dbCarId)
    .in('booking_status', BOOKING_ORDER_BLOCKING_STATUSES)
    .lt('pickup_at', returnAt)
    .gt('return_at', pickupAt)

  if (error) {
    throw error
  }

  return Array.isArray(data) ? data : []
}

async function ensureBookingAvailability({
  supabaseClient,
  dbCarId,
  sourceCarId,
  pickupAt,
  returnAt,
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const [imsReservations, bookingOrders] = await Promise.all([
    fetchBlockingImsReservations({ supabaseClient, sourceCarId, pickupAt, returnAt }),
    fetchBlockingBookingOrders({ supabaseClient, dbCarId, pickupAt, returnAt }),
  ])

  if (imsReservations.length > 0 || bookingOrders.length > 0) {
    return {
      ok: false,
      code: 'booking_unavailable',
      status: 409,
      message: '방금 다른 예약과 겹쳐 해당 차량 예약이 불가합니다. 다시 검색해 주세요.',
      conflicts: {
        imsReservations: imsReservations.length,
        bookingOrders: bookingOrders.length,
      },
    }
  }

  return {
    ok: true,
  }
}

module.exports = {
  BOOKING_ORDER_BLOCKING_STATUSES,
  fetchBlockingBookingOrders,
  ensureBookingAvailability,
}
