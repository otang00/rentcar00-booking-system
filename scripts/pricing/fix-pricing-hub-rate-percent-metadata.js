#!/usr/bin/env node

const path = require('path')
const { loadEnvFile } = require('./lib/loadEnvFile')
const { getSupabaseAdmin } = require('../ims-sync/lib/supabase-admin')

const DEFAULT_WEEKDAY_PERCENT = 90
const DEFAULT_WEEKEND_PERCENT = 115

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function toNumber(value) {
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function shouldFixWeekday(value) {
  const numeric = toNumber(value)
  return numeric != null && numeric > 0 && numeric < 80
}

function shouldFixWeekend(value) {
  const numeric = toNumber(value)
  return numeric != null && numeric > 0 && numeric < 80
}

async function main() {
  const apply = process.argv.includes('--apply')
  const repoRoot = path.resolve(__dirname, '..', '..')
  loadEnvFile(path.join(repoRoot, '.env'))

  const supabase = getSupabaseAdmin()
  const { data: rates, error } = await supabase
    .from('pricing_hub_rates')
    .select('id, rate_scope, fee_24h, metadata')
    .order('created_at', { ascending: true })

  if (error) throw error

  const updates = []
  for (const rate of rates || []) {
    const metadata = isObject(rate.metadata) ? { ...rate.metadata } : {}
    let changed = false

    if (shouldFixWeekday(metadata.weekdayPercent)) {
      metadata.weekdayPercent = DEFAULT_WEEKDAY_PERCENT
      changed = true
    }

    if (shouldFixWeekend(metadata.weekendPercent)) {
      metadata.weekendPercent = DEFAULT_WEEKEND_PERCENT
      changed = true
    }

    if (changed) {
      updates.push({
        id: rate.id,
        rateScope: rate.rate_scope,
        before: rate.metadata || {},
        after: metadata,
      })
    }
  }

  if (apply) {
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('pricing_hub_rates')
        .update({ metadata: update.after })
        .eq('id', update.id)

      if (updateError) throw updateError
    }
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    scanned: (rates || []).length,
    matched: updates.length,
    updated: apply ? updates.length : 0,
    updates,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
