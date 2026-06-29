#!/usr/bin/env node
const { loginToIms } = require('./lib/ims-auth');
const { fetchReservationSyncBatch } = require('./fetch-ims-reservations');
const { fetchAllVehicles } = require('./fetch-ims-vehicles');
const { syncReservationsToSupabase } = require('./upsert-ims-reservations');
const { syncVehiclesToSupabase } = require('./upsert-ims-vehicles');
const { createSyncLogger } = require('../../server/logging/syncLogger');
const { getSupabaseAdmin, hasSupabaseConfig } = require('./lib/supabase-admin');

const imsSyncLogger = createSyncLogger(
  { provider: 'ims', stage: 'reservation_vehicle_sync' },
  { supabaseClient: hasSupabaseConfig() ? getSupabaseAdmin() : null },
);

function logSyncEvent(event) {
  try {
    imsSyncLogger.event(event);
  } catch (error) {
    console.error('[ims-sync] sync logger failed');
    console.error(error?.stack || error?.message || String(error));
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  return new Set(argv.filter((token) => token.startsWith('--')).map((token) => token.slice(2)));
}

async function main() {
  const flags = parseArgs();
  const noWriteSmoke = flags.has('no-write-smoke') || process.env.NO_WRITE_SMOKE === 'true' || process.env.IMS_NO_WRITE_SMOKE === 'true';
  const dryRun = noWriteSmoke || process.env.IMS_SYNC_DRY_RUN === 'true';
  const runId = noWriteSmoke ? `ims-no-write-smoke-${new Date().toISOString()}` : `ims-${new Date().toISOString()}`;
  if (!noWriteSmoke) logSyncEvent({
    runId,
    action: 'sync_start',
    severity: 'info',
    eventType: 'sync_start',
    message: 'IMS reservation/vehicle sync started',
    metadata: { dryRun, noWriteSmoke },
    requiresAck: false,
    visibility: 'ops',
    dedupeKey: 'ims:sync_start',
  });
  const auth = await loginToIms();
  const reservationResult = await fetchReservationSyncBatch({ authorization: auth.authorization });
  const reservationSync = await syncReservationsToSupabase({
    schedules: reservationResult.schedules,
    dryRun,
  });
  const vehicleResult = await fetchAllVehicles({ authorization: auth.authorization });
  const vehicleSync = await syncVehiclesToSupabase({
    vehicles: vehicleResult.vehicles,
    dryRun,
  });

  const summary = {
    enabled: auth.enabled,
    reservations: {
      totalPagesFetched: reservationResult.totalPagesFetched,
      schedulesCount: reservationResult.schedules.length,
      dedupedCount: reservationResult.dedupedCount,
      firstReservationId: reservationResult.schedules?.[0]?.detail?.id || null,
      firstScheduleId: reservationResult.schedules?.[0]?.id || null,
      firstRentalType: reservationResult.schedules?.[0]?.detail?.rental_type || null,
      scopes: reservationResult.scopeResults,
      sync: reservationSync,
    },
    vehicles: {
      totalPagesFetched: vehicleResult.totalPagesFetched,
      vehiclesCount: vehicleResult.vehicles.length,
      firstVehicleId: vehicleResult.vehicles?.[0]?.id || null,
      query: vehicleResult.pages?.[0]?.query || null,
      sync: vehicleSync,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!noWriteSmoke) logSyncEvent({
    runId,
    action: 'sync_success',
    severity: 'info',
    eventType: 'sync_success',
    message: 'IMS reservation/vehicle sync completed',
    metadata: {
      dryRun,
      noWriteSmoke,
      reservations: summary.reservations,
      vehicles: summary.vehicles,
    },
    requiresAck: false,
    visibility: 'ops',
    dedupeKey: 'ims:sync_success',
  });
}

main().catch((error) => {
  if (!(process.env.NO_WRITE_SMOKE === 'true' || process.env.IMS_NO_WRITE_SMOKE === 'true' || process.argv.includes('--no-write-smoke'))) logSyncEvent({
    action: 'sync_failed',
    severity: 'error',
    eventType: 'sync_failed',
    errorCode: error?.code || error?.name || 'IMS_SYNC_FAILED',
    message: error?.message || String(error),
    metadata: { stack: error?.stack },
    requiresAck: true,
    visibility: 'admin',
    ackKey: 'ims:sync_failed',
    dedupeKey: `ims:sync_failed:${error?.code || error?.name || 'unknown'}`,
  });
  console.error('[ims-sync] failed');
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
