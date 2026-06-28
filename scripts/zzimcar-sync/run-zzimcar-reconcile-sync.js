#!/usr/bin/env node
const path = require('path');
const { loadEnvFile } = require('../pricing/lib/loadEnvFile');
const { reconcileZzimcarDisableTimes } = require('./lib/reconcile-zzimcar-disable-times');
const { createSyncLogger } = require('../../server/logging/syncLogger');
const projectRoot = path.resolve(__dirname, '../..');
loadEnvFile(path.join(projectRoot, '.env'));

const zzimcarSyncLogger = createSyncLogger({ provider: 'zzimcar', stage: 'disable_time_reconcile' });

function logSyncEvent(event) {
  try {
    zzimcarSyncLogger.event(event);
  } catch (error) {
    console.error('[zzimcar-reconcile-sync] sync logger failed');
    console.error(error?.stack || error?.message || String(error));
  }
}

function buildCompletionEvent({ runId, summary }) {
  const hasErrors = Number(summary?.errorsCount || 0) > 0;
  const hasAppliedWork = Number(summary?.additionsCount || 0) > 0
    || Number(summary?.deletionsCount || 0) > 0
    || Number(summary?.changesCount || 0) > 0
    || Number(summary?.recoveriesCount || 0) > 0;
  const action = hasErrors ? (hasAppliedWork ? 'sync_partial_success' : 'sync_failed') : 'sync_success';
  const severity = hasErrors ? (hasAppliedWork ? 'warn' : 'error') : 'info';
  return {
    runId,
    action,
    severity,
    eventType: action,
    message: hasErrors ? 'Zzimcar reconcile sync completed with errors' : 'Zzimcar reconcile sync completed',
    metadata: { summary },
    requiresAck: hasErrors,
    visibility: hasErrors ? 'admin' : 'ops',
    ackKey: hasErrors ? `zzimcar:${action}` : undefined,
    dedupeKey: hasErrors ? `zzimcar:${action}:${summary?.mode || 'unknown'}` : 'zzimcar:sync_success',
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

async function runZzimcarReconcileSync(options = {}) {
  const shouldSave = options.shouldSave === true || process.env.ZZIMCAR_SYNC_SAVE === 'true';
  const runId = `zzimcar-${new Date().toISOString()}`;
  logSyncEvent({
    runId,
    action: 'sync_start',
    severity: 'info',
    eventType: 'sync_start',
    message: 'Zzimcar reconcile sync started',
    metadata: { shouldSave },
    requiresAck: false,
    visibility: 'ops',
    dedupeKey: 'zzimcar:sync_start',
  });

  const summary = await reconcileZzimcarDisableTimes({ shouldSave });
  logSyncEvent(buildCompletionEvent({ runId, summary }));
  return summary;
}

async function main() {
  const args = parseArgs();
  const summary = await runZzimcarReconcileSync({ shouldSave: args.save === true });
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    logSyncEvent({
      action: 'sync_failed',
      severity: 'error',
      eventType: 'sync_failed',
      errorCode: error?.code || error?.name || 'ZZIMCAR_SYNC_FAILED',
      message: error?.message || String(error),
      metadata: { stack: error?.stack },
      requiresAck: true,
      visibility: 'admin',
      ackKey: 'zzimcar:sync_failed',
      dedupeKey: `zzimcar:sync_failed:${error?.code || error?.name || 'unknown'}`,
    });
    console.error('[zzimcar-reconcile-sync] failed');
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  runZzimcarReconcileSync,
};
