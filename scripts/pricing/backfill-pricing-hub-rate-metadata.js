#!/usr/bin/env node

const path = require('path')
const { loadEnvFile } = require('./lib/loadEnvFile')
const { getSupabaseAdmin } = require('../ims-sync/lib/supabase-admin')

const repoRoot = path.resolve(__dirname, '..', '..')
loadEnvFile(path.join(repoRoot, '.env'))

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

async function main() {
  const supabase = getSupabaseAdmin()

  const { data: periods, error: periodsError } = await supabase
    .from('pricing_hub_periods')
    .select('id, period_name, price_policy_id, price_policies:price_policy_id (id, policy_name)')
    .order('created_at', { ascending: true })

  if (periodsError) throw periodsError

  const periodIds = (periods || []).map((period) => period.id).filter(Boolean)
  const { data: rates, error: ratesError } = await supabase
    .from('pricing_hub_rates')
    .select('id, pricing_hub_period_id, rate_scope, fee_24h, metadata')
    .in('pricing_hub_period_id', periodIds)
    .order('created_at', { ascending: true })

  if (ratesError) throw ratesError

  const ratesByPeriodId = (rates || []).reduce((acc, rate) => {
    if (!acc[rate.pricing_hub_period_id]) acc[rate.pricing_hub_period_id] = []
    acc[rate.pricing_hub_period_id].push(rate)
    return acc
  }, {})

  const updates = []

  for (const period of periods || []) {
    const periodRates = ratesByPeriodId[period.id] || []
    if (!periodRates.length) continue

    const commonRate = periodRates.find((rate) => rate.rate_scope === 'common') || periodRates[0]
    const commonMetadata = isObject(commonRate?.metadata) ? commonRate.metadata : {}
    const base24h = commonMetadata.base24h ?? commonRate?.fee_24h ?? null
    const weekdayPercent = 90
    const weekendPercent = 115

    for (const rate of periodRates) {
      const metadata = isObject(rate.metadata) ? { ...rate.metadata } : {}
      let changed = false

      if (metadata.base24h == null && base24h != null) {
        metadata.base24h = base24h
        changed = true
      }
      if (metadata.weekdayPercent == null && weekdayPercent != null) {
        metadata.weekdayPercent = weekdayPercent
        changed = true
      }
      if (metadata.weekendPercent == null && weekendPercent != null) {
        metadata.weekendPercent = weekendPercent
        changed = true
      }

      if (changed) {
        updates.push({
          id: rate.id,
          metadata,
        })
      }
    }
  }

  if (!updates.length) {
    console.log(JSON.stringify({ updated: 0, message: 'No rows needed backfill.' }, null, 2))
    return
  }

  let updatedCount = 0

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('pricing_hub_rates')
      .update({ metadata: update.metadata })
      .eq('id', update.id)

    if (updateError) throw updateError
    updatedCount += 1
  }

  console.log(JSON.stringify({
    updated: updatedCount,
    periods: periods.length,
    rates: rates.length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
