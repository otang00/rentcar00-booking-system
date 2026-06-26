import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()

const REQUIRED_FRONTEND_ENV = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
]

const DOTENV_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
]

function parseDotenvLine(line) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/)
  if (!match) return null

  const [, key, rawValue = ''] = match
  let value = rawValue.trim()

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  return [key, value]
}

function loadDotenvFiles() {
  if (process.env.CHECK_FRONTEND_ENV_NO_DOTENV === 'true') return {}

  const loaded = {}

  for (const filename of DOTENV_FILES) {
    const filePath = path.join(ROOT, filename)
    if (!fs.existsSync(filePath)) continue

    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue
      const parsed = parseDotenvLine(line)
      if (!parsed) continue
      const [key, value] = parsed
      loaded[key] = value
    }
  }

  return loaded
}

function resolveEnv() {
  return {
    ...loadDotenvFiles(),
    ...process.env,
  }
}

function isValidUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.host)
  } catch {
    return false
  }
}

function fail(messages) {
  console.error('Frontend env check failed:')
  for (const message of messages) {
    console.error(`- ${message}`)
  }
  process.exit(1)
}

const env = resolveEnv()
const errors = []

for (const name of REQUIRED_FRONTEND_ENV) {
  if (!env[name]) {
    errors.push(`${name} is required for browser-side Supabase Auth.`)
  }
}

if (env.VITE_SUPABASE_URL && !isValidUrl(env.VITE_SUPABASE_URL)) {
  errors.push('VITE_SUPABASE_URL must be a valid https URL.')
}

if (
  env.SUPABASE_URL &&
  env.VITE_SUPABASE_URL &&
  env.SUPABASE_URL !== env.VITE_SUPABASE_URL
) {
  errors.push('SUPABASE_URL and VITE_SUPABASE_URL must point to the same project.')
}

if (
  env.SUPABASE_PUBLISHABLE_KEY &&
  env.VITE_SUPABASE_ANON_KEY &&
  env.SUPABASE_PUBLISHABLE_KEY !== env.VITE_SUPABASE_ANON_KEY
) {
  errors.push('SUPABASE_PUBLISHABLE_KEY and VITE_SUPABASE_ANON_KEY must match.')
}

if (errors.length) {
  fail(errors)
}

console.log('Frontend env check passed.')
