'use strict'

function isMissingDeliveryRegionsTableError(error) {
  if (!error) return false
  if (error.code === 'PGRST205') {
    return true
  }

  const message = typeof error.message === 'string' ? error.message : ''
  return /delivery_regions/.test(message) && /not find|does not exist/i.test(message)
}

async function fetchDeliveryRegions({ supabaseClient, dongId } = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  let query = supabaseClient
    .from('delivery_regions')
    .select('*')
    .eq('active', true)
    .order('province_id', { ascending: true })
    .order('city_id', { ascending: true })
    .order('dong_id', { ascending: true })

  if (dongId != null) {
    query = query.eq('dong_id', Number(dongId))
  }

  try {
    const { data, error } = await query
    if (error) {
      if (isMissingDeliveryRegionsTableError(error)) {
        console.warn('[search-db] delivery_regions table missing, skipping delivery fetch')
        return []
      }
      throw error
    }

    return Array.isArray(data) ? data : []
  } catch (error) {
    if (isMissingDeliveryRegionsTableError(error)) {
      console.warn('[search-db] delivery_regions table missing, skipping delivery fetch')
      return []
    }
    throw error
  }
}

module.exports = {
  fetchDeliveryRegions,
}
