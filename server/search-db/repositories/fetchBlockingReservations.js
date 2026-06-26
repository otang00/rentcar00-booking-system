'use strict'

const { isReservationBlocking } = require('../helpers/statusRules')

async function fetchBlockingReservations({
  supabaseClient,
  carIds,
  searchWindow,
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  if (!Array.isArray(carIds) || carIds.length === 0) {
    return []
  }

  if (!searchWindow) {
    throw new Error('search window is required')
  }

  const query = supabaseClient
    .from('ims_sync_reservations')
    .select('*')
    .in('car_id', carIds)
    .lt('start_at', searchWindow.endIso)
    .gt('end_at', searchWindow.startIso)

  const { data, error } = await query
  if (error) {
    throw error
  }

  if (!Array.isArray(data)) {
    return []
  }

  return data.filter((reservation) => isReservationBlocking(reservation))
}

module.exports = {
  fetchBlockingReservations,
}
