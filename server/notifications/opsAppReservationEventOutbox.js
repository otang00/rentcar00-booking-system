'use strict'

const {
  EVENT_TYPE,
  createEventId,
  buildOpsReservationEventPayload,
  sendOpsAppReservationEvent,
} = require('./sendOpsAppReservationEvent')

const MAX_BATCH_SIZE = 20
const DEFAULT_RETRY_DELAY_MS = 60 * 1000
const MAX_RETRY_DELAY_MS = 30 * 60 * 1000

function clampBatchSize(value) {
  const size = Number(value || 0)
  if (!Number.isFinite(size) || size <= 0) return 10
  return Math.min(Math.max(Math.floor(size), 1), MAX_BATCH_SIZE)
}

function computeRetryDelayMs(attempts = 0) {
  const normalizedAttempts = Math.max(Number(attempts || 0), 0)
  const delay = DEFAULT_RETRY_DELAY_MS * Math.pow(2, Math.min(normalizedAttempts, 5))
  return Math.min(delay, MAX_RETRY_DELAY_MS)
}

async function enqueueOpsAppReservationEvent({ supabaseClient, booking, bookingInput = {}, requestedBy, env = process.env, now = new Date() } = {}) {
  if (!supabaseClient || !booking?.id) {
    return {
      enqueued: false,
      skipped: true,
      reason: 'missing_booking_or_client',
      eventId: null,
    }
  }

  const eventId = createEventId(booking)
  if (!eventId) {
    return {
      enqueued: false,
      skipped: true,
      reason: 'missing_event_id',
      eventId: null,
    }
  }

  const eventPayload = buildOpsReservationEventPayload({ booking, bookingInput, env, now })
  const { data, error } = await supabaseClient
    .from('ops_app_reservation_event_outbox')
    .upsert({
      booking_order_id: booking.id,
      event_id: eventId,
      event_type: EVENT_TYPE,
      event_payload: eventPayload,
      status: 'pending',
      next_attempt_at: now.toISOString(),
      last_error: null,
      response_status: null,
      updated_at: now.toISOString(),
    }, {
      onConflict: 'event_id',
      ignoreDuplicates: true,
    })
    .select('id, event_id, status')
    .maybeSingle()

  if (error) {
    throw error
  }

  return {
    enqueued: true,
    skipped: false,
    eventId,
    outboxId: data?.id || null,
    deduped: !data,
    requestedBy: requestedBy || null,
  }
}

async function fetchPendingOpsAppReservationEvents({ supabaseClient, limit = 10, now = new Date() } = {}) {
  const { data, error } = await supabaseClient
    .from('ops_app_reservation_event_outbox')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', now.toISOString())
    .order('created_at', { ascending: true })
    .limit(clampBatchSize(limit))

  if (error) {
    throw error
  }

  return Array.isArray(data) ? data : []
}

async function markOutboxEventProcessing({ supabaseClient, item, now = new Date() } = {}) {
  const { data, error } = await supabaseClient
    .from('ops_app_reservation_event_outbox')
    .update({
      status: 'processing',
      locked_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', item.id)
    .in('status', ['pending', 'failed'])
    .select('id')
    .maybeSingle()

  if (error) {
    throw error
  }

  return Boolean(data?.id)
}

async function markOutboxEventSent({ supabaseClient, item, result, now = new Date() } = {}) {
  const { error } = await supabaseClient
    .from('ops_app_reservation_event_outbox')
    .update({
      status: 'sent',
      attempts: Number(item.attempts || 0) + 1,
      sent_at: now.toISOString(),
      locked_at: null,
      last_error: null,
      response_status: result?.status || null,
      updated_at: now.toISOString(),
    })
    .eq('id', item.id)

  if (error) throw error
}

async function markOutboxEventFailed({ supabaseClient, item, error, now = new Date() } = {}) {
  const nextAttempts = Number(item.attempts || 0) + 1
  const nextAttemptAt = new Date(now.getTime() + computeRetryDelayMs(nextAttempts)).toISOString()
  const { error: updateError } = await supabaseClient
    .from('ops_app_reservation_event_outbox')
    .update({
      status: 'failed',
      attempts: nextAttempts,
      next_attempt_at: nextAttemptAt,
      locked_at: null,
      last_error: error?.message || 'unknown_ops_app_reservation_event_error',
      response_status: error?.status || null,
      updated_at: now.toISOString(),
    })
    .eq('id', item.id)

  if (updateError) throw updateError
}

async function processOpsAppReservationEventOutbox({ supabaseClient, limit = 10, env = process.env, now = new Date() } = {}) {
  if (!supabaseClient) {
    throw new Error('supabase client is required')
  }

  const pending = await fetchPendingOpsAppReservationEvents({ supabaseClient, limit, now })
  const summary = {
    picked: pending.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    results: [],
  }

  for (const item of pending) {
    const locked = await markOutboxEventProcessing({ supabaseClient, item, now })
    if (!locked) {
      summary.skipped += 1
      continue
    }

    try {
      const result = await sendOpsAppReservationEvent({ booking: { id: item.booking_order_id }, env, now, payloadOverride: item.event_payload })
      if (result?.skipped) {
        const skippedError = new Error(result.reason || 'ops_app_reservation_event_skipped')
        skippedError.eventId = result.eventId || item.event_id
        throw skippedError
      }
      await markOutboxEventSent({ supabaseClient, item, result, now })
      summary.sent += 1
      summary.results.push({ id: item.id, eventId: item.event_id, status: 'sent', responseStatus: result.status || null })
    } catch (error) {
      await markOutboxEventFailed({ supabaseClient, item, error, now })
      summary.failed += 1
      summary.results.push({ id: item.id, eventId: item.event_id, status: 'failed', message: error?.message || 'unknown_error' })
    }
  }

  return summary
}

module.exports = {
  MAX_BATCH_SIZE,
  computeRetryDelayMs,
  enqueueOpsAppReservationEvent,
  fetchPendingOpsAppReservationEvents,
  processOpsAppReservationEventOutbox,
}
