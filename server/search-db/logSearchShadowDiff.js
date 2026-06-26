'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')

async function persistSupabase({ supabaseClient, record }) {
  if (!supabaseClient) return
  try {
    const { error } = await supabaseClient.from('search_shadow_diffs').insert(record)
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[shadow-diff] supabase insert failed', error)
    }
  } catch (error) {
    console.error('[shadow-diff] supabase insert threw', error)
  }
}

async function appendFile({ filePath, record }) {
  if (!filePath) return
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8')
  } catch (error) {
    console.error('[shadow-diff] file append failed', error)
  }
}

async function logSearchShadowDiff({ payload, supabaseClient, filePath }) {
  if (!payload) return

  const record = {
    search_hash: payload.searchHash,
    search_params: payload.searchParams,
    partner: payload.partner,
    db: payload.db,
    diff: payload.diff,
    execution_meta: payload.executionMeta,
  }

  await Promise.all([
    persistSupabase({ supabaseClient, record }),
    appendFile({ filePath, record }),
  ])
}

module.exports = {
  logSearchShadowDiff,
}
