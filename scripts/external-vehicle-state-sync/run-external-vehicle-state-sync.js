#!/usr/bin/env node
const { fetchAllVehicles } = require('../ims-sync/fetch-ims-vehicles');
const { fetchReservationSyncBatch } = require('../ims-sync/fetch-ims-reservations');
const { getSupabaseAdmin } = require('../ims-sync/lib/supabase-admin');
const { CarmoreClient } = require('../carmore-sync/lib/carmore-client');
const { ZzimcarClient } = require('../zzimcar-sync/lib/zzimcar-client');
const { buildImsVehicleStateDesired } = require('./lib/build-ims-vehicle-state');
const { planCarmoreVehicleState } = require('./lib/carmore-state-planner');
const { planZzimcarVehicleState } = require('./lib/zzimcar-state-planner');
const { requireNoWriteAllowed, upsertCarmoreVehicleStatePlans, upsertZzimcarVehicleStatePlans } = require('./lib/vehicle-state-repos');

function parseArgs(argv = process.argv.slice(2)) {
  return {
    noWriteSmoke: argv.includes('--no-write-smoke') || process.env.NO_WRITE_SMOKE === 'true',
    save: argv.includes('--save'),
    limit: Number(argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 0) || null,
  };
}

async function fetchLocalCars({ supabase }) {
  const rows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('cars')
      .select('id,source_car_id,car_number,ims_can_general_rental,ims_can_monthly_rental,ims_vehicle_synced_at')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function buildActualCarmoreMap({ client, desired }) {
  const actualByCarNumber = new Map();
  const errors = [];
  let session = null;
  for (const decision of desired) {
    try {
      const actual = await client.findVehicleStateByCarNumber({ carNumber: decision.carNumber });
      session = session || actual.session || client.session;
      actualByCarNumber.set(decision.carNumber, actual);
    } catch (error) {
      errors.push({ carNumber: decision.carNumber, error: error.message });
    }
  }
  return { actualByCarNumber, errors, session: session || client.session || {} };
}

async function buildActualZzimcarMap({ client, desired }) {
  const actualByCarNumber = new Map();
  const errors = [];
  for (const decision of desired) {
    try {
      const actual = await client.findVehicleByCarNumber({ carNumber: decision.carNumber });
      actualByCarNumber.set(decision.carNumber, actual);
    } catch (error) {
      errors.push({ carNumber: decision.carNumber, error: error.message });
    }
  }
  return { actualByCarNumber, errors };
}

async function runExternalVehicleStateSync(options = {}) {
  const noWriteSmoke = Boolean(options.noWriteSmoke);
  const save = Boolean(options.save);
  requireNoWriteAllowed({ save, noWriteSmoke });
  if (!noWriteSmoke) throw new Error('External vehicle state sync requires --no-write-smoke until save-run is separately approved');

  const supabase = options.supabase || getSupabaseAdmin();
  const [vehicleBatch, reservationBatch, localCars] = await Promise.all([
    options.vehicles ? Promise.resolve({ vehicles: options.vehicles }) : fetchAllVehicles(),
    options.schedules ? Promise.resolve({ schedules: options.schedules }) : fetchReservationSyncBatch({ rentalType: 'all', status: 'all' }),
    options.localCars ? Promise.resolve(options.localCars) : fetchLocalCars({ supabase }),
  ]);

  const desiredResult = buildImsVehicleStateDesired({
    vehicles: options.limit ? vehicleBatch.vehicles.slice(0, options.limit) : vehicleBatch.vehicles,
    schedules: reservationBatch.schedules,
    localCars,
  });

  const desired = desiredResult.decisions;
  const carmoreClient = options.carmoreClient || new CarmoreClient();
  const zzimcarClient = options.zzimcarClient || new ZzimcarClient();
  const carmoreActual = options.carmoreActualByCarNumber
    ? { actualByCarNumber: options.carmoreActualByCarNumber, errors: [], session: options.carmoreSession || {} }
    : await buildActualCarmoreMap({ client: carmoreClient, desired });
  const zzimcarActual = options.zzimcarActualByCarNumber
    ? { actualByCarNumber: options.zzimcarActualByCarNumber, errors: [] }
    : await buildActualZzimcarMap({ client: zzimcarClient, desired });

  const carmorePlan = planCarmoreVehicleState({ desired, actualByCarNumber: carmoreActual.actualByCarNumber, session: carmoreActual.session });
  const zzimcarPlan = planZzimcarVehicleState({ desired, actualByCarNumber: zzimcarActual.actualByCarNumber });
  carmorePlan.errors.push(...carmoreActual.errors);
  zzimcarPlan.errors.push(...zzimcarActual.errors);
  carmorePlan.counts.errors = carmorePlan.errors.length;
  zzimcarPlan.counts.errors = zzimcarPlan.errors.length;

  const carmoreRows = await upsertCarmoreVehicleStatePlans({ supabase, plans: carmorePlan.results, noWriteSmoke });
  const zzimcarRows = await upsertZzimcarVehicleStatePlans({ supabase, plans: zzimcarPlan.results, noWriteSmoke });

  return {
    mode: noWriteSmoke ? 'no-write-smoke' : 'save',
    desired: desiredResult,
    carmore: { ...carmorePlan, plannedRows: carmoreRows.rows },
    zzimcar: { ...zzimcarPlan, plannedRows: zzimcarRows.rows },
    wroteExternal: false,
    wroteDb: false,
  };
}

if (require.main === module) {
  runExternalVehicleStateSync(parseArgs())
    .then((result) => {
      console.log(JSON.stringify({
        mode: result.mode,
        desiredCounts: result.desired.counts,
        carmoreCounts: result.carmore.counts,
        zzimcarCounts: result.zzimcar.counts,
        wroteExternal: result.wroteExternal,
        wroteDb: result.wroteDb,
        carmoreErrors: result.carmore.errors.slice(0, 20),
        zzimcarErrors: result.zzimcar.errors.slice(0, 20),
      }, null, 2));
    })
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  buildActualCarmoreMap,
  buildActualZzimcarMap,
  fetchLocalCars,
  parseArgs,
  runExternalVehicleStateSync,
};
