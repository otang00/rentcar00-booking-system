import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const REQUIRED_RUNTIME_ENV = [
  'DETAIL_TOKEN_SECRET',
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
  if (process.env.CHECK_RUNTIME_ENV_NO_DOTENV === 'true') return {}

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

function shouldEnforceRuntimeEnv() {
  return process.env.VERCEL === '1' || process.env.CHECK_RUNTIME_ENV_STRICT === 'true'
}

function fail(messages) {
  console.error('Runtime env check failed:')
  for (const message of messages) {
    console.error(`- ${message}`)
  }
  process.exit(1)
}

if (!shouldEnforceRuntimeEnv()) {
  console.log('Runtime env check skipped outside deployment. Set CHECK_RUNTIME_ENV_STRICT=true to enforce locally.')
  process.exit(0)
}

const env = resolveEnv()
const errors = []

for (const name of REQUIRED_RUNTIME_ENV) {
  if (!env[name]) {
    errors.push(`${name} is required for server runtime.`)
  }
}

if (errors.length) {
  fail(errors)
}

console.log('Runtime env check passed.')
