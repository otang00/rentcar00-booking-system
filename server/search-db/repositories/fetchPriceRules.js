'use strict'

const { fetchGroupPricePolicies } = require('./fetchGroupPricePolicies')

async function fetchPriceRules({ supabaseClient, sourceGroupIds = [], searchWindow } = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  return fetchGroupPricePolicies({ supabaseClient, sourceGroupIds, searchWindow })
}

module.exports = {
  fetchPriceRules,
}
