'use strict'

const { validateSearchState } = require('../server/search/searchState')
const { createServerPublicClient } = require('../server/supabase/createServerClient')
const { dbSearchService } = require('../server/search-db/dbSearchService')
const { createDetailToken } = require('../server/security/detailToken')

const DB_SEARCH_STAGE = process.env.SEARCH_DB_STAGE || 'db-primary'
const DB_SEARCH_SOURCE = 'supabase-search'

const DB_DEFAULT_COMPANY = {
  companyId: 35457,
  companyName: '빵빵카(주)',
  companyTel: '025920079',
  fullGarageAddress: '서울 서초구 신반포로23길 78-9 (수푸레하우스) 1층',
}

async function runDbSearch(normalizedSearch) {
  const supabaseClient = createServerPublicClient()
  if (!supabaseClient) {
    throw new Error('supabase_client_unavailable')
  }

  const company = {
    ...DB_DEFAULT_COMPANY,
    companyName: process.env.SEARCH_COMPANY_NAME || DB_DEFAULT_COMPANY.companyName,
  }

  return dbSearchService.run({
    search: normalizedSearch,
    supabaseClient,
    options: {
      stage: DB_SEARCH_STAGE,
      company,
    },
  })
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const validation = validateSearchState(req.query || {})

  if (!validation.isValid) {
    return res.status(400).json({
      error: 'invalid_search_query',
      errors: validation.errors,
      search: validation.normalized,
    })
  }

  try {
    const dbResult = await runDbSearch(validation.normalized)
    const carsWithDetailToken = Array.isArray(dbResult.cars)
      ? dbResult.cars.map((car) => ({
        ...car,
        detailToken: createDetailToken({
          carId: car.carId,
          search: validation.normalized,
        }).token,
      }))
      : []

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res.status(200).json({
      ...dbResult,
      cars: carsWithDetailToken,
      company: dbResult.company || DB_DEFAULT_COMPANY,
      meta: {
        source: DB_SEARCH_SOURCE,
        stage: dbResult.meta?.stage || DB_SEARCH_STAGE,
      },
    })
  } catch (error) {
    const message = error && error.message ? error.message : 'db_search_failed'
    const statusCode = message === 'supabase_client_unavailable' ? 500 : 500

    return res.status(statusCode).json({
      error: 'db_search_failed',
      message,
    })
  }
}
