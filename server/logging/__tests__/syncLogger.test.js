'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildSyncEvent,
  createSyncLogger,
  setSyncEventRepositoryForTest,
} = require('../syncLogger')
const {
  fetchRecentSyncEvents,
  normalizeSyncEventRow,
  persistSyncEventBestEffort,
  toSyncEventRow,
} = require('../syncEventRepository')

function captureConsole(methodName, fn) {
  const original = console[methodName]
  const lines = []
  console[methodName] = (line) => lines.push(line)
  try {
    const result = fn()
    return { lines, result }
  } finally {
    console[methodName] = original
  }
}

test('buildSyncEvent returns common sync event fields with ack defaults', () => {
  const event = buildSyncEvent({
    provider: 'zzimcar',
    runId: 'run-1',
    stage: 'reconcile',
    action: 'recover_missing_disable_time',
    severity: 'warn',
    eventType: 'sync_overlap_duplicate',
    imsReservationId: 4291354,
    carNumber: '101하7003',
    errorCode: 'VEHICLE_SCHEDULE_DUPLICATION_ERROR',
    message: 'Disable time overlaps existing schedule.',
    requiresAck: true,
    ackKey: 'zzimcar:4291354',
    visibility: 'admin',
    dedupeKey: 'zzimcar:101하7003:2026-06-20:2026-07-23',
    metadata: { overlapCount: 2 },
  }, { now: new Date('2026-06-28T05:00:00.000Z') })

  assert.equal(event.timestamp, '2026-06-28T05:00:00.000Z')
  assert.equal(event.logger, 'sync')
  assert.equal(event.provider, 'zzimcar')
  assert.equal(event.stage, 'reconcile')
  assert.equal(event.action, 'recover_missing_disable_time')
  assert.equal(event.severity, 'warn')
  assert.equal(event.eventType, 'sync_overlap_duplicate')
  assert.equal(event.imsReservationId, '4291354')
  assert.equal(event.carNumber, '101하7003')
  assert.equal(event.errorCode, 'VEHICLE_SCHEDULE_DUPLICATION_ERROR')
  assert.equal(event.requiresAck, true)
  assert.equal(event.ackStatus, 'unread')
  assert.equal(event.visibility, 'admin')
  assert.equal(event.ackKey, 'zzimcar:4291354')
  assert.equal(event.dedupeKey, 'zzimcar:101하7003:2026-06-20:2026-07-23')
  assert.deepEqual(event.metadata, { overlapCount: 2 })
})

test('buildSyncEvent removes sensitive metadata and ignores unapproved top-level fields', () => {
  const event = buildSyncEvent({
    provider: 'ims',
    eventType: 'sync_failed',
    message: 'failed',
    token: 'top-secret-token',
    metadata: {
      safe: 'ok',
      password: 'secret',
      authorization: 'Bearer secret',
      cookie: 'session=secret',
      nested: {
        apiKey: 'secret-key',
        visible: 'value',
      },
    },
  })

  const serialized = JSON.stringify(event)
  assert.equal(event.token, undefined)
  assert.equal(event.metadata.safe, 'ok')
  assert.equal(event.metadata.nested.visible, 'value')
  assert.doesNotMatch(serialized, /secret|Bearer|session=/)
  assert.doesNotMatch(serialized, /password|authorization|cookie|apiKey/)
})

test('toSyncEventRow maps logger event to database row shape', () => {
  const row = toSyncEventRow({
    provider: 'zzimcar',
    runId: 'run-3',
    severity: 'warn',
    eventType: 'sync_overlap_duplicate',
    imsReservationId: '4291354',
    carNumber: '101하7003',
    message: 'overlap',
    requiresAck: true,
    visibility: 'admin',
    metadata: { overlapCount: 2, token: 'secret' },
  })

  assert.equal(row.provider, 'zzimcar')
  assert.equal(row.run_id, 'run-3')
  assert.equal(row.severity, 'warn')
  assert.equal(row.event_type, 'sync_overlap_duplicate')
  assert.equal(row.ims_reservation_id, '4291354')
  assert.equal(row.car_number, '101하7003')
  assert.equal(row.requires_ack, true)
  assert.equal(row.ack_status, 'unread')
  assert.equal(row.visibility, 'admin')
  assert.equal(row.metadata.overlapCount, 2)
  assert.equal(row.metadata.token, undefined)
})

test('persistSyncEventBestEffort skips unavailable sync_events table without throwing', async () => {
  const supabaseClient = {
    from(tableName) {
      assert.equal(tableName, 'sync_events')
      return {
        insert() { return this },
        select() { return this },
        async single() {
          return { data: null, error: { message: 'relation "public.sync_events" does not exist' } }
        },
      }
    },
  }

  const result = await persistSyncEventBestEffort({
    supabaseClient,
    event: { provider: 'ims', severity: 'error', eventType: 'sync_failed', message: 'failed' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.skipped, true)
  assert.equal(result.reason, 'sync_events_unavailable')
})

test('fetchRecentSyncEvents normalizes recent admin-visible events and falls back on missing table', async () => {
  const calls = []
  const supabaseClient = {
    from(tableName) {
      calls.push(['from', tableName])
      return {
        select() { calls.push(['select']); return this },
        order(column, options) { calls.push(['order', column, options]); return this },
        limit(value) { calls.push(['limit', value]); return this },
        in(column, values) { calls.push(['in', column, values]); return this },
        or(filter) {
          calls.push(['or', filter])
          return Promise.resolve({
            data: [{ id: 'event-1', occurred_at: '2026-06-29T00:00:00.000Z', provider: 'carmore', severity: 'warn', event_type: 'sync_partial_success', message: 'partial' }],
            error: null,
          })
        },
      }
    },
  }

  const events = await fetchRecentSyncEvents({ supabaseClient, limit: 50 })
  assert.equal(events.length, 1)
  assert.equal(events[0].id, 'event-1')
  assert.equal(events[0].provider, 'carmore')
  assert.equal(events[0].eventType, 'sync_partial_success')
  assert.deepEqual(calls.find((call) => call[0] === 'limit'), ['limit', 20])

  const missingClient = {
    from() {
      return {
        select() { return this },
        order() { return this },
        limit() { return this },
        in() { return this },
        or() { return Promise.resolve({ data: null, error: { message: 'sync_events missing from schema cache' } }) },
      }
    },
  }
  assert.deepEqual(await fetchRecentSyncEvents({ supabaseClient: missingClient }), [])
})

test('normalizeSyncEventRow returns admin API shape', () => {
  assert.deepEqual(normalizeSyncEventRow({
    id: 'event-2',
    occurred_at: '2026-06-29T01:00:00.000Z',
    provider: 'ims',
    run_id: 'run-4',
    severity: 'error',
    event_type: 'sync_failed',
    ims_reservation_id: 'ims-1',
    car_number: '12가1234',
    message: 'failed',
    requires_ack: true,
    ack_status: 'unread',
    visibility: 'admin',
    metadata: { failedCount: 1 },
  }), {
    id: 'event-2',
    occurredAt: '2026-06-29T01:00:00.000Z',
    provider: 'ims',
    runId: 'run-4',
    stage: '',
    action: '',
    severity: 'error',
    eventType: 'sync_failed',
    imsReservationId: 'ims-1',
    carNumber: '12가1234',
    errorCode: '',
    message: 'failed',
    requiresAck: true,
    ackStatus: 'unread',
    ackKey: '',
    visibility: 'admin',
    dedupeKey: '',
    metadata: { failedCount: 1 },
  })
})

test('createSyncLogger optionally sends event to DB repository best-effort', () => {
  const persisted = []
  setSyncEventRepositoryForTest({
    persistSyncEventBestEffort(payload) {
      persisted.push(payload)
      return Promise.resolve({ ok: true })
    },
  })

  const logger = createSyncLogger({ provider: 'ims', runId: 'run-db' })
  const supabaseClient = { marker: 'fake-client' }
  const { lines } = captureConsole('error', () => logger.error({
    eventType: 'sync_failed',
    message: 'failed',
  }, { supabaseClient }))

  setSyncEventRepositoryForTest(null)
  assert.equal(lines.length, 1)
  assert.equal(persisted.length, 1)
  assert.equal(persisted[0].supabaseClient, supabaseClient)
  assert.equal(persisted[0].event.provider, 'ims')
  assert.equal(persisted[0].event.runId, 'run-db')
})

test('createSyncLogger default options can provide a DB client', () => {
  const persisted = []
  setSyncEventRepositoryForTest({
    persistSyncEventBestEffort(payload) {
      persisted.push(payload)
      return Promise.resolve({ ok: true })
    },
  })

  const supabaseClient = { marker: 'default-client' }
  const logger = createSyncLogger({ provider: 'zzimcar' }, { supabaseClient })
  captureConsole('warn', () => logger.warn({ eventType: 'sync_warning', message: 'warning' }))

  setSyncEventRepositoryForTest(null)
  assert.equal(persisted.length, 1)
  assert.equal(persisted[0].supabaseClient, supabaseClient)
  assert.equal(persisted[0].event.provider, 'zzimcar')
})

test('createSyncLogger writes one JSON line to severity console channel', () => {
  const logger = createSyncLogger({ provider: 'carmore', runId: 'run-2' })
  const { lines, result } = captureConsole('warn', () => logger.warn({
    eventType: 'sync_partial_success',
    message: 'partial success',
    metadata: { missingCount: 1 },
  }, { now: new Date('2026-06-28T06:00:00.000Z') }))

  assert.equal(lines.length, 1)
  const parsed = JSON.parse(lines[0])
  assert.deepEqual(parsed, result)
  assert.equal(parsed.provider, 'carmore')
  assert.equal(parsed.runId, 'run-2')
  assert.equal(parsed.severity, 'warn')
  assert.equal(parsed.eventType, 'sync_partial_success')
  assert.equal(parsed.ackStatus, 'not_required')
})

test('fetchRecentSyncEvents includes split unmanaged and manual recovery event types', async () => {
  let orFilter = ''
  const supabaseClient = {
    from() {
      return {
        select() { return this },
        order() { return this },
        limit() { return this },
        in() { return this },
        or(filter) {
          orFilter = filter
          return Promise.resolve({ data: [], error: null })
        },
      }
    },
  }

  await fetchRecentSyncEvents({ supabaseClient })

  assert.match(orFilter, /sync_unmanaged_wall_detected/)
  assert.match(orFilter, /sync_child_block_split_planned/)
  assert.match(orFilter, /sync_child_block_create_failed/)
  assert.match(orFilter, /sync_manual_recovery_required/)
})
