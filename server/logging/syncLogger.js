'use strict'

const SENSITIVE_KEY_PATTERN = /(phone|otp|secret|token|authorization|cookie|password|credential|apiKey|accessKey|refreshKey|privateKey|publicKey|serviceKey|key)/i

const ALLOWED_PROVIDERS = new Set(['ims', 'zzimcar', 'carmore', 'system'])
const ALLOWED_SEVERITIES = new Set(['debug', 'info', 'warn', 'error', 'critical'])
const ALLOWED_VISIBILITIES = new Set(['ops', 'admin', 'internal'])
const ALLOWED_ACK_STATUSES = new Set(['not_required', 'unread', 'acknowledged'])

let syncEventRepository = null

const ALLOWED_EVENT_FIELDS = new Set([
  'provider',
  'runId',
  'stage',
  'action',
  'severity',
  'eventType',
  'imsReservationId',
  'carNumber',
  'errorCode',
  'message',
  'metadata',
  'requiresAck',
  'ackStatus',
  'ackKey',
  'visibility',
  'dedupeKey',
])

function truncateString(value, maxLength = 240) {
  return String(value).slice(0, maxLength)
}

function sanitizeValue(value, depth = 0) {
  if (value == null) return value
  if (typeof value === 'string') return truncateString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1))
  if (typeof value !== 'object') return undefined
  if (depth >= 3) return '[object]'

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
      .map(([key, entryValue]) => [key, sanitizeValue(entryValue, depth + 1)])
      .filter(([, entryValue]) => entryValue !== undefined),
  )
}

function normalizeProvider(provider) {
  const normalized = truncateString(provider || 'system', 40).toLowerCase()
  return ALLOWED_PROVIDERS.has(normalized) ? normalized : 'system'
}

function normalizeSeverity(severity) {
  const normalized = truncateString(severity || 'info', 20).toLowerCase()
  return ALLOWED_SEVERITIES.has(normalized) ? normalized : 'info'
}

function normalizeVisibility(visibility) {
  const normalized = truncateString(visibility || 'ops', 20).toLowerCase()
  return ALLOWED_VISIBILITIES.has(normalized) ? normalized : 'ops'
}

function normalizeAckStatus({ requiresAck, ackStatus }) {
  const normalized = truncateString(ackStatus || '', 30).toLowerCase()
  if (ALLOWED_ACK_STATUSES.has(normalized)) return normalized
  return requiresAck ? 'unread' : 'not_required'
}

function buildSyncEvent(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date()
  const event = {}

  for (const [key, value] of Object.entries(input || {})) {
    if (!ALLOWED_EVENT_FIELDS.has(key)) continue
    if (key !== 'ackKey' && key !== 'dedupeKey' && SENSITIVE_KEY_PATTERN.test(key)) continue
    event[key] = value
  }

  const requiresAck = event.requiresAck === true
  const severity = normalizeSeverity(event.severity)

  const entry = {
    timestamp: now.toISOString(),
    logger: 'sync',
    provider: normalizeProvider(event.provider),
    runId: event.runId ? truncateString(event.runId, 120) : undefined,
    stage: event.stage ? truncateString(event.stage, 80) : undefined,
    action: event.action ? truncateString(event.action, 80) : undefined,
    severity,
    eventType: event.eventType ? truncateString(event.eventType, 120) : 'sync_event',
    imsReservationId: event.imsReservationId ? truncateString(event.imsReservationId, 80) : undefined,
    carNumber: event.carNumber ? truncateString(event.carNumber, 40) : undefined,
    errorCode: event.errorCode ? truncateString(event.errorCode, 120) : undefined,
    message: event.message ? truncateString(event.message, 300) : '',
    requiresAck,
    ackStatus: normalizeAckStatus({ requiresAck, ackStatus: event.ackStatus }),
    visibility: normalizeVisibility(event.visibility),
    ackKey: event.ackKey ? truncateString(event.ackKey, 160) : undefined,
    dedupeKey: event.dedupeKey ? truncateString(event.dedupeKey, 160) : undefined,
    metadata: sanitizeValue(event.metadata || {}),
  }

  return Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined))
}

function writeSyncEvent(input = {}, options = {}) {
  const entry = buildSyncEvent(input, options)
  const line = JSON.stringify(entry)
  const severity = entry.severity

  if (severity === 'error' || severity === 'critical') {
    console.error(line)
  } else if (severity === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }

  const supabaseClient = options.supabaseClient || options.dbClient
  if (supabaseClient) {
    const repository = syncEventRepository || require('./syncEventRepository')
    repository.persistSyncEventBestEffort({ supabaseClient, event: entry }).catch(() => {})
  }

  return entry
}

function setSyncEventRepositoryForTest(repository) {
  syncEventRepository = repository || null
}

function createSyncLogger(defaultContext = {}, defaultOptions = {}) {
  function log(severity, input = {}, options = {}) {
    return writeSyncEvent({ ...defaultContext, ...input, severity }, { ...defaultOptions, ...options })
  }

  return {
    debug(input, options) { return log('debug', input, options) },
    info(input, options) { return log('info', input, options) },
    warn(input, options) { return log('warn', input, options) },
    error(input, options) { return log('error', input, options) },
    critical(input, options) { return log('critical', input, options) },
    event(input, options) { return writeSyncEvent({ ...defaultContext, ...input }, { ...defaultOptions, ...options }) },
  }
}

const syncLogger = createSyncLogger()

module.exports = {
  buildSyncEvent,
  createSyncLogger,
  sanitizeSyncValue: sanitizeValue,
  setSyncEventRepositoryForTest,
  syncLogger,
  writeSyncEvent,
}
