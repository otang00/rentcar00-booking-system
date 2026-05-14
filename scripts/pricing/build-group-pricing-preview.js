'use strict'

const fs = require('fs')
const path = require('path')

const { readWorkbook } = require('./lib/readWorkbook')
const { loadEnvFile } = require('./lib/loadEnvFile')
const { createServerClient } = require('../../server/supabase/createServerClient')

function parseMoney(value) {
  const digits = String(value || '').replace(/[^0-9.-]/g, '')
  if (!digits) return 0
  return Number(digits)
}

function parsePercent(value) {
  const digits = String(value || '').replace(/[^0-9.-]/g, '')
  if (!digits) return 0
  return Number(digits)
}

function splitGroupNames(value) {
  return String(value || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
}

function looksLikeMoney(value) {
  return /^[0-9,]+$/.test(String(value || '').trim())
}

function parseGroupRows(filePath) {
  const [sheet] = readWorkbook(filePath)
  const rows = sheet?.rows || []
  return rows.slice(1).filter((row) => row.B).map((row) => ({
    groupName: row.B,
    grade: row.A || null,
    metadata: {
      importFlag: row.C || null,
      brand: row.D || null,
      model: row.E || null,
      submodel: row.F || null,
      fuelType: row.G || null,
      modelYear: row.H || null,
      drivingCareer: row.I || null,
      licenseType: row.J || null,
    },
  }))
}

function parsePricePolicies(filePath) {
  const [sheet] = readWorkbook(filePath)
  const rows = sheet?.rows || []
  const policies = []

  for (let index = 1; index < rows.length; index += 1) {
    const weekday = rows[index]
    if (!weekday || !weekday.A) continue

    const shiftedBasePrice = !weekday.C && looksLikeMoney(weekday.B)
    const appliedGroups = shiftedBasePrice ? [] : splitGroupNames(weekday.B)
    const basePriceRaw = shiftedBasePrice ? weekday.B : weekday.C
    if (!basePriceRaw) continue

    const weekend = rows[index + 1] || {}

    policies.push({
      policyName: weekday.A,
      appliedGroups,
      baseDailyPrice: parseMoney(basePriceRaw),
      weekday_1_2d_price: parseMoney(weekday.E),
      weekday_3_4d_price: parseMoney(weekday.F),
      weekday_5_6d_price: parseMoney(weekday.G),
      weekday_7d_plus_price: parseMoney(weekday.H),
      weekend_1_2d_price: parseMoney(weekend.E),
      weekend_3_4d_price: parseMoney(weekend.F),
      weekend_5_6d_price: parseMoney(weekend.G),
      weekend_7d_plus_price: parseMoney(weekend.H),
      hour_1_price: parseMoney(weekday.I),
      hour_6_price: parseMoney(weekday.J),
      hour_12_price: parseMoney(weekday.K),
      sourceFile: path.basename(filePath),
      metadata: {
        rawRows: [weekday, weekend],
        shiftedBasePrice,
        imsLegacyWeekdayPercent: parsePercent(weekday.D || weekday.A),
        imsLegacyWeekendPercent: parsePercent(weekend.D || weekend.A),
      },
    })
  }

  return policies
}

async function fetchCurrentGroupIds() {
  const client = createServerClient()
  if (!client) return new Map()

  const { data, error } = await client
    .from('cars')
    .select('source_group_id,name,display_name')
    .eq('active', true)

  if (error) {
    throw error
  }

  const map = new Map()
  for (const row of data || []) {
    const groupId = row.source_group_id == null ? null : Number(row.source_group_id)
    if (!groupId) continue

    for (const name of [row.name, row.display_name]) {
      if (!name) continue
      map.set(String(name).trim(), groupId)
    }
  }

  return map
}

async function buildPreview({ groupListPath, priceSheetPath, outPath }) {
  const groupRows = parseGroupRows(groupListPath)
  const policies = parsePricePolicies(priceSheetPath)
  const currentGroupIds = await fetchCurrentGroupIds()

  const carGroups = groupRows.map((row) => ({
    imsGroupId: currentGroupIds.get(row.groupName) || null,
    groupName: row.groupName,
    grade: row.grade,
    metadata: row.metadata,
  }))

  const pricePolicyGroups = []
  for (const policy of policies) {
    for (const groupName of policy.appliedGroups) {
      pricePolicyGroups.push({
        policyName: policy.policyName,
        sourceFile: policy.sourceFile,
        groupName,
        imsGroupId: currentGroupIds.get(groupName) || null,
        matchSource: currentGroupIds.has(groupName) ? 'current-cars' : 'xlsx-only',
      })
    }
  }

  const preview = {
    generatedAt: new Date().toISOString(),
    summary: {
      carGroups: carGroups.length,
      pricePolicies: policies.length,
      pricePolicyGroups: pricePolicyGroups.length,
      resolvedGroupIds: carGroups.filter((row) => row.imsGroupId != null).length,
      unresolvedGroupIds: carGroups.filter((row) => row.imsGroupId == null).length,
    },
    carGroups,
    pricePolicies: policies,
    pricePolicyGroups,
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(preview, null, 2))
  return preview
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..', '..')
  loadEnvFile(path.join(projectRoot, '.env'))
  const groupListPath = process.argv[2]
  const priceSheetPath = process.argv[3]
  const outPath = process.argv[4] || path.join(projectRoot, 'supabase/reference/group-pricing-preview.json')

  if (!groupListPath || !priceSheetPath) {
    throw new Error('usage: node scripts/pricing/build-group-pricing-preview.js <group-list.xlsx> <price-sheet.xlsx> [output.json]')
  }

  const preview = await buildPreview({ groupListPath, priceSheetPath, outPath })
  console.log(JSON.stringify(preview.summary, null, 2))
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[build-group-pricing-preview] failed:', error.message)
    process.exit(1)
  })
}

module.exports = {
  buildPreview,
  parseGroupRows,
  parsePricePolicies,
}
