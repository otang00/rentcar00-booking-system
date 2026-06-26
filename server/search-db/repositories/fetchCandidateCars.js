'use strict'

const DEFAULT_LIMIT = 200

async function fetchCandidateCars({
  supabaseClient,
  search,
  searchWindow,
  limit = DEFAULT_LIMIT,
} = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  if (!searchWindow) {
    throw new Error('search window is required')
  }

  const query = supabaseClient
    .from('cars')
    .select('*')
    .eq('active', true)
    .eq('ims_can_general_rental', true)
    .lte('rent_age', search.driverAge || 26)
    .limit(limit)

  const { data, error } = await query
  if (error) {
    throw error
  }

  return Array.isArray(data) ? data : []
}

module.exports = {
  fetchCandidateCars,
}
