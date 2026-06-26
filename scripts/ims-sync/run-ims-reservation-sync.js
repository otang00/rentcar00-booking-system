#!/usr/bin/env node
const { loginToIms } = require('./lib/ims-auth');
const { fetchReservationSyncBatch } = require('./fetch-ims-reservations');
const { fetchAllVehicles } = require('./fetch-ims-vehicles');
const { syncReservationsToSupabase } = require('./upsert-ims-reservations');
const { syncVehiclesToSupabase } = require('./upsert-ims-vehicles');

async function main() {
  const dryRun = process.env.IMS_SYNC_DRY_RUN === 'true';
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
}

main().catch((error) => {
  console.error('[ims-sync] failed');
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
