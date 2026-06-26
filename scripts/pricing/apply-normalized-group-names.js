'use strict'

const fs = require('fs')
const path = require('path')

const { loadEnvFile } = require('./lib/loadEnvFile')
const { createServerPrivilegedClient } = require('../../server/supabase/createServerClient')

const projectRoot = path.resolve(__dirname, '..', '..')
const normalizerRoot = path.resolve(projectRoot, '..', 'rentcar00-pricing-normalizer')
const previewPath = path.join(normalizerRoot, 'outputs', 'carmore', 'model-name-normalization-preview.json')
const outDir = path.join(projectRoot, 'data', 'pricing-reset')
const dryRun = process.argv.includes('--dry-run')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

async function main() {
  loadEnvFile(path.join(projectRoot, '.env'))
  const client = createServerPrivilegedClient()
  if (!client) throw new Error('supabase privileged client is not configured')
  const preview = JSON.parse(fs.readFileSync(previewPath, 'utf8'))
  const ids = preview.map((row) => Number(row.sourceGroupId)).filter(Boolean)
  const nameByGroup = new Map(preview.map((row) => [Number(row.sourceGroupId), row.proposedName]))

  const { data: groups, error: groupError } = await client
    .from('car_groups')
    .select('id, ims_group_id, group_name, metadata')
    .in('ims_group_id', ids)
  if (groupError) throw groupError

  const { data: cars, error: carError } = await client
    .from('cars')
    .select('id, source_car_id, source_group_id, car_number, name, display_name')
    .in('source_group_id', ids)
  if (carError) throw carError

  const backup = {
    generatedAt: new Date().toISOString(),
    source: previewPath,
    counts: { groups: groups.length, cars: cars.length },
    groups,
    cars,
  }
  ensureDir(outDir)
  fs.writeFileSync(path.join(outDir, dryRun ? 'normalized-group-names-backup-dry-run.json' : 'normalized-group-names-backup.json'), JSON.stringify(backup, null, 2))

  const groupUpdates = groups.map((row) => ({ ...row, nextName: nameByGroup.get(Number(row.ims_group_id)) })).filter((row) => row.nextName && row.group_name !== row.nextName)
  const carUpdates = cars.map((row) => ({ ...row, nextName: nameByGroup.get(Number(row.source_group_id)) })).filter((row) => row.nextName && row.name !== row.nextName)

  const result = { generatedAt: new Date().toISOString(), dryRun, counts: { targetIds: ids.length, groupsFound: groups.length, carsFound: cars.length, groupUpdates: groupUpdates.length, carUpdates: carUpdates.length }, groupUpdates: [], carUpdates: [] }

  if (!dryRun) {
    for (const row of groupUpdates) {
      const metadata = { ...(row.metadata || {}), previousGroupName: row.group_name, normalizedNameSource: 'model-name-normalization-preview', normalizedAt: result.generatedAt }
      const { error } = await client.from('car_groups').update({ group_name: row.nextName, metadata }).eq('id', row.id)
      if (error) throw error
      result.groupUpdates.push({ id: row.id, imsGroupId: row.ims_group_id, from: row.group_name, to: row.nextName })
    }
    for (const row of carUpdates) {
      const { error } = await client.from('cars').update({ name: row.nextName }).eq('id', row.id)
      if (error) throw error
      result.carUpdates.push({ id: row.id, sourceCarId: row.source_car_id, sourceGroupId: row.source_group_id, carNumber: row.car_number, from: row.name, to: row.nextName })
    }
  } else {
    result.groupUpdates = groupUpdates.map((row) => ({ id: row.id, imsGroupId: row.ims_group_id, from: row.group_name, to: row.nextName }))
    result.carUpdates = carUpdates.map((row) => ({ id: row.id, sourceCarId: row.source_car_id, sourceGroupId: row.source_group_id, carNumber: row.car_number, from: row.name, to: row.nextName }))
  }

  fs.writeFileSync(path.join(outDir, dryRun ? 'normalized-group-names-dry-run.json' : 'normalized-group-names-result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ file: dryRun ? 'data/pricing-reset/normalized-group-names-dry-run.json' : 'data/pricing-reset/normalized-group-names-result.json', backup: dryRun ? 'data/pricing-reset/normalized-group-names-backup-dry-run.json' : 'data/pricing-reset/normalized-group-names-backup.json', counts: result.counts, sample: { groups: result.groupUpdates.slice(0, 3), cars: result.carUpdates.slice(0, 3) } }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
