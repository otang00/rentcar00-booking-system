'use strict'

const { computeSearchDiff } = require('../computeSearchDiff')
const { logSearchShadowDiff } = require('../logSearchShadowDiff')

function buildPayload({ partnerDto, dbDto, normalizedSearch, diff, executionMeta }) {
  return {
    searchHash: diff.searchHash,
    searchParams: normalizedSearch,
    partner: {
      totalCount: partnerDto.totalCount,
      cars: partnerDto.cars,
      company: partnerDto.company,
    },
    db: {
      totalCount: dbDto.totalCount,
      cars: dbDto.cars,
      company: dbDto.company,
    },
    diff: diff.diff,
    executionMeta,
  }
}

async function recordShadowDiff({
  partnerDto,
  dbDto,
  normalizedSearch,
  supabaseClient,
  filePath,
  executionMeta = {},
}) {
  if (!partnerDto || !dbDto || !normalizedSearch) {
    return {
      logged: false,
      reason: 'missing_inputs',
    }
  }

  const diff = computeSearchDiff({ partnerDto, dbDto, normalizedSearch })

  const payload = buildPayload({
    partnerDto,
    dbDto,
    normalizedSearch,
    diff,
    executionMeta: {
      recordedAt: new Date().toISOString(),
      trigger: 'api/search-cars',
      ...executionMeta,
    },
  })

  await logSearchShadowDiff({ payload, supabaseClient, filePath })

  return {
    logged: true,
    searchHash: diff.searchHash,
    diff: diff.diff,
  }
}

module.exports = {
  recordShadowDiff,
}
