'use strict'

const SENSITIVE_KEY_PATTERN = /(phone|otp|code|secret|token|authorization|cookie|password|credential|key)/i
const ALLOWED_CONTEXT_KEYS = new Set([
  'route',
  'status',
  'reason',
  'requestId',
  'phoneLast4',
  'purpose',
  'cooldownSeconds',
  'metadata',
])

function sanitizeValue(value, depth = 0) {
  if (value == null) return value
  if (typeof value === 'string') return value.slice(0, 240)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => sanitizeValue(item, depth + 1))
  if (typeof value !== 'object') return undefined
  if (depth >= 2) return '[object]'

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
      .map(([key, entryValue]) => [key, sanitizeValue(entryValue, depth + 1)])
      .filter(([, entryValue]) => entryValue !== undefined),
  )
}

function buildSafeContext(context = {}) {
  if (!context || typeof context !== 'object') return {}

  const safeContext = {}
  for (const [key, value] of Object.entries(context)) {
    if (!ALLOWED_CONTEXT_KEYS.has(key)) continue
    if (SENSITIVE_KEY_PATTERN.test(key) && key !== 'phoneLast4') continue
    safeContext[key] = sanitizeValue(value)
  }
  return safeContext
}

function writeLog(level, event, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event: String(event || 'app_event').slice(0, 120),
    message: String(message || '').slice(0, 240),
    ...buildSafeContext(context),
  }

  const line = JSON.stringify(entry)
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

const appLogger = {
  info(event, message, context) {
    writeLog('info', event, message, context)
  },
  warn(event, message, context) {
    writeLog('warn', event, message, context)
  },
  error(event, message, context) {
    writeLog('error', event, message, context)
  },
}

module.exports = {
  appLogger,
  buildSafeContext,
}
