'use strict'

const { buildSyncEvent } = require('./syncLogger')

const MISSING_SYNC_EVENTS_PATTERN = /(sync_events|relation .* does not exist|schema cache|could not find the table)/i
const DEDUPE_SCHEMA_MISSING_PATTERN = /(last_seen_at|seen_count|ack_note|acked_at|schema cache|could not find .* column)/i
const ACK_STATUSES = new Set(['unread', 'acknowledged', 'ignored', 'resolved'])
const TERMINAL_ACK_STATUSES = new Set(['acknowledged', 'ignored', 'resolved'])

function isMissingSyncEventsTableError(error) {
  if (!error) return false
  const message = [error.message, error.details, error.hint, error.code]
    .filter(Boolean)
    .map(String)
    .join(' ')
  return MISSING_SYNC_EVENTS_PATTERN.test(message)
}

function isDedupeSchemaMissingError(error) {
  if (!error) return false
  const message = [error.message, error.details, error.hint, error.code]
    .filter(Boolean)
    .map(String)
    .join(' ')
  return DEDUPE_SCHEMA_MISSING_PATTERN.test(message)
}

function normalizeAckAction(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return ACK_STATUSES.has(normalized) ? normalized : ''
}

function toSyncEventRow(event) {
  const normalized = buildSyncEvent(event)
  return {
    occurred_at: normalized.timestamp,
    provider: normalized.provider,
    run_id: normalized.runId || null,
    stage: normalized.stage || null,
    action: normalized.action || null,
    severity: normalized.severity,
    event_type: normalized.eventType,
    ims_reservation_id: normalized.imsReservationId || null,
    car_number: normalized.carNumber || null,
    error_code: normalized.errorCode || null,
    message: normalized.message || '',
    requires_ack: normalized.requiresAck === true,
    ack_status: normalized.ackStatus || 'not_required',
    ack_key: normalized.ackKey || null,
    visibility: normalized.visibility || 'ops',
    dedupe_key: normalized.dedupeKey || null,
    metadata: normalized.metadata || {},
    last_seen_at: normalized.timestamp,
    seen_count: 1,
  }
}

function normalizeSyncEventRow(row = {}) {
  return {
    id: row.id || null,
    occurredAt: row.occurred_at || row.created_at || null,
    lastSeenAt: row.last_seen_at || row.occurred_at || row.created_at || null,
    seenCount: Number(row.seen_count || 1),
    provider: row.provider || 'system',
    runId: row.run_id || null,
    stage: row.stage || '',
    action: row.action || '',
    severity: row.severity || 'info',
    eventType: row.event_type || 'sync_event',
    imsReservationId: row.ims_reservation_id || '',
    carNumber: row.car_number || '',
    errorCode: row.error_code || '',
    message: row.message || '',
    requiresAck: row.requires_ack === true,
    ackStatus: row.ack_status || 'not_required',
    ackKey: row.ack_key || '',
    ackedAt: row.acked_at || null,
    ackNote: row.ack_note || '',
    visibility: row.visibility || 'ops',
    dedupeKey: row.dedupe_key || '',
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
  }
}

function shouldDedupeEvent(row) {
  return row?.requires_ack === true && Boolean(row?.dedupe_key)
}

function buildRepeatedEventUpdate({ existing = {}, row = {} } = {}) {
  const existingMetadata = existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}
  const rowMetadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const existingAckStatus = existing.ack_status || 'unread'
  const nextAckStatus = TERMINAL_ACK_STATUSES.has(existingAckStatus) ? existingAckStatus : (row.ack_status || 'unread')

  return {
    occurred_at: row.occurred_at,
    last_seen_at: row.occurred_at,
    seen_count: Number(existing.seen_count || 1) + 1,
    provider: row.provider,
    run_id: row.run_id,
    stage: row.stage,
    action: row.action,
    severity: row.severity,
    event_type: row.event_type,
    ims_reservation_id: row.ims_reservation_id,
    car_number: row.car_number,
    error_code: row.error_code,
    message: row.message,
    visibility: row.visibility,
    ack_status: nextAckStatus,
    acked_at: TERMINAL_ACK_STATUSES.has(existingAckStatus) ? existing.acked_at || null : null,
    ack_note: TERMINAL_ACK_STATUSES.has(existingAckStatus) ? existing.ack_note || null : null,
    metadata: {
      ...existingMetadata,
      ...rowMetadata,
      firstSeenAt: existingMetadata.firstSeenAt || existing.occurred_at || row.occurred_at,
      lastSeenAt: row.occurred_at,
      lastSeenRunId: row.run_id || null,
    },
  }
}

async function insertSyncEvent({ supabaseClient, row } = {}) {
  const { data, error } = await supabaseClient
    .from('sync_events')
    .insert(row)
    .select('*')
    .single()

  if (error) return { data: null, error }
  return { data, error: null }
}

async function persistDedupeSyncEvent({ supabaseClient, row } = {}) {
  const { data: existing, error: selectError } = await supabaseClient
    .from('sync_events')
    .select('id, occurred_at, run_id, ack_status, acked_at, ack_note, seen_count, metadata')
    .eq('dedupe_key', row.dedupe_key)
    .eq('requires_ack', true)
    .maybeSingle()

  if (selectError) return { data: null, error: selectError }

  if (!existing) {
    return insertSyncEvent({ supabaseClient, row })
  }

  const { data, error } = await supabaseClient
    .from('sync_events')
    .update(buildRepeatedEventUpdate({ existing, row }))
    .eq('id', existing.id)
    .select('*')
    .single()

  return { data, error }
}

async function persistSyncEventBestEffort({ supabaseClient, event } = {}) {
  if (!supabaseClient || !event) {
    return { ok: false, skipped: true, reason: 'missing_client_or_event' }
  }

  try {
    const row = toSyncEventRow(event)
    const { data, error } = shouldDedupeEvent(row)
      ? await persistDedupeSyncEvent({ supabaseClient, row })
      : await insertSyncEvent({ supabaseClient, row })

    if (error) {
      if (isMissingSyncEventsTableError(error)) {
        return { ok: false, skipped: true, reason: 'sync_events_unavailable', error }
      }
      if (isDedupeSchemaMissingError(error)) {
        const fallback = await insertSyncEvent({ supabaseClient, row: Object.fromEntries(Object.entries(row).filter(([key]) => !['last_seen_at', 'seen_count'].includes(key))) })
        if (!fallback.error) return { ok: true, event: normalizeSyncEventRow(fallback.data) }
        return { ok: false, skipped: true, reason: 'sync_event_insert_failed', error: fallback.error }
      }
      return { ok: false, skipped: true, reason: 'sync_event_insert_failed', error }
    }

    return { ok: true, event: normalizeSyncEventRow(data) }
  } catch (error) {
    return { ok: false, skipped: true, reason: 'sync_event_insert_failed', error }
  }
}

async function fetchRecentSyncEvents({ supabaseClient, limit = 10, visibility = 'admin' } = {}) {
  if (!supabaseClient) return []
  const safeLimit = Math.min(Math.max(Number(limit || 10), 1), 20)
  const allowedSeverities = ['warn', 'error', 'critical']
  const allowedEventTypes = [
    'sync_failed',
    'sync_partial_success',
    'sync_warning',
    'sync_stale_mapping',
    'sync_overlap_duplicate',
    'sync_overlap_recovery_failed',
    'recover_missing_disable_time',
    'sync_unmanaged_wall_detected',
    'sync_child_block_split_planned',
    'sync_child_block_create_failed',
    'sync_manual_recovery_required',
  ]

  let query = supabaseClient
    .from('sync_events')
    .select('id, occurred_at, last_seen_at, seen_count, provider, run_id, stage, action, severity, event_type, ims_reservation_id, car_number, error_code, message, requires_ack, ack_status, ack_key, acked_at, ack_note, visibility, dedupe_key, metadata, created_at')
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .order('occurred_at', { ascending: false })
    .limit(safeLimit)

  if (visibility) {
    query = query.in('visibility', [visibility, 'ops'])
  }

  query = query.or(`severity.in.(${allowedSeverities.join(',')}),event_type.in.(${allowedEventTypes.join(',')})`)

  const { data, error } = await query
  if (error) {
    if (isMissingSyncEventsTableError(error)) return []
    if (isDedupeSchemaMissingError(error)) {
      return fetchRecentSyncEventsLegacy({ supabaseClient, safeLimit, visibility, allowedSeverities, allowedEventTypes })
    }
    throw error
  }

  return Array.isArray(data) ? data.map(normalizeSyncEventRow) : []
}

async function fetchRecentSyncEventsLegacy({ supabaseClient, safeLimit, visibility, allowedSeverities, allowedEventTypes } = {}) {
  let query = supabaseClient
    .from('sync_events')
    .select('id, occurred_at, provider, run_id, stage, action, severity, event_type, ims_reservation_id, car_number, error_code, message, requires_ack, ack_status, ack_key, visibility, dedupe_key, metadata, created_at')
    .order('occurred_at', { ascending: false })
    .limit(safeLimit)

  if (visibility) query = query.in('visibility', [visibility, 'ops'])
  const { data, error } = await query.or(`severity.in.(${allowedSeverities.join(',')}),event_type.in.(${allowedEventTypes.join(',')})`)
  if (error) {
    if (isMissingSyncEventsTableError(error)) return []
    throw error
  }
  return Array.isArray(data) ? data.map(normalizeSyncEventRow) : []
}

async function updateSyncEventAck({ supabaseClient, id, dedupeKey, ackStatus, ackNote = '' } = {}) {
  if (!supabaseClient) throw new Error('supabase_client_required')
  const nextAckStatus = normalizeAckAction(ackStatus)
  if (!nextAckStatus || nextAckStatus === 'unread') {
    const error = new Error('invalid_ack_status')
    error.status = 400
    throw error
  }

  let query = supabaseClient
    .from('sync_events')
    .update({ ack_status: nextAckStatus, acked_at: new Date().toISOString(), ack_note: String(ackNote || '').slice(0, 500) || null })

  if (id) query = query.eq('id', id)
  else if (dedupeKey) query = query.eq('dedupe_key', dedupeKey).eq('requires_ack', true)
  else {
    const error = new Error('missing_event_identifier')
    error.status = 400
    throw error
  }

  const { data, error } = await query.select('id, occurred_at, last_seen_at, seen_count, provider, run_id, stage, action, severity, event_type, ims_reservation_id, car_number, error_code, message, requires_ack, ack_status, ack_key, acked_at, ack_note, visibility, dedupe_key, metadata, created_at').maybeSingle()
  if (error) throw error
  if (!data) {
    const notFound = new Error('sync_event_not_found')
    notFound.status = 404
    throw notFound
  }
  return normalizeSyncEventRow(data)
}

module.exports = {
  fetchRecentSyncEvents,
  isMissingSyncEventsTableError,
  normalizeSyncEventRow,
  persistSyncEventBestEffort,
  toSyncEventRow,
  updateSyncEventAck,
}
