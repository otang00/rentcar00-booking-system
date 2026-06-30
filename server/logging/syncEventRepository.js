'use strict'

const { buildSyncEvent } = require('./syncLogger')

const MISSING_SYNC_EVENTS_PATTERN = /(sync_events|relation .* does not exist|schema cache|could not find the table)/i

function isMissingSyncEventsTableError(error) {
  if (!error) return false
  const message = [error.message, error.details, error.hint, error.code]
    .filter(Boolean)
    .map(String)
    .join(' ')
  return MISSING_SYNC_EVENTS_PATTERN.test(message)
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
  }
}

function normalizeSyncEventRow(row = {}) {
  return {
    id: row.id || null,
    occurredAt: row.occurred_at || row.created_at || null,
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
    visibility: row.visibility || 'ops',
    dedupeKey: row.dedupe_key || '',
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
  }
}

async function persistSyncEventBestEffort({ supabaseClient, event } = {}) {
  if (!supabaseClient || !event) {
    return { ok: false, skipped: true, reason: 'missing_client_or_event' }
  }

  try {
    const row = toSyncEventRow(event)
    const { data, error } = await supabaseClient
      .from('sync_events')
      .insert(row)
      .select('*')
      .single()

    if (error) {
      if (isMissingSyncEventsTableError(error)) {
        return { ok: false, skipped: true, reason: 'sync_events_unavailable', error }
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
    .select('id, occurred_at, provider, run_id, stage, action, severity, event_type, ims_reservation_id, car_number, error_code, message, requires_ack, ack_status, ack_key, visibility, dedupe_key, metadata, created_at')
    .order('occurred_at', { ascending: false })
    .limit(safeLimit)

  if (visibility) {
    query = query.in('visibility', [visibility, 'ops'])
  }

  query = query.or(`severity.in.(${allowedSeverities.join(',')}),event_type.in.(${allowedEventTypes.join(',')})`)

  const { data, error } = await query
  if (error) {
    if (isMissingSyncEventsTableError(error)) return []
    throw error
  }

  return Array.isArray(data) ? data.map(normalizeSyncEventRow) : []
}

module.exports = {
  fetchRecentSyncEvents,
  isMissingSyncEventsTableError,
  normalizeSyncEventRow,
  persistSyncEventBestEffort,
  toSyncEventRow,
}
