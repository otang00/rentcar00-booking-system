'use strict'

const path = require('path')

const { buildPreview } = require('./build-group-pricing-preview')
const { loadEnvFile } = require('./lib/loadEnvFile')
const { createServerClient } = require('../../server/supabase/createServerClient')

function dedupeCarGroups(carGroups = []) {
  const merged = new Map()

  for (const row of carGroups) {
    if (row.imsGroupId == null) continue
    const key = Number(row.imsGroupId)
    const current = merged.get(key)
    if (!current) {
      merged.set(key, {
        imsGroupId: key,
        groupName: row.groupName,
        grade: row.grade,
        metadata: {
          ...(row.metadata || {}),
          aliases: [],
        },
      })
      continue
    }

    if (row.groupName && row.groupName !== current.groupName) {
      current.metadata.aliases = [...new Set([...(current.metadata.aliases || []), row.groupName])]
    }
  }

  return [...merged.values()]
}

async function upsertCarGroups(client, carGroups) {
  const rows = dedupeCarGroups(carGroups).map((row) => ({
    ims_group_id: row.imsGroupId,
    group_name: row.groupName,
    grade: row.grade,
    import_type: 'xlsx',
    active: true,
    metadata: row.metadata || {},
  }))

  const { data, error } = await client
    .from('car_groups')
    .upsert(rows, { onConflict: 'ims_group_id' })
    .select('id, ims_group_id, group_name')

  if (error) throw error
  return Array.isArray(data) ? data : []
}

async function upsertPricePolicies(client, pricePolicies) {
  const { data: existingRows, error: existingError } = await client
    .from('price_policies')
    .select('id, policy_name, source_file')

  if (existingError) throw existingError

  const existingMap = new Map((existingRows || []).map((row) => [`${row.policy_name}::${row.source_file || ''}`, row]))
  const resolved = []

  for (const policy of pricePolicies) {
    const payload = {
      policy_name: policy.policyName,
      base_daily_price: policy.baseDailyPrice,
      weekday_1_2d_price: policy.weekday_1_2d_price,
      weekday_3_4d_price: policy.weekday_3_4d_price,
      weekday_5_6d_price: policy.weekday_5_6d_price,
      weekday_7d_plus_price: policy.weekday_7d_plus_price,
      weekend_1_2d_price: policy.weekend_1_2d_price,
      weekend_3_4d_price: policy.weekend_3_4d_price,
      weekend_5_6d_price: policy.weekend_5_6d_price,
      weekend_7d_plus_price: policy.weekend_7d_plus_price,
      hour_1_price: policy.hour_1_price,
      hour_6_price: policy.hour_6_price,
      hour_12_price: policy.hour_12_price,
      source_file: policy.sourceFile,
      active: true,
      metadata: policy.metadata || {},
    }

    const key = `${policy.policyName}::${policy.sourceFile || ''}`
    const existing = existingMap.get(key)
    const query = existing
      ? client.from('price_policies').update(payload).eq('id', existing.id)
      : client.from('price_policies').insert(payload)

    const { data, error } = await query.select('id, policy_name, source_file').single()
    if (error) throw error
    resolved.push(data)
  }

  return resolved
}

async function syncPolicyGroups(client, mappings, groupRows, policyRows) {
  const groupMap = new Map(groupRows.map((row) => [Number(row.ims_group_id), row.id]))
  const policyMap = new Map(policyRows.map((row) => [`${row.policy_name}::${row.source_file || ''}`, row.id]))

  const rows = mappings
    .filter((row) => row.imsGroupId != null)
    .map((row) => ({
      price_policy_id: policyMap.get(`${row.policyName}::${row.sourceFile || ''}`) || null,
      car_group_id: groupMap.get(Number(row.imsGroupId)) || null,
      match_source: row.matchSource || 'current-cars',
      active: true,
      metadata: {
        groupName: row.groupName,
      },
    }))
    .filter((row) => row.price_policy_id && row.car_group_id)

  const dedupedRows = [...new Map(rows.map((row) => [`${row.price_policy_id}::${row.car_group_id}`, row])).values()]
  if (dedupedRows.length === 0) {
    return []
  }

  const { data, error } = await client
    .from('price_policy_groups')
    .upsert(dedupedRows, { onConflict: 'price_policy_id,car_group_id' })
    .select('id')

  if (error) throw error
  return Array.isArray(data) ? data : []
}

async function applyGroupPricing({ groupListPath, priceSheetPath, allowUnresolved = false } = {}) {
  const projectRoot = path.resolve(__dirname, '..', '..')
  loadEnvFile(path.join(projectRoot, '.env'))

  const client = createServerClient()
  if (!client) {
    throw new Error('supabase client is not configured')
  }

  const preview = await buildPreview({
    groupListPath,
    priceSheetPath,
    outPath: path.join(projectRoot, 'supabase/reference/group-pricing-preview.json'),
  })

  if (!allowUnresolved && preview.summary.unresolvedGroupIds > 0) {
    throw new Error(`unresolved ims_group_id count: ${preview.summary.unresolvedGroupIds}`)
  }

  const groupRows = await upsertCarGroups(client, preview.carGroups.filter((row) => row.imsGroupId != null))
  const policyRows = await upsertPricePolicies(client, preview.pricePolicies)
  const mappingRows = await syncPolicyGroups(client, preview.pricePolicyGroups, groupRows, policyRows)

  return {
    carGroups: groupRows.length,
    pricePolicies: policyRows.length,
    pricePolicyGroups: mappingRows.length,
    unresolvedGroupIds: preview.summary.unresolvedGroupIds,
  }
}

async function main() {
  const groupListPath = process.argv[2]
  const priceSheetPath = process.argv[3]
  const allowUnresolved = process.argv.includes('--allow-unresolved')

  if (!groupListPath || !priceSheetPath) {
    throw new Error('usage: node scripts/pricing/apply-group-pricing.js <group-list.xlsx> <price-sheet.xlsx> [--allow-unresolved]')
  }

  const result = await applyGroupPricing({ groupListPath, priceSheetPath, allowUnresolved })
  console.log(JSON.stringify(result, null, 2))
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[apply-group-pricing] failed:', error.message)
    process.exit(1)
  })
}

module.exports = {
  applyGroupPricing,
}
