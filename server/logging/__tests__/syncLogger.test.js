'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildSyncEvent,
  createSyncLogger,
} = require('../syncLogger')

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
