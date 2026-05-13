'use strict'

async function fetchGroupPricePolicies({ supabaseClient, sourceGroupIds = [], searchWindow } = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const ids = [...new Set(sourceGroupIds.map((value) => Number(value)).filter(Number.isFinite))]
  if (ids.length === 0) {
    return []
  }

  const { data, error } = await supabaseClient
    .from('v_search_pricing_hub_policies')
    .select('*')
    .in('ims_group_id', ids)

  if (error) {
    throw error
  }

  return Array.isArray(data) ? data : []
}

module.exports = {
  fetchGroupPricePolicies,
}
