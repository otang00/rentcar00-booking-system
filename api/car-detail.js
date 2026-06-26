const { normalizeSearchState, validateDetailSearch } = require('../server/search/searchState')
const { createServerPublicClient } = require('../server/supabase/createServerClient')
const { buildDbCarDetailDto } = require('../server/detail/buildDbCarDetailDto')
const { verifyDetailToken } = require('../server/security/detailToken')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const { carId, detailToken } = req.query || {}
  const search = normalizeSearchState(req.query || {})
  const validation = validateDetailSearch({ carId, searchState: search })

  if (!validation.isValid) {
    return res.status(400).json({
      error: 'invalid_detail_query',
      errors: validation.errors,
      search: validation.normalized,
      carId: carId || null,
    })
  }

  try {
    const tokenValidation = verifyDetailToken({
      token: detailToken,
      carId,
      search: validation.normalized,
    })

    if (!tokenValidation.isValid) {
      return res.status(403).json({
        error: 'invalid_detail_token',
      })
    }

    const supabaseClient = createServerPublicClient()
    if (!supabaseClient) {
      throw new Error('supabase_client_unavailable')
    }

    const dto = await buildDbCarDetailDto({
      supabaseClient,
      carId,
      search: validation.normalized,
    })

    if (!dto) {
      return res.status(404).json({
        error: 'car_detail_not_found',
        carId: Number(carId),
      })
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res.status(200).json(dto)
  } catch (error) {
    const message = error && error.message ? error.message : 'db_detail_failed'

    return res.status(500).json({
      error: 'db_detail_failed',
      message,
    })
  }
}
