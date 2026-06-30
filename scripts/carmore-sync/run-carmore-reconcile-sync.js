#!/usr/bin/env node
const path = require('path');
const { loadEnvFile } = require('../pricing/lib/loadEnvFile');
const { reconcileCarmoreHolidays } = require('./lib/reconcile-carmore-holidays');
const { createSyncLogger } = require('../../server/logging/syncLogger');
const { getSupabaseAdmin, hasSupabaseConfig } = require('./../ims-sync/lib/supabase-admin');

const projectRoot = path.resolve(__dirname, '../..');
loadEnvFile(path.join(projectRoot, '.env'));

const carmoreSyncLogger = createSyncLogger(
  { provider: 'carmore', stage: 'holiday_reconcile' },
  { supabaseClient: hasSupabaseConfig() ? getSupabaseAdmin() : null },
);

function logSyncEvent(event) {
  try {
    carmoreSyncLogger.event(event);
  } catch (error) {
    console.error('[carmore-reconcile-sync] sync logger failed');
    console.error(error?.stack || error?.message || String(error));
  }
}

function buildCompletionEvent({ runId, summary }) {
  const hasErrors = Number(summary?.errorsCount || 0) > 0;
  const hasAppliedWork = Number(summary?.additionsCount || 0) > 0
    || Number(summary?.deletionsCount || 0) > 0
    || Number(summary?.changesCount || 0) > 0;
  const action = hasErrors ? (hasAppliedWork ? 'sync_partial_success' : 'sync_failed') : 'sync_success';
  const severity = hasErrors ? (hasAppliedWork ? 'warn' : 'error') : 'info';
  return {
    runId,
    action,
    severity,
    eventType: action,
    message: hasErrors ? 'Carmore reconcile sync completed with errors' : 'Carmore reconcile sync completed',
    metadata: { summary },
    requiresAck: hasErrors,
    visibility: hasErrors ? 'admin' : 'ops',
    ackKey: hasErrors ? `carmore:${action}` : undefined,
    dedupeKey: hasErrors ? `carmore:${action}:${summary?.mode || 'unknown'}` : 'carmore:sync_success',
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i += 1; }
  }
  return args;
}

async function runCarmoreReconcileSync(options = {}) {
  const noWriteSmoke = options.noWriteSmoke === true || process.env.NO_WRITE_SMOKE === 'true' || process.env.CARMORE_NO_WRITE_SMOKE === 'true';
  const shouldSave = !noWriteSmoke && (options.shouldSave === true || process.env.CARMORE_SYNC_SAVE === 'true');
  const runId = noWriteSmoke ? `carmore-no-write-smoke-${new Date().toISOString()}` : `carmore-${new Date().toISOString()}`;
  if (!noWriteSmoke) logSyncEvent({
    runId,
    action: 'sync_start',
    severity: 'info',
    eventType: 'sync_start',
    message: 'Carmore reconcile sync started',
    metadata: {
      shouldSave,
      noWriteSmoke,
      limit: options.limit || process.env.CARMORE_SYNC_LIMIT || 0,
      onlyImsReservationId: options.onlyImsReservationId || process.env.CARMORE_SYNC_ONLY_IMS_RESERVATION_ID || '',
    },
    requiresAck: false,
    visibility: 'ops',
    dedupeKey: 'carmore:sync_start',
  });

  const summary = await reconcileCarmoreHolidays({
    shouldSave,
    noWriteSmoke,
    limit: options.limit || process.env.CARMORE_SYNC_LIMIT || 0,
    onlyImsReservationId: options.onlyImsReservationId || process.env.CARMORE_SYNC_ONLY_IMS_RESERVATION_ID || '',
    eventLogger: noWriteSmoke ? () => {} : logSyncEvent,
  });
  if (!noWriteSmoke) logSyncEvent(buildCompletionEvent({ runId, summary }));
  return summary;
}

async function main() {
  const args = parseArgs();
  const summary = await runCarmoreReconcileSync({
    shouldSave: args.save === true,
    noWriteSmoke: args.noWriteSmoke === true,
    limit: args.limit || 0,
    onlyImsReservationId: args.imsReservationId || args.onlyImsReservationId || '',
  });
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    logSyncEvent({
      action: 'sync_failed',
      severity: 'error',
      eventType: 'sync_failed',
      errorCode: error?.code || error?.name || 'CARMORE_SYNC_FAILED',
      message: error?.message || String(error),
      metadata: { stack: error?.stack },
      requiresAck: true,
      visibility: 'admin',
      ackKey: 'carmore:sync_failed',
      dedupeKey: `carmore:sync_failed:${error?.code || error?.name || 'unknown'}`,
    });
    console.error('[carmore-reconcile-sync] failed');
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  runCarmoreReconcileSync,
};
