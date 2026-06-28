'use strict'

const { appLogger } = require('../../logging/appLogger')

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
    query = query.eq('dong_id', String(dongId))
  }

  try {
    const { data, error } = await query
    if (error) {
      if (isMissingDeliveryRegionsTableError(error)) {
        appLogger.warn('delivery_regions_load_failed', 'Delivery regions table is missing.', {
          route: '/api/search-cars',
          reason: 'table_missing',
          metadata: { hasDongId: dongId != null, errorCode: error.code || null },
        })
        return []
      }
      throw error
    }

    const rows = Array.isArray(data) ? data : []
    if (rows.length === 0) {
      appLogger.warn('delivery_regions_empty', 'Delivery regions query returned no rows.', {
        route: '/api/search-cars',
        reason: 'empty_result',
        metadata: { hasDongId: dongId != null },
      })
    }
    return rows
  } catch (error) {
    if (isMissingDeliveryRegionsTableError(error)) {
      appLogger.warn('delivery_regions_load_failed', 'Delivery regions table is missing.', {
        route: '/api/search-cars',
        reason: 'table_missing',
        metadata: { hasDongId: dongId != null, errorCode: error?.code || null },
      })
      return []
    }

    appLogger.error('delivery_regions_load_failed', 'Delivery regions query failed.', {
      route: '/api/search-cars',
      reason: 'query_failed',
      metadata: { hasDongId: dongId != null, errorCode: error?.code || null },
    })
    throw error
  }
}

module.exports = {
  fetchDeliveryRegions,
}
