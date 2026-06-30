#!/usr/bin/env node
const { fetchAllVehicles } = require('../ims-sync/fetch-ims-vehicles');
const { fetchReservationSyncBatch } = require('../ims-sync/fetch-ims-reservations');
const { getSupabaseAdmin } = require('../ims-sync/lib/supabase-admin');
const { createSyncLogger } = require('../../server/logging/syncLogger');
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
    persistLogs: argv.includes('--persist-logs') || process.env.EXTERNAL_VEHICLE_STATE_PERSIST_LOGS === 'true',
    reportJson: argv.includes('--report-json') || process.env.EXTERNAL_VEHICLE_STATE_REPORT_JSON === 'true',
    limit: Number(argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 0) || null,
  };
}

function createExternalVehicleStateLogger({ supabase, noWriteSmoke = false, persistLogs = false } = {}) {
  const shouldPersist = (!noWriteSmoke || persistLogs) && supabase;
  return createSyncLogger(
    { provider: 'system', stage: 'external_vehicle_state_sync' },
    { supabaseClient: shouldPersist ? supabase : null },
  );
}

function logSyncEvent(logger, event) {
  try {
    logger.event(event);
  } catch (error) {
    console.error('[external-vehicle-state-sync] sync logger failed');
    console.error(error?.stack || error?.message || String(error));
  }
}

function buildRunId({ noWriteSmoke }) {
  const prefix = noWriteSmoke ? 'external-vehicle-state-no-write-smoke' : 'external-vehicle-state';
  return `${prefix}-${new Date().toISOString()}`;
}

function buildReportRows({ desired = [], carmorePlan, zzimcarPlan } = {}) {
  const carmoreByCar = new Map((carmorePlan?.results || []).map((row) => [row.carNumber, row]));
  const zzimcarByCar = new Map((zzimcarPlan?.results || []).map((row) => [row.carNumber, row]));
  const carmoreErrorsByCar = new Map((carmorePlan?.errors || []).map((row) => [row.carNumber, row]));
  const zzimcarErrorsByCar = new Map((zzimcarPlan?.errors || []).map((row) => [row.carNumber, row]));

  return desired.map((decision) => {
    const carmore = carmoreByCar.get(decision.carNumber) || null;
    const zzimcar = zzimcarByCar.get(decision.carNumber) || null;
    const carmoreBeforeMatch = carmore
      ? carmore.observedAppFlag === carmore.decidedAppFlag && carmore.observedMonthFlag === carmore.decidedMonthFlag
      : false;
    const zzimcarBeforeMatch = zzimcar
      ? zzimcar.observedIsPublish === zzimcar.decidedIsPublish
      : false;
    const carmoreError = carmoreErrorsByCar.get(decision.carNumber) || null;
    const zzimcarError = zzimcarErrorsByCar.get(decision.carNumber) || null;
    return {
      carNumber: decision.carNumber,
      activeMonthly: decision.hasActiveMonthly,
      activeMonthlyReservationIds: decision.activeMonthlyReservations.map((item) => item.imsReservationId),
      imsGeneral: decision.imsFlags.canGeneralRental,
      imsMonthly: decision.imsFlags.canMonthlyRental,
      carmoreBefore: carmore ? `${carmore.observedAppFlag}/${carmore.observedMonthFlag}` : null,
      carmoreAfter: `${decision.carmore.appFlag}/${decision.carmore.monthFlag}`,
      carmoreAction: carmore?.action || (carmoreError ? 'error' : 'missing'),
      carmoreError: carmoreError?.error || null,
      zzimcarBefore: zzimcar ? String(zzimcar.observedIsPublish) : null,
      zzimcarAfter: String(decision.zzimcar.isPublish),
      zzimcarAction: zzimcar?.action || (zzimcarError ? 'error' : 'missing'),
      zzimcarError: zzimcarError?.error || null,
      allMatchBefore: carmoreBeforeMatch && zzimcarBeforeMatch,
      allMatchAfter: !carmoreError && !zzimcarError,
    };
  });
}

function summarizeReportRows(reportRows = []) {
  return {
    total: reportRows.length,
    beforeMismatch: reportRows.filter((row) => !row.allMatchBefore).length,
    afterMismatch: reportRows.filter((row) => !row.allMatchAfter).length,
    virtualPass: reportRows.every((row) => row.allMatchAfter),
    touchedVehicles: reportRows.filter((row) => row.carmoreAction === 'set_state' || row.zzimcarAction === 'set_state').length,
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
  const persistLogs = Boolean(options.persistLogs);
  const runId = options.runId || buildRunId({ noWriteSmoke });
  requireNoWriteAllowed({ save, noWriteSmoke });
  if (!noWriteSmoke) throw new Error('External vehicle state sync requires --no-write-smoke until save-run is separately approved');

  const supabase = options.supabase || getSupabaseAdmin();
  const logger = options.logger || createExternalVehicleStateLogger({ supabase, noWriteSmoke, persistLogs });
  logSyncEvent(logger, {
    runId,
    action: 'external_vehicle_state_sync_start',
    eventType: 'external_vehicle_state_sync_start',
    severity: 'info',
    message: 'External vehicle state sync started',
    metadata: { noWriteSmoke, save, persistLogs, limit: options.limit || null },
    visibility: 'ops',
    dedupeKey: 'external_vehicle_state_sync:start',
  });
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
  const reportRows = buildReportRows({ desired, carmorePlan, zzimcarPlan });
  const reportSummary = summarizeReportRows(reportRows);
  const completionAction = carmorePlan.counts.errors || zzimcarPlan.counts.errors
    ? 'external_vehicle_state_sync_partial_success'
    : 'external_vehicle_state_sync_success';

  logSyncEvent(logger, {
    runId,
    action: 'external_vehicle_state_sync_plan',
    eventType: 'external_vehicle_state_sync_plan',
    severity: reportSummary.virtualPass ? 'info' : 'warn',
    message: 'External vehicle state sync plan generated',
    metadata: {
      desiredCounts: desiredResult.counts,
      carmoreCounts: carmorePlan.counts,
      zzimcarCounts: zzimcarPlan.counts,
      reportSummary,
      wroteExternal: false,
      wroteDb: false,
    },
    requiresAck: !reportSummary.virtualPass,
    visibility: reportSummary.virtualPass ? 'ops' : 'admin',
    dedupeKey: `external_vehicle_state_sync:plan:${noWriteSmoke ? 'no_write' : 'save'}`,
  });
  logSyncEvent(logger, {
    runId,
    action: completionAction,
    eventType: completionAction,
    severity: completionAction === 'external_vehicle_state_sync_success' ? 'info' : 'warn',
    message: 'External vehicle state sync completed',
    metadata: { reportSummary, carmoreCounts: carmorePlan.counts, zzimcarCounts: zzimcarPlan.counts },
    requiresAck: completionAction !== 'external_vehicle_state_sync_success',
    visibility: completionAction === 'external_vehicle_state_sync_success' ? 'ops' : 'admin',
    dedupeKey: `external_vehicle_state_sync:${completionAction}`,
  });

  return {
    mode: noWriteSmoke ? 'no-write-smoke' : 'save',
    runId,
    desired: desiredResult,
    carmore: { ...carmorePlan, plannedRows: carmoreRows.rows },
    zzimcar: { ...zzimcarPlan, plannedRows: zzimcarRows.rows },
    reportSummary,
    reportRows,
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
        reportSummary: result.reportSummary,
        wroteExternal: result.wroteExternal,
        wroteDb: result.wroteDb,
        carmoreErrors: result.carmore.errors.slice(0, 20),
        zzimcarErrors: result.zzimcar.errors.slice(0, 20),
        ...(parseArgs().reportJson ? { reportRows: result.reportRows } : {}),
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
  buildReportRows,
  createExternalVehicleStateLogger,
  fetchLocalCars,
  parseArgs,
  runExternalVehicleStateSync,
  summarizeReportRows,
};
