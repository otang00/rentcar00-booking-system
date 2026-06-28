const { formatKstDateTime, ZzimcarClient } = require('./zzimcar-client');
const { fetchDesiredImsReservations } = require('./fetch-desired-ims-reservations');
const { fetchActiveMappings, upsertMapping, markMappingDeleted, markMappingFailed } = require('./zzimcar-sync-mapping-repo');
const { createRun, finishRun } = require('./zzimcar-sync-run-repo');
const { createSyncLogger } = require('../../../server/logging/syncLogger');

const zzimcarReconcileLogger = createSyncLogger({ provider: 'zzimcar', stage: 'disable_time_reconcile' });

function logReconcileEvent(event) {
  try {
    zzimcarReconcileLogger.event(event);
  } catch (error) {
    console.error('[zzimcar-reconcile-sync] sync logger failed');
    console.error(error?.stack || error?.message || String(error));
  }
}

function logReconcileError({ runId, action, desired, actual, error }) {
  const imsReservationId = desired?.imsReservationId || actual?.imsReservationId;
  logReconcileEvent({
    runId,
    action: `reconcile_${action}_failed`,
    severity: 'warn',
    eventType: 'sync_warning',
    imsReservationId,
    carNumber: desired?.carNumber || actual?.carNumber,
    errorCode: error?.code || error?.name || 'ZZIMCAR_RECONCILE_ACTION_FAILED',
    message: error?.message || String(error),
    metadata: { action },
    requiresAck: true,
    visibility: 'admin',
    ackKey: `zzimcar:${action}:${imsReservationId || 'unknown'}`,
    dedupeKey: `zzimcar:${action}:failed:${imsReservationId || 'unknown'}`,
  });
}

function buildMapByImsReservationId(rows = []) {
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [String(row.imsReservationId), row]));
}

function hasChanged(desired, actual) {
  if (!desired || !actual) return false;
  return String(desired.carNumber) !== String(actual.carNumber)
    || String(desired.startAt) !== String(actual.startAt)
    || String(desired.endAt) !== String(actual.endAt)
    || !actual.zzimcarVehiclePid
    || !actual.zzimcarDisableTimePid
    || (desired.zzimcarVehiclePid != null && String(desired.zzimcarVehiclePid) !== String(actual.zzimcarVehiclePid));
}

function planReconcile({ desiredRows = [], actualRows = [] } = {}) {
  const desiredMap = buildMapByImsReservationId(desiredRows);
  const actualMap = buildMapByImsReservationId(actualRows);

  const additions = [];
  const changes = [];
  const deletions = [];
  const unchanged = [];

  for (const desired of desiredRows) {
    const actual = actualMap.get(String(desired.imsReservationId));
    if (!actual) {
      additions.push({ desired });
      continue;
    }
    if (hasChanged(desired, actual)) {
      changes.push({ desired, actual });
      continue;
    }
    unchanged.push({ desired, actual });
  }

  for (const actual of actualRows) {
    if (!desiredMap.has(String(actual.imsReservationId))) {
      deletions.push({ actual });
    }
  }

  return { additions, changes, deletions, unchanged };
}

function findExactDisableTime({ rows = [], payload }) {
  return (Array.isArray(rows) ? rows : []).find((row) => row.startDtime === payload.startDtime && row.endDtime === payload.endDtime) || null;
}

function isDuplicateDisableTimeError(error) {
  const message = String(error?.message || '');
  return message.includes('VEHICLE_SCHEDULE_DUPLICATION_ERROR') || message.includes('차량 스케줄이 중복되었습니다');
}

function buildDisableTimePayloadFromDesired({ desired, vehiclePid }) {
  return {
    vehiclePid,
    startDtime: formatKstDateTime(desired.startAt),
    endDtime: formatKstDateTime(desired.endAt),
  };
}

async function createOrRecoverDisableTime({ desired, vehiclePid, client }) {
  const payload = buildDisableTimePayloadFromDesired({ desired, vehiclePid });
  let createResult = null;
  let disableTimePid = null;

  try {
    createResult = await client.createDisableTime(payload);
    disableTimePid = createResult?.disableTimePid || null;
  } catch (error) {
    if (!isDuplicateDisableTimeError(error)) {
      throw error;
    }

    const disableTimes = await client.getDisableTimes({ vehiclePid });
    const exact = findExactDisableTime({ rows: disableTimes, payload });
    disableTimePid = exact?.pid || null;
    createResult = {
      payload,
      body: null,
      disableTimePid,
      duplicateRecovered: Boolean(disableTimePid),
      error: error.message,
    };

    if (!disableTimePid) {
      throw error;
    }
  }

  if (!disableTimePid) {
    const disableTimes = await client.getDisableTimes({ vehiclePid });
    const exact = findExactDisableTime({ rows: disableTimes, payload });
    disableTimePid = exact?.pid || null;
  }

  if (!disableTimePid) {
    throw new Error(`Disable time pid not found after create for imsReservationId=${desired.imsReservationId}`);
  }

  return { payload, createResult, disableTimePid };
}

async function applyAddition({ desired, client, shouldSave }) {
  const vehicle = await client.findVehicleByCarNumber({ carNumber: desired.carNumber });
  const payload = buildDisableTimePayloadFromDesired({ desired, vehiclePid: vehicle.vehiclePid });

  let createResult = null;
  let disableTimePid = null;
  if (shouldSave) {
    const created = await createOrRecoverDisableTime({ desired, vehiclePid: vehicle.vehiclePid, client });
    createResult = created.createResult;
    disableTimePid = created.disableTimePid;
  }

  return {
    imsReservationId: desired.imsReservationId,
    action: 'add',
    desired,
    vehiclePid: vehicle.vehiclePid,
    payload,
    applied: shouldSave,
    disableTimePid,
    createResult,
  };
}

function findSharedActiveDisableTimeMappings({ actual, actualRows = [] } = {}) {
  if (!actual?.zzimcarDisableTimePid) return [];
  return (Array.isArray(actualRows) ? actualRows : []).filter((row) => (
    row
    && String(row.imsReservationId) !== String(actual.imsReservationId)
    && String(row.syncStatus || 'active') === 'active'
    && row.zzimcarDisableTimePid != null
    && String(row.zzimcarDisableTimePid) === String(actual.zzimcarDisableTimePid)
  ));
}

async function applyDeletion({ actual, actualRows = [], client, shouldSave }) {
  const sharedActiveMappings = findSharedActiveDisableTimeMappings({ actual, actualRows });
  let deleteResult = null;
  let skippedZzimcarDelete = false;
  if (shouldSave) {
    if (!actual.zzimcarDisableTimePid) {
      throw new Error(`Missing zzimcarDisableTimePid for imsReservationId=${actual.imsReservationId}`);
    }
    if (sharedActiveMappings.length > 0) {
      skippedZzimcarDelete = true;
    } else {
      deleteResult = await client.deleteDisableTime({ pid: actual.zzimcarDisableTimePid });
    }
  }

  return {
    imsReservationId: actual.imsReservationId,
    action: 'delete',
    actual,
    applied: shouldSave,
    skippedZzimcarDelete,
    sharedActiveMappings,
    deleteResult,
  };
}

async function applyChange({ desired, actual, client, shouldSave }) {
  const deletion = await applyDeletion({ actual, client, shouldSave });
  const addition = await applyAddition({ desired, client, shouldSave });
  return {
    imsReservationId: desired.imsReservationId,
    action: 'change',
    desired,
    actual,
    applied: shouldSave,
    deletion,
    addition,
  };
}

function findDisableTimeForMapping({ actual, disableTimes = [] } = {}) {
  if (!actual) return null;
  const payload = actual.zzimcarVehiclePid
    ? {
      startDtime: formatKstDateTime(actual.startAt),
      endDtime: formatKstDateTime(actual.endAt),
    }
    : null;

  return (Array.isArray(disableTimes) ? disableTimes : []).find((row) => (
    (actual.zzimcarDisableTimePid && String(row.pid) === String(actual.zzimcarDisableTimePid))
    || (payload && row.startDtime === payload.startDtime && row.endDtime === payload.endDtime)
  )) || null;
}

async function applyMissingDisableTimeRecovery({ desired, actual, client, shouldSave }) {
  const vehiclePid = actual.zzimcarVehiclePid;
  if (!vehiclePid) {
    throw new Error(`Missing zzimcarVehiclePid for imsReservationId=${actual.imsReservationId}`);
  }

  const payload = buildDisableTimePayloadFromDesired({ desired, vehiclePid });
  let existing = null;
  if (shouldSave) {
    const disableTimes = await client.getDisableTimes({ vehiclePid });
    existing = findDisableTimeForMapping({ actual, disableTimes });
  }

  let createResult = null;
  let disableTimePid = existing?.pid || null;
  if (shouldSave && !disableTimePid) {
    const created = await createOrRecoverDisableTime({ desired, vehiclePid, client });
    createResult = created.createResult;
    disableTimePid = created.disableTimePid;
  }

  return {
    imsReservationId: desired.imsReservationId,
    action: 'recover_missing_disable_time',
    desired,
    actual,
    vehiclePid,
    payload,
    applied: shouldSave,
    existingDisableTime: existing,
    recovered: shouldSave && !existing,
    disableTimePid,
    createResult,
  };
}

async function recoverMissingDisableTimes({ unchanged = [], client, shouldSave } = {}) {
  const recoveries = [];
  const stillUnchanged = [];

  for (const entry of Array.isArray(unchanged) ? unchanged : []) {
    if (!shouldSave) {
      stillUnchanged.push(entry);
      continue;
    }

    const result = await applyMissingDisableTimeRecovery({ ...entry, client, shouldSave });
    if (result.recovered) {
      recoveries.push(result);
    } else {
      stillUnchanged.push(entry);
    }
  }

  return { recoveries, unchanged: stillUnchanged };
}

async function reconcileZzimcarDisableTimes({
  shouldSave = false,
  now = new Date(),
  supabaseClient,
  client,
} = {}) {
  const supabase = supabaseClient;
  const syncMode = shouldSave ? 'save' : 'dry-run';
  const run = await createRun({ syncMode, supabaseClient: supabase });

  try {
    const zzimcarClient = client || new ZzimcarClient();
    const desiredRows = await fetchDesiredImsReservations({ now, supabaseClient: supabase });
    const actualRows = await fetchActiveMappings({
      supabaseClient: supabase,
      allowMissingTable: !shouldSave,
    });
    const plan = planReconcile({ desiredRows, actualRows });

    const results = { additions: [], deletions: [], changes: [], recoveries: [], unchanged: plan.unchanged, errors: [] };
    const requiresZzimcarAccess = shouldSave && (plan.additions.length > 0 || plan.deletions.length > 0 || plan.changes.length > 0 || plan.unchanged.length > 0);

    if (!shouldSave) {
      const summary = {
        mode: 'dry-run',
        desiredCount: desiredRows.length,
        actualCount: actualRows.length,
        additionsCount: plan.additions.length,
        deletionsCount: plan.deletions.length,
        changesCount: plan.changes.length,
        recoveriesCount: 0,
        unchangedCount: plan.unchanged.length,
        errorsCount: 0,
        results: {
          additions: plan.additions.map(({ desired }) => ({ action: 'add', imsReservationId: desired.imsReservationId, desired, applied: false })),
          deletions: plan.deletions.map(({ actual }) => ({ action: 'delete', imsReservationId: actual.imsReservationId, actual, applied: false })),
          changes: plan.changes.map(({ desired, actual }) => ({ action: 'change', imsReservationId: desired.imsReservationId, desired, actual, applied: false })),
          recoveries: [],
          unchanged: plan.unchanged,
          errors: [],
        },
      };
      await finishRun({ runId: run.id, status: 'success', summary, supabaseClient: supabase });
      return summary;
    }

    if (requiresZzimcarAccess) {
      try {
        await zzimcarClient.ensureLoggedIn();
      } catch (error) {
        const summary = {
          mode: 'save',
          desiredCount: desiredRows.length,
          actualCount: actualRows.length,
          additionsCount: plan.additions.length,
          deletionsCount: plan.deletions.length,
          changesCount: plan.changes.length,
          recoveriesCount: 0,
          unchangedCount: plan.unchanged.length,
          errorsCount: 1,
          results: {
            additions: [],
            deletions: [],
            changes: [],
            recoveries: [],
            unchanged: plan.unchanged,
            errors: [{ action: 'auth', error: error.message }],
          },
        };
        await finishRun({ runId: run.id, status: 'failed', summary, errorSummary: error.message, supabaseClient: supabase });
        return summary;
      }
    }

    for (const entry of plan.additions) {
    try {
      const result = await applyAddition({ ...entry, client: zzimcarClient, shouldSave });
      results.additions.push(result);
      if (shouldSave) {
        await upsertMapping({
          mapping: {
            imsReservationId: result.imsReservationId,
            carNumber: result.desired.carNumber,
            zzimcarVehiclePid: result.vehiclePid,
            zzimcarDisableTimePid: result.disableTimePid,
            startAt: result.desired.startAt,
            endAt: result.desired.endAt,
            syncStatus: 'active',
          },
          supabaseClient: supabase,
        });
      }
    } catch (error) {
      const failure = {
        action: 'add',
        imsReservationId: entry.desired.imsReservationId,
        error: error.message,
      };
      results.errors.push(failure);
      logReconcileError({ runId: run.id, action: 'add', desired: entry.desired, error });
      if (shouldSave) {
        await markMappingFailed({
          imsReservationId: entry.desired.imsReservationId,
          carNumber: entry.desired.carNumber,
          startAt: entry.desired.startAt,
          endAt: entry.desired.endAt,
          lastError: error.message,
          syncStatus: 'sync_failed',
          supabaseClient: supabase,
        });
      }
    }
  }

  for (const entry of plan.deletions) {
    try {
      const result = await applyDeletion({ ...entry, actualRows, client: zzimcarClient, shouldSave });
      results.deletions.push(result);
      if (shouldSave) {
        await markMappingDeleted({ imsReservationId: result.imsReservationId, supabaseClient: supabase });
      }
    } catch (error) {
      const failure = {
        action: 'delete',
        imsReservationId: entry.actual.imsReservationId,
        error: error.message,
      };
      results.errors.push(failure);
      logReconcileError({ runId: run.id, action: 'delete', actual: entry.actual, error });
      if (shouldSave) {
        await markMappingFailed({
          imsReservationId: entry.actual.imsReservationId,
          carNumber: entry.actual.carNumber,
          zzimcarVehiclePid: entry.actual.zzimcarVehiclePid,
          zzimcarDisableTimePid: entry.actual.zzimcarDisableTimePid,
          startAt: entry.actual.startAt,
          endAt: entry.actual.endAt,
          lastError: error.message,
          syncStatus: 'delete_failed',
          supabaseClient: supabase,
        });
      }
    }
  }

  for (const entry of plan.changes) {
    try {
      const result = await applyChange({ ...entry, client: zzimcarClient, shouldSave });
      results.changes.push(result);
      if (shouldSave) {
        await upsertMapping({
          mapping: {
            imsReservationId: result.imsReservationId,
            carNumber: result.desired.carNumber,
            zzimcarVehiclePid: result.addition.vehiclePid,
            zzimcarDisableTimePid: result.addition.disableTimePid,
            startAt: result.desired.startAt,
            endAt: result.desired.endAt,
            syncStatus: 'active',
          },
          supabaseClient: supabase,
        });
      }
    } catch (error) {
      const failure = {
        action: 'change',
        imsReservationId: entry.desired.imsReservationId,
        error: error.message,
      };
      results.errors.push(failure);
      logReconcileError({ runId: run.id, action: 'change', desired: entry.desired, actual: entry.actual, error });
      if (shouldSave) {
        await markMappingFailed({
          imsReservationId: entry.desired.imsReservationId,
          carNumber: entry.desired.carNumber,
          zzimcarVehiclePid: entry.actual.zzimcarVehiclePid,
          zzimcarDisableTimePid: entry.actual.zzimcarDisableTimePid,
          startAt: entry.desired.startAt,
          endAt: entry.desired.endAt,
          lastError: error.message,
          syncStatus: 'sync_failed',
          supabaseClient: supabase,
        });
      }
    }
  }

  const verifiedUnchanged = [];
  for (const entry of results.unchanged) {
    try {
      const result = await applyMissingDisableTimeRecovery({ ...entry, client: zzimcarClient, shouldSave });
      if (result.recovered) {
        results.recoveries.push(result);
        logReconcileEvent({
          runId: run.id,
          action: 'recover_missing_disable_time',
          severity: 'info',
          eventType: 'sync_recovery',
          imsReservationId: result.imsReservationId,
          carNumber: result.desired?.carNumber,
          message: 'Zzimcar missing disable time recovered',
          metadata: { disableTimePid: result.disableTimePid, vehiclePid: result.vehiclePid },
          requiresAck: false,
          visibility: 'ops',
          dedupeKey: `zzimcar:recover_missing_disable_time:${result.imsReservationId}`,
        });
        if (shouldSave) {
          await upsertMapping({
            mapping: {
              imsReservationId: result.imsReservationId,
              carNumber: result.desired.carNumber,
              zzimcarVehiclePid: result.vehiclePid,
              zzimcarDisableTimePid: result.disableTimePid,
              startAt: result.desired.startAt,
              endAt: result.desired.endAt,
              syncStatus: 'active',
            },
            supabaseClient: supabase,
          });
        }
      } else {
        verifiedUnchanged.push(entry);
      }
    } catch (error) {
      verifiedUnchanged.push(entry);
      results.errors.push({
        action: 'recover_missing_disable_time',
        imsReservationId: entry.desired.imsReservationId,
        error: error.message,
      });
      logReconcileError({ runId: run.id, action: 'recover_missing_disable_time', desired: entry.desired, actual: entry.actual, error });
    }
  }
  results.unchanged = verifiedUnchanged;

    const summary = {
      mode: shouldSave ? 'save' : 'dry-run',
      desiredCount: desiredRows.length,
      actualCount: actualRows.length,
      additionsCount: results.additions.length,
      deletionsCount: results.deletions.length,
      changesCount: results.changes.length,
      recoveriesCount: results.recoveries.length,
      unchangedCount: results.unchanged.length,
      errorsCount: results.errors.length,
      results,
    };
    const finalStatus = results.errors.length > 0 ? (results.additions.length > 0 || results.deletions.length > 0 || results.changes.length > 0 || results.recoveries.length > 0 ? 'partial_success' : 'failed') : 'success';
    await finishRun({ runId: run.id, status: finalStatus, summary, supabaseClient: supabase });
    return summary;
  } catch (error) {
    await finishRun({
      runId: run.id,
      status: 'failed',
      summary: {
        desiredCount: 0,
        actualCount: 0,
        additionsCount: 0,
        deletionsCount: 0,
        changesCount: 0,
        recoveriesCount: 0,
        unchangedCount: 0,
        errorsCount: 1,
        results: { errors: [{ error: error.message }] },
      },
      errorSummary: error.message,
      supabaseClient: supabase,
    });
    throw error;
  }
}

module.exports = {
  applyAddition,
  applyChange,
  applyMissingDisableTimeRecovery,
  buildDisableTimePayloadFromDesired,
  applyDeletion,
  buildMapByImsReservationId,
  findSharedActiveDisableTimeMappings,
  findDisableTimeForMapping,
  findExactDisableTime,
  hasChanged,
  isDuplicateDisableTimeError,
  planReconcile,
  recoverMissingDisableTimes,
  reconcileZzimcarDisableTimes,
};
