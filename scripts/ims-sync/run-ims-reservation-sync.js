#!/usr/bin/env node
const { loginToIms } = require('./lib/ims-auth');
const { fetchReservationSyncBatch } = require('./fetch-ims-reservations');
const { fetchAllVehicles } = require('./fetch-ims-vehicles');
const { syncReservationsToSupabase } = require('./upsert-ims-reservations');
const { syncVehiclesToSupabase } = require('./upsert-ims-vehicles');
const { createSyncLogger } = require('../../server/logging/syncLogger');

const imsSyncLogger = createSyncLogger({ provider: 'ims', stage: 'reservation_vehicle_sync' });

function logSyncEvent(event) {
  try {
    imsSyncLogger.event(event);
  } catch (error) {
    console.error('[ims-sync] sync logger failed');
    console.error(error?.stack || error?.message || String(error));
  }
}

async function main() {
  const dryRun = process.env.IMS_SYNC_DRY_RUN === 'true';
  const runId = `ims-${new Date().toISOString()}`;
  logSyncEvent({
    runId,
    action: 'sync_start',
    severity: 'info',
    eventType: 'sync_start',
    message: 'IMS reservation/vehicle sync started',
    metadata: { dryRun },
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

  logSyncEvent({
    runId,
    action: 'sync_success',
    severity: 'info',
    eventType: 'sync_success',
    message: 'IMS reservation/vehicle sync completed',
    metadata: {
      dryRun,
      reservations: summary.reservations,
      vehicles: summary.vehicles,
    },
    requiresAck: false,
    visibility: 'ops',
    dedupeKey: 'ims:sync_success',
  });
}

main().catch((error) => {
  logSyncEvent({
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
