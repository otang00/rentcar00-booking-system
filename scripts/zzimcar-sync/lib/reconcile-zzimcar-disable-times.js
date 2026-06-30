const { formatKstDateTime, ZzimcarClient } = require('./zzimcar-client');
const { fetchDesiredImsReservations } = require('./fetch-desired-ims-reservations');
const { fetchActiveMappings, upsertMapping, markMappingDeleted, markMappingFailed } = require('./zzimcar-sync-mapping-repo');
const { createRun, finishRun } = require('./zzimcar-sync-run-repo');
const { createSyncLogger } = require('../../../server/logging/syncLogger');
const { getSupabaseAdmin, hasSupabaseConfig } = require('../../ims-sync/lib/supabase-admin');

const zzimcarReconcileLogger = createSyncLogger(
  { provider: 'zzimcar', stage: 'disable_time_reconcile' },
  { supabaseClient: hasSupabaseConfig() ? getSupabaseAdmin() : null },
);

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

function getDesiredMappingIds(desired) {
  const ids = Array.isArray(desired?.sourceImsReservationIds) && desired.sourceImsReservationIds.length > 0
    ? desired.sourceImsReservationIds
    : [desired?.imsReservationId];
  return [...new Set(ids.filter((id) => id != null).map(String))].sort();
}

function getDesiredPlanKey(desired = {}) {
  return String(desired.childBlockKey || `${getDesiredMappingIds(desired).join(',')}:${desired.startAt || ''}:${desired.endAt || ''}`);
}

function buildMapByImsReservationId(rows = []) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const imsReservationId of getDesiredMappingIds(row)) {
      map.set(`${String(imsReservationId)}:${getDesiredPlanKey(row)}`, row);
    }
  }
  return map;
}

function isSameInstant(left, right) {
  const leftMs = new Date(left).getTime();
  const rightMs = new Date(right).getTime();
  return Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs === rightMs;
}

function hasChanged(desired, actual) {
  if (!desired || !actual) return false;
  return String(desired.carNumber) !== String(actual.carNumber)
    || !isSameInstant(desired.startAt, actual.startAt)
    || !isSameInstant(desired.endAt, actual.endAt)
    || !actual.zzimcarVehiclePid
    || !actual.zzimcarDisableTimePid
    || (desired.zzimcarVehiclePid != null && String(desired.zzimcarVehiclePid) !== String(actual.zzimcarVehiclePid));
}

function getVehicleMatchKey(row = {}) {
  if (row.zzimcarVehiclePid != null) return `pid:${String(row.zzimcarVehiclePid)}`;
  return `car:${String(row.carNumber || '')}`;
}

function isSameVehicleScope(desired, actual) {
  if (!desired || !actual) return false;
  if (desired.zzimcarVehiclePid != null && actual.zzimcarVehiclePid != null) {
    return String(desired.zzimcarVehiclePid) === String(actual.zzimcarVehiclePid);
  }
  return String(desired.carNumber || '') === String(actual.carNumber || '');
}

function isExactIntervalMatch(desired, actual) {
  return isSameVehicleScope(desired, actual)
    && isSameInstant(desired.startAt, actual.startAt)
    && isSameInstant(desired.endAt, actual.endAt)
    && Boolean(actual.zzimcarDisableTimePid);
}

function intervalsOverlap(left, right) {
  if (!left?.startAt || !left?.endAt || !right?.startAt || !right?.endAt) return false;
  const leftStart = new Date(left.startAt).getTime();
  const leftEnd = new Date(left.endAt).getTime();
  const rightStart = new Date(right.startAt).getTime();
  const rightEnd = new Date(right.endAt).getTime();
  if (![leftStart, leftEnd, rightStart, rightEnd].every(Number.isFinite)) return false;
  return leftStart < rightEnd && rightStart < leftEnd;
}

function isReplacementCandidate(desired, actual) {
  return isSameVehicleScope(desired, actual)
    && intervalsOverlap(desired, actual)
    && !isExactIntervalMatch(desired, actual);
}


function toTime(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function applyBoundaryGapToRange(range, gapMs = 60 * 60 * 1000) {
  const start = toTime(range.startAt);
  const end = toTime(range.endAt);
  if (start == null || end == null || start >= end) return null;
  const adjustedEnd = range.boundaryGapAfter ? end - gapMs : end;
  if (adjustedEnd <= start) return null;
  return { ...range, endAt: new Date(adjustedEnd).toISOString(), boundaryGapHours: range.boundaryGapAfter ? gapMs / (60 * 60 * 1000) : 0 };
}

function subtractUnmanagedWallsFromDesired(desired, unmanagedWalls = [], { boundaryGapHours = 1 } = {}) {
  const desiredStart = toTime(desired.startAt);
  const desiredEnd = toTime(desired.endAt);
  if (desiredStart == null || desiredEnd == null || desiredStart >= desiredEnd) return [];

  let ranges = [{ startAt: desired.startAt, endAt: desired.endAt, boundaryGapAfter: false }];
  const walls = (Array.isArray(unmanagedWalls) ? unmanagedWalls : [])
    .filter((wall) => isSameVehicleScope(desired, wall) && intervalsOverlap(desired, wall))
    .map((wall) => ({ ...wall, start: toTime(wall.startAt), end: toTime(wall.endAt) }))
    .filter((wall) => wall.start != null && wall.end != null && wall.start < wall.end)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  for (const wall of walls) {
    const next = [];
    for (const range of ranges) {
      const rangeStart = toTime(range.startAt);
      const rangeEnd = toTime(range.endAt);
      if (wall.end <= rangeStart || wall.start >= rangeEnd) {
        next.push(range);
        continue;
      }
      if (wall.start > rangeStart) {
        next.push({ startAt: range.startAt, endAt: new Date(Math.min(wall.start, rangeEnd)).toISOString(), boundaryGapAfter: true });
      }
      if (wall.end < rangeEnd) {
        next.push({ startAt: new Date(Math.max(wall.end, rangeStart)).toISOString(), endAt: range.endAt, boundaryGapAfter: range.boundaryGapAfter });
      }
    }
    ranges = next;
  }

  const gapMs = Number(boundaryGapHours || 0) * 60 * 60 * 1000;
  return ranges.map((range) => applyBoundaryGapToRange(range, gapMs)).filter(Boolean);
}

function buildChildDesiredFromRange(desired, range, index) {
  const suffix = `${formatKstDateTime(range.startAt)}~${formatKstDateTime(range.endAt)}`;
  return {
    ...desired,
    imsReservationId: desired.imsReservationId,
    sourceImsReservationIds: getDesiredMappingIds(desired),
    startAt: range.startAt,
    endAt: range.endAt,
    sourcePolicy: 'managed_child_split',
    childBlockKey: `${desired.imsReservationId}:${suffix}:${index}`,
    boundaryGapHours: range.boundaryGapHours || 0,
  };
}

function splitDesiredRowsByUnmanagedWalls({ desiredRows = [], unmanagedWalls = [], boundaryGapHours = 1 } = {}) {
  return (Array.isArray(desiredRows) ? desiredRows : []).flatMap((desired) => {
    const ranges = subtractUnmanagedWallsFromDesired(desired, unmanagedWalls, { boundaryGapHours });
    return ranges.map((range, index) => buildChildDesiredFromRange(desired, range, index));
  });
}

function isManagedZzimcarActual(row = {}) {
  return row && row.source !== 'zzimcar_disable_time' && !String(row.imsReservationId || '').startsWith('zzimcar-disable-time:');
}

function classifyZzimcarActualRows({ currentRows = [], previousMappings = [] } = {}) {
  const managedByPid = new Map();
  for (const mapping of Array.isArray(previousMappings) ? previousMappings : []) {
    if (!mapping?.zzimcarDisableTimePid) continue;
    managedByPid.set(String(mapping.zzimcarDisableTimePid), mapping);
  }

  const unmanagedWalls = [];
  const matchedManagedPids = new Set();
  for (const current of Array.isArray(currentRows) ? currentRows : []) {
    const mapping = current.zzimcarDisableTimePid ? managedByPid.get(String(current.zzimcarDisableTimePid)) : null;
    if (mapping) {
      matchedManagedPids.add(String(current.zzimcarDisableTimePid));
      continue;
    }
    unmanagedWalls.push({ ...current, source: 'zzimcar_unmanaged_wall', unmanaged: true });
  }

  const managedActualRows = (Array.isArray(previousMappings) ? previousMappings : []).filter((mapping) => isManagedZzimcarActual(mapping));
  return { managedActualRows, unmanagedWalls, matchedManagedPids };
}

function dedupePlanEntries(entries = [], getKey = (entry) => entry) {
  const seen = new Set();
  const deduped = [];
  for (const entry of entries) {
    const key = getKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }
  return deduped;
}

function planReconcile({ desiredRows = [], actualRows = [], unmanagedWalls = [], boundaryGapHours = 1 } = {}) {
  const effectiveDesiredRows = unmanagedWalls.length > 0
    ? splitDesiredRowsByUnmanagedWalls({ desiredRows, unmanagedWalls, boundaryGapHours })
    : desiredRows;
  const additions = [];
  const replacements = [];
  const deletions = [];
  const unchanged = [];
  const consumedActualIndexes = new Set();

  for (const desired of effectiveDesiredRows) {
    const exactIndex = actualRows.findIndex((actual, index) => !consumedActualIndexes.has(index) && isExactIntervalMatch(desired, actual));
    if (exactIndex >= 0) {
      consumedActualIndexes.add(exactIndex);
      unchanged.push({ desired, actual: actualRows[exactIndex] });
      continue;
    }

    const replacementIndex = actualRows.findIndex((actual, index) => !consumedActualIndexes.has(index) && isReplacementCandidate(desired, actual));
    if (replacementIndex >= 0) {
      consumedActualIndexes.add(replacementIndex);
      replacements.push({ desired, actual: actualRows[replacementIndex] });
      continue;
    }

    additions.push({ desired });
  }

  for (const [index, actual] of actualRows.entries()) {
    if (!consumedActualIndexes.has(index)) {
      deletions.push({ actual });
    }
  }

  return {
    additions: dedupePlanEntries(additions, ({ desired }) => getDesiredPlanKey(desired)),
    replacements: dedupePlanEntries(replacements, ({ desired, actual }) => `${getDesiredPlanKey(desired)}=>${actual.zzimcarDisableTimePid || actual.imsReservationId || getVehicleMatchKey(actual)}`),
    deletions: dedupePlanEntries(deletions, ({ actual }) => String(actual.zzimcarDisableTimePid || actual.imsReservationId || `${getVehicleMatchKey(actual)}:${actual.startAt}:${actual.endAt}`)),
    unchanged: dedupePlanEntries(unchanged, ({ desired }) => getDesiredPlanKey(desired)),
  };
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

function parseKstDateTimeToIso(value) {
  const normalized = String(value || '').trim().replace(' ', 'T');
  if (!normalized) return null;
  const date = new Date(`${normalized}+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function buildVehiclePidHints(rows = []) {
  const hints = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?.carNumber || !row?.zzimcarVehiclePid) continue;
    hints.set(String(row.carNumber), String(row.zzimcarVehiclePid));
  }
  return hints;
}

async function fetchCurrentZzimcarDisableTimeRows({ desiredRows = [], previousMappings = [], client } = {}) {
  const vehiclePidHints = buildVehiclePidHints(previousMappings);
  const desiredVehicles = new Map();
  for (const desired of Array.isArray(desiredRows) ? desiredRows : []) {
    if (!desired?.carNumber) continue;
    const vehiclePid = desired.zzimcarVehiclePid || vehiclePidHints.get(String(desired.carNumber)) || null;
    desiredVehicles.set(String(desired.carNumber), { carNumber: desired.carNumber, vehiclePid });
  }

  const actualRows = [];
  for (const vehicle of desiredVehicles.values()) {
    let vehiclePid = vehicle.vehiclePid;
    if (!vehiclePid) {
      const found = await client.findVehicleByCarNumber({ carNumber: vehicle.carNumber });
      vehiclePid = found.vehiclePid;
    }

    const disableTimes = await client.getDisableTimes({ vehiclePid });
    for (const row of Array.isArray(disableTimes) ? disableTimes : []) {
      actualRows.push({
        imsReservationId: row.pid ? `zzimcar-disable-time:${row.pid}` : `${vehiclePid}:${row.startDtime}:${row.endDtime}`,
        carNumber: vehicle.carNumber,
        zzimcarVehiclePid: String(vehiclePid),
        zzimcarDisableTimePid: row.pid != null ? String(row.pid) : null,
        startAt: parseKstDateTimeToIso(row.startDtime),
        endAt: parseKstDateTimeToIso(row.endDtime),
        source: 'zzimcar_disable_time',
        raw: row,
      });
    }
  }
  return actualRows.filter((row) => row.startAt && row.endAt);
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

function buildReplacementPlanFromDesired({ desired, actual }) {
  const vehiclePid = desired?.zzimcarVehiclePid || actual?.zzimcarVehiclePid || null;
  return {
    deleteTarget: actual?.zzimcarDisableTimePid
      ? { pid: String(actual.zzimcarDisableTimePid), actual }
      : { pid: null, actual },
    createPayload: vehiclePid
      ? buildDisableTimePayloadFromDesired({ desired, vehiclePid })
      : null,
    order: ['delete', 'create'],
  };
}

function buildRollbackDesiredFromActual({ desired, actual }) {
  return {
    imsReservationId: desired?.imsReservationId || actual?.imsReservationId,
    sourceImsReservationIds: getDesiredMappingIds(desired),
    carNumber: actual?.carNumber || desired?.carNumber,
    zzimcarVehiclePid: actual?.zzimcarVehiclePid || desired?.zzimcarVehiclePid,
    startAt: actual?.startAt,
    endAt: actual?.endAt,
  };
}

async function applyReplacement({
  desired,
  actual,
  client,
  shouldSave,
  supabaseClient,
  eventLogger = logReconcileEvent,
  runId,
} = {}) {
  const replacementPlan = buildReplacementPlanFromDesired({ desired, actual });
  const vehiclePid = desired?.zzimcarVehiclePid || actual?.zzimcarVehiclePid || null;
  const baseResult = {
    imsReservationId: desired.imsReservationId,
    imsReservationIds: getDesiredMappingIds(desired),
    action: 'replace',
    desired,
    actual,
    applied: false,
    vehiclePid,
    disableTimePid: actual?.zzimcarDisableTimePid || null,
    deleteTarget: replacementPlan.deleteTarget,
    createPayload: replacementPlan.createPayload,
    order: replacementPlan.order,
  };

  if (!shouldSave) return baseResult;

  if (!client) throw new Error('Missing zzimcar client for disable_time replacement');
  if (!vehiclePid) throw new Error(`Missing zzimcar vehicle pid for imsReservationId=${desired.imsReservationId}`);
  if (!actual?.zzimcarDisableTimePid) throw new Error(`Missing existing disable_time pid for imsReservationId=${desired.imsReservationId}`);

  const previousActual = { ...actual };
  const deleteResult = await client.deleteDisableTime({ pid: String(actual.zzimcarDisableTimePid) });

  try {
    const created = await createOrRecoverDisableTime({ desired, vehiclePid, client });
    const upsertedMappings = await upsertMappingsForDesired({
      desired,
      vehiclePid,
      disableTimePid: created.disableTimePid,
      supabaseClient,
    });

    return {
      ...baseResult,
      applied: true,
      disableTimePid: created.disableTimePid,
      deleteResult,
      createResult: created.createResult,
      upsertedMappings,
      previousActual,
    };
  } catch (createError) {
    const rollbackDesired = buildRollbackDesiredFromActual({ desired, actual: previousActual });
    let rollback = null;
    try {
      const rollbackCreated = await createOrRecoverDisableTime({ desired: rollbackDesired, vehiclePid, client });
      const rollbackMappings = await upsertMappingsForDesired({
        desired: rollbackDesired,
        vehiclePid,
        disableTimePid: rollbackCreated.disableTimePid,
        supabaseClient,
      });
      rollback = {
        success: true,
        disableTimePid: rollbackCreated.disableTimePid,
        createResult: rollbackCreated.createResult,
        upsertedMappings: rollbackMappings,
      };
      eventLogger({
        runId,
        action: 'replace_disable_time_rollback_succeeded',
        severity: 'warn',
        eventType: 'sync_warning',
        imsReservationId: desired.imsReservationId,
        carNumber: desired.carNumber,
        message: 'Zzimcar disable_time replacement failed after delete; previous window was recreated and needs manual confirmation',
        metadata: {
          desired,
          previousActual,
          failedCreateError: createError.message,
          rollbackDisableTimePid: rollbackCreated.disableTimePid,
          imsReservationIds: getDesiredMappingIds(desired),
        },
        requiresAck: true,
        visibility: 'admin',
        ackKey: `zzimcar:replace_rollback:${desired.imsReservationId}`,
        dedupeKey: `zzimcar:replace_rollback:${desired.imsReservationId}:${actual.zzimcarDisableTimePid}`,
      });

      return {
        ...baseResult,
        applied: false,
        deleteResult,
        previousActual,
        createError: createError.message,
        rollback,
        requiresManualConfirm: true,
      };
    } catch (rollbackError) {
      eventLogger({
        runId,
        action: 'replace_disable_time_rollback_failed',
        severity: 'error',
        eventType: 'sync_manual_recovery_required',
        imsReservationId: desired.imsReservationId,
        carNumber: desired.carNumber,
        message: 'Zzimcar disable_time replacement failed after delete and rollback recreate also failed; manual recovery required',
        metadata: {
          desired,
          previousActual,
          failedCreateError: createError.message,
          rollbackError: rollbackError.message,
          imsReservationIds: getDesiredMappingIds(desired),
        },
        requiresAck: true,
        visibility: 'admin',
        ackKey: `zzimcar:replace_rollback_failed:${desired.imsReservationId}`,
        dedupeKey: `zzimcar:replace_rollback_failed:${desired.imsReservationId}:${actual.zzimcarDisableTimePid}`,
      });
      const error = new Error(`Zzimcar disable_time replacement failed and rollback failed: ${createError.message}; rollback: ${rollbackError.message}`);
      error.createError = createError;
      error.rollbackError = rollbackError;
      error.previousActual = previousActual;
      throw error;
    }
  }
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

async function upsertMappingsForDesired({ desired, vehiclePid, disableTimePid, supabaseClient } = {}) {
  const mappingIds = getDesiredMappingIds(desired);
  const rows = [];
  for (const imsReservationId of mappingIds) {
    rows.push(await upsertMapping({
      mapping: {
        imsReservationId,
        carNumber: desired.carNumber,
        zzimcarVehiclePid: vehiclePid,
        zzimcarDisableTimePid: disableTimePid,
        childBlockKey: desired.childBlockKey,
        startAt: desired.startAt,
        endAt: desired.endAt,
        syncStatus: 'active',
      },
      supabaseClient,
    }));
  }
  return rows;
}

async function reconcileZzimcarDisableTimes({
  shouldSave = false,
  noWriteSmoke = false,
  now = new Date(),
  supabaseClient,
  client,
  eventLogger = logReconcileEvent,
} = {}) {
  const supabase = supabaseClient;
  if (shouldSave && noWriteSmoke) throw new Error('noWriteSmoke cannot be used with shouldSave');
  const syncMode = noWriteSmoke ? 'no-write-smoke' : (shouldSave ? 'save' : 'dry-run');
  const run = noWriteSmoke
    ? { id: `zzimcar-no-write-smoke-${new Date().toISOString()}`, syncMode, status: 'running' }
    : await createRun({ syncMode, supabaseClient: supabase });

  try {
    const zzimcarClient = client || new ZzimcarClient();
    const desiredRows = await fetchDesiredImsReservations({ now, supabaseClient: supabase });
    const previousMappings = await fetchActiveMappings({
      supabaseClient: supabase,
      allowMissingTable: !shouldSave || noWriteSmoke,
    });
    let actualRows = previousMappings;
    let unmanagedWalls = [];
    const needsCurrentDisableTimeRows = desiredRows.length > 0;
    if (needsCurrentDisableTimeRows) {
      const currentRows = await fetchCurrentZzimcarDisableTimeRows({ desiredRows, previousMappings, client: zzimcarClient });
      const classified = classifyZzimcarActualRows({ currentRows, previousMappings });
      actualRows = classified.managedActualRows;
      unmanagedWalls = classified.unmanagedWalls;
    }
    const plan = planReconcile({ desiredRows, actualRows, unmanagedWalls });
    for (const wall of unmanagedWalls) {
      eventLogger({
        runId: run.id,
        action: 'unmanaged_wall_detected',
        severity: 'warn',
        eventType: 'sync_unmanaged_wall_detected',
        carNumber: wall.carNumber,
        message: 'Zzimcar unmanaged disable_time wall detected and preserved',
        metadata: { zzimcarDisableTimePid: wall.zzimcarDisableTimePid, startAt: wall.startAt, endAt: wall.endAt },
        requiresAck: true,
        visibility: 'admin',
        ackKey: `zzimcar:unmanaged_wall:${wall.zzimcarDisableTimePid || `${wall.carNumber}:${wall.startAt}:${wall.endAt}`}`,
        dedupeKey: `zzimcar:unmanaged_wall:${wall.zzimcarDisableTimePid || `${wall.carNumber}:${wall.startAt}:${wall.endAt}`}`,
      });
    }
    for (const entry of plan.additions.filter(({ desired }) => desired.sourcePolicy === 'managed_child_split')) {
      eventLogger({
        runId: run.id,
        action: 'child_block_split_planned',
        severity: 'info',
        eventType: 'sync_child_block_split_planned',
        imsReservationId: entry.desired.imsReservationId,
        carNumber: entry.desired.carNumber,
        message: 'Zzimcar managed child block split planned for uncovered range',
        metadata: { startAt: entry.desired.startAt, endAt: entry.desired.endAt, sourceImsReservationIds: getDesiredMappingIds(entry.desired) },
        requiresAck: false,
        visibility: 'ops',
        dedupeKey: `zzimcar:child_split:${entry.desired.childBlockKey || `${entry.desired.imsReservationId}:${entry.desired.startAt}:${entry.desired.endAt}`}`,
      });
    }

    const results = { additions: [], deletions: [], replacements: [], recoveries: [], unchanged: plan.unchanged, errors: [] };
    const requiresZzimcarAccess = shouldSave && (plan.additions.length > 0 || plan.deletions.length > 0 || plan.replacements.length > 0 || plan.unchanged.length > 0);

    if (!shouldSave) {
      const summary = {
        mode: noWriteSmoke ? 'no-write-smoke' : 'dry-run',
        desiredCount: desiredRows.length,
        actualCount: actualRows.length,
        unmanagedWallCount: unmanagedWalls.length,
        additionsCount: plan.additions.length,
        deletionsCount: plan.deletions.length,
        changesCount: plan.replacements.length,
        replacementsCount: plan.replacements.length,
        recoveriesCount: 0,
        unchangedCount: plan.unchanged.length,
        errorsCount: 0,
        results: {
          additions: plan.additions.map(({ desired }) => ({ action: 'create', imsReservationId: desired.imsReservationId, desired, applied: false })),
          deletions: plan.deletions.map(({ actual }) => ({ action: 'delete', imsReservationId: actual.imsReservationId, actual, applied: false })),
          replacements: plan.replacements.map(({ desired, actual }) => ({
            imsReservationId: desired.imsReservationId,
            imsReservationIds: getDesiredMappingIds(desired),
            action: 'replace',
            desired,
            actual,
            applied: false,
            ...buildReplacementPlanFromDesired({ desired, actual }),
          })),
          recoveries: [],
          unchanged: plan.unchanged,
          errors: [],
        },
      };
      if (!noWriteSmoke) await finishRun({ runId: run.id, status: 'success', summary, supabaseClient: supabase });
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
          unmanagedWallCount: unmanagedWalls.length,
          additionsCount: plan.additions.length,
          deletionsCount: plan.deletions.length,
          changesCount: plan.replacements.length,
          replacementsCount: plan.replacements.length,
          recoveriesCount: 0,
          unchangedCount: plan.unchanged.length,
          errorsCount: 1,
          results: {
            additions: [],
            deletions: [],
            replacements: [],
            recoveries: [],
            unchanged: plan.unchanged,
            errors: [{ action: 'auth', error: error.message }],
          },
        };
        if (!noWriteSmoke) await finishRun({ runId: run.id, status: 'failed', summary, errorSummary: error.message, supabaseClient: supabase });
        return summary;
      }
    }

    for (const entry of plan.additions) {
    try {
      const result = await applyAddition({ ...entry, client: zzimcarClient, shouldSave });
      results.additions.push(result);
      if (shouldSave) {
        result.upsertedMappings = await upsertMappingsForDesired({
          desired: result.desired,
          vehiclePid: result.vehiclePid,
          disableTimePid: result.disableTimePid,
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
          childBlockKey: entry.desired.childBlockKey,
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
        await markMappingDeleted({ imsReservationId: result.imsReservationId, childBlockKey: entry.actual.childBlockKey, startAt: entry.actual.startAt, endAt: entry.actual.endAt, supabaseClient: supabase });
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
          childBlockKey: entry.actual.childBlockKey,
          startAt: entry.actual.startAt,
          endAt: entry.actual.endAt,
          lastError: error.message,
          syncStatus: 'delete_failed',
          supabaseClient: supabase,
        });
      }
    }
  }

  for (const entry of plan.replacements) {
    try {
      const result = await applyReplacement({
        ...entry,
        client: zzimcarClient,
        shouldSave,
        supabaseClient: supabase,
        runId: run.id,
      });
      results.replacements.push(result);
      eventLogger({
        runId: run.id,
        action: 'replace_disable_time_planned',
        severity: 'debug',
        eventType: 'sync_event',
        imsReservationId: result.imsReservationId,
        carNumber: result.desired?.carNumber,
        message: 'Zzimcar disable_time replacement planned from desired IMS projection',
        metadata: {
          disableTimePid: result.disableTimePid,
          vehiclePid: result.vehiclePid,
          imsReservationIds: result.imsReservationIds,
          applied: result.applied,
          order: result.order,
        },
        requiresAck: false,
        visibility: 'internal',
        dedupeKey: `zzimcar:replace_disable_time_planned:${result.disableTimePid || result.imsReservationId}`,
      });
    } catch (error) {
      const failure = {
        action: 'replace',
        imsReservationId: entry.desired.imsReservationId,
        error: error.message,
      };
      results.errors.push(failure);
      logReconcileError({ runId: run.id, action: 'replace', desired: entry.desired, actual: entry.actual, error });
      if (shouldSave) {
        await markMappingFailed({
          imsReservationId: entry.desired.imsReservationId,
          carNumber: entry.desired.carNumber,
          zzimcarVehiclePid: entry.actual.zzimcarVehiclePid,
          zzimcarDisableTimePid: entry.actual.zzimcarDisableTimePid,
          childBlockKey: entry.desired.childBlockKey,
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
        eventLogger({
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
          result.upsertedMappings = await upsertMappingsForDesired({
            desired: result.desired,
            vehiclePid: result.vehiclePid,
            disableTimePid: result.disableTimePid,
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
      mode: syncMode,
      desiredCount: desiredRows.length,
      actualCount: actualRows.length,
      unmanagedWallCount: unmanagedWalls.length,
      additionsCount: results.additions.length,
      deletionsCount: results.deletions.length,
      changesCount: results.replacements.length,
      replacementsCount: results.replacements.length,
      recoveriesCount: results.recoveries.length,
      unchangedCount: results.unchanged.length,
      errorsCount: results.errors.length,
      results,
    };
    const finalStatus = results.errors.length > 0 ? (results.additions.length > 0 || results.deletions.length > 0 || results.replacements.length > 0 || results.recoveries.length > 0 ? 'partial_success' : 'failed') : 'success';
    if (!noWriteSmoke) await finishRun({ runId: run.id, status: finalStatus, summary, supabaseClient: supabase });
    return summary;
  } catch (error) {
    if (!noWriteSmoke) await finishRun({
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
  applyReplacement,
  buildReplacementPlanFromDesired,
  applyMissingDisableTimeRecovery,
  buildDisableTimePayloadFromDesired,
  classifyZzimcarActualRows,
  fetchCurrentZzimcarDisableTimeRows,
  parseKstDateTimeToIso,
  applyDeletion,
  buildMapByImsReservationId,
  getDesiredMappingIds,
  findSharedActiveDisableTimeMappings,
  findDisableTimeForMapping,
  findExactDisableTime,
  hasChanged,
  intervalsOverlap,
  isExactIntervalMatch,
  isReplacementCandidate,
  isDuplicateDisableTimeError,
  planReconcile,
  splitDesiredRowsByUnmanagedWalls,
  subtractUnmanagedWallsFromDesired,
  recoverMissingDisableTimes,
  upsertMappingsForDesired,
  reconcileZzimcarDisableTimes,
};
