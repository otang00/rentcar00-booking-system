const DEFAULT_TIMEOUT_MS = 8000

function getSupabaseConfig() {
  const projectRef = process.env.SUPABASE_PROJECT_REF || ''
  const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || ''

  return {
    projectRef: projectRef.trim(),
    apiKey: apiKey.trim(),
  }
}

async function fetchCarBySourceCarId(sourceCarId, options = {}) {
  const numericId = Number(sourceCarId)

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return null
  }

  const { projectRef, apiKey } = getSupabaseConfig()

  if (!projectRef || !apiKey) {
    return null
  }

  const controller = new AbortController()
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS)
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const baseUrl = new URL(`https://${projectRef}.supabase.co/rest/v1/cars`)
    baseUrl.searchParams.set('select', 'source_car_id,source_group_id,car_number,name,display_name,image_url,model_year,fuel_type,seats,color,rent_age,active,options_json,metadata')
    baseUrl.searchParams.set('limit', '1')

    const attempts = [
      ['source_car_id', `eq.${numericId}`],
      ['metadata->>partner_car_id', `eq.${numericId}`],
    ]

    for (const [field, value] of attempts) {
      const url = new URL(baseUrl.toString())
      url.searchParams.set(field, value)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        const error = new Error(`supabase cars fetch failed with status ${response.status}`)
        error.code = 'SUPABASE_CARS_FETCH_FAILED'
        throw error
      }

      const rows = await response.json()
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0]
      }
    }

    return null
  } catch (error) {
    if (error && error.name === 'AbortError') {
      const timeoutError = new Error(`supabase cars fetch timeout after ${timeoutMs}ms`)
      timeoutError.code = 'SUPABASE_CARS_FETCH_TIMEOUT'
      throw timeoutError
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

module.exports = {
  fetchCarBySourceCarId,
}
