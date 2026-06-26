'use strict'

const { createClient } = require('@supabase/supabase-js')

function resolveSupabaseUrl(env = process.env) {
  if (env.SUPABASE_URL) {
    return env.SUPABASE_URL.trim()
  }

  if (env.SUPABASE_PROJECT_REF) {
    const ref = env.SUPABASE_PROJECT_REF.trim()
    if (ref) {
      return `https://${ref}.supabase.co`
    }
  }

  return ''
}

function resolveSupabasePrivilegedKey(env = process.env) {
  const candidates = [
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.SUPABASE_SERVICE_KEY,
  ]

  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return candidate.trim()
    }
  }

  return ''
}

function resolveSupabasePublicKey(env = process.env) {
  const candidates = [
    env.SUPABASE_PUBLISHABLE_KEY,
    env.SUPABASE_ANON_KEY,
  ]

  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return candidate.trim()
    }
  }

  return ''
}

function createBaseClient({ url, key, headers } = {}) {
  const resolvedUrl = String(url || '').trim()
  const resolvedKey = String(key || '').trim()

  if (!resolvedUrl || !resolvedKey) {
    return null
  }

  return createClient(resolvedUrl, resolvedKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'x-client-info': 'premove-shadow-search',
        ...(headers || {}),
      },
    },
  })
}

function createServerPrivilegedClient(options = {}) {
  const url = (options.url || resolveSupabaseUrl()).trim()
  const key = (options.key || resolveSupabasePrivilegedKey()).trim()

  return createBaseClient({
    url,
    key,
    headers: options.headers,
  })
}

function createServerPublicClient(options = {}) {
  const url = (options.url || resolveSupabaseUrl()).trim()
  const key = (options.key || resolveSupabasePublicKey()).trim()

  return createBaseClient({
    url,
    key,
    headers: options.headers,
  })
}

module.exports = {
  createServerPrivilegedClient,
  createServerPublicClient,
  resolveSupabaseUrl,
  resolveSupabasePrivilegedKey,
  resolveSupabasePublicKey,
}
