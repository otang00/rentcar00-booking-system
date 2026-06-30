const { fetchDesiredImsReservations } = require('../../zzimcar-sync/lib/fetch-desired-ims-reservations');
const { CarmoreClient } = require('./carmore-client');
const { buildHolidayDateRange } = require('./carmore-holiday-date');
const { findCarmoreVehicleByCarNumber } = require('./carmore-vehicle-mapping');
const { fetchActiveMappings, markMappingDeleted, markMappingFailed, upsertMapping } = require('./carmore-sync-mapping-repo');
const { createRun, finishRun } = require('./carmore-sync-run-repo');
const { createSyncLogger } = require('../../../server/logging/syncLogger');
const { getSupabaseAdmin, hasSupabaseConfig } = require('../../ims-sync/lib/supabase-admin');

const carmoreReconcileLogger = createSyncLogger(
  { provider: 'carmore', stage: 'holiday_reconcile' },
  { supabaseClient: hasSupabaseConfig() ? getSupabaseAdmin() : null },
);

function logReconcileEvent(event) {
  try {
    carmoreReconcileLogger.event(event);
  } catch (error) {
    console.error('[carmore-reconcile-sync] sync logger failed');
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
    errorCode: error?.code || error?.name || 'CARMORE_RECONCILE_ACTION_FAILED',
    message: error?.message || String(error),
    metadata: { action },
    requiresAck: true,
    visibility: 'admin',
    ackKey: `carmore:${action}:${imsReservationId || 'unknown'}`,
    dedupeKey: `carmore:${action}:failed:${imsReservationId || 'unknown'}`,
  });
}

function getDesiredPlanKey(desired = {}) {
  return String(desired.childHolidayKey || `${desired.imsReservationId}:${desired.holidayStartDate || ''}:${desired.holidayEndDate || ''}`);
}

function buildMapByImsReservationId(rows = []) {
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [`${String(row.imsReservationId)}:${getDesiredPlanKey(row)}`, row]));
}

function buildMapByPlanKey(rows = []) {
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [getDesiredPlanKey(row), row]));
}

function isNarrowSaveScope({ onlyImsReservationId = '', limit = 0 } = {}) {
  return String(onlyImsReservationId || '').trim() !== '' || Number(limit || 0) > 0;
}

function assertCarmoreSaveScopeSafe({ shouldSave = false, onlyImsReservationId = '', limit = 0 } = {}) {
  if (!shouldSave || !isNarrowSaveScope({ onlyImsReservationId, limit })) return;
  throw new Error('Carmore filtered save-run is disabled because it can treat out-of-scope active holidays as deletions. Use no-write smoke/dry-run for filtering, then run a full-scope save-run only after review.');
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

function enrichDesiredReservation(desired, mappingOptions = {}) {
  const vehicle = findCarmoreVehicleByCarNumber(desired.carNumber, mappingOptions);
  if (!vehicle) throw new Error(`Carmore vehicle mapping not found for carNumber=${desired.carNumber}`);
  const range = buildHolidayDateRange({ startAt: desired.startAt, endAt: desired.endAt });
  return {
    ...desired,
    carmoreRentcarSerial: vehicle.rentcarSerial,
    holidayStartDate: range.holidayStartDate,
    holidayEndDate: range.holidayEndDate,
    vehicleMapping: vehicle,
  };
}

function hasChanged(desired, actual) {
  if (!desired || !actual) return false;
  return String(desired.carNumber) !== String(actual.carNumber)
    || String(desired.startAt) !== String(actual.startAt)
    || String(desired.endAt) !== String(actual.endAt)
    || String(desired.carmoreRentcarSerial) !== String(actual.carmoreRentcarSerial)
    || String(desired.holidayStartDate) !== String(actual.holidayStartDate)
    || String(desired.holidayEndDate) !== String(actual.holidayEndDate)
    || !actual.carmoreHolidaySerial;
}


function dateToUtcMs(value) {
  const ms = new Date(`${value}T00:00:00.000Z`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function utcMsToDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function splitDateRangeByUnmanagedWalls(desired, unmanagedWalls = []) {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = dateToUtcMs(desired.holidayStartDate);
  const end = dateToUtcMs(desired.holidayEndDate);
  if (start == null || end == null || start > end) return [];
  let ranges = [{ start, end }];

  const walls = (Array.isArray(unmanagedWalls) ? unmanagedWalls : [])
    .filter((wall) => String(wall.carmoreRentcarSerial) === String(desired.carmoreRentcarSerial))
    .map((wall) => ({ start: dateToUtcMs(wall.holidayStartDate || wall.startDate), end: dateToUtcMs(wall.holidayEndDate || wall.endDate) }))
    .filter((wall) => wall.start != null && wall.end != null && wall.start <= wall.end)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  for (const wall of walls) {
    const next = [];
    for (const range of ranges) {
      if (wall.end < range.start || wall.start > range.end) {
        next.push(range);
        continue;
      }
      if (wall.start > range.start) next.push({ start: range.start, end: wall.start - dayMs });
      if (wall.end < range.end) next.push({ start: wall.end + dayMs, end: range.end });
    }
    ranges = next;
  }

  return ranges
    .filter((range) => range.start <= range.end)
    .map((range, index) => ({
      ...desired,
      holidayStartDate: utcMsToDate(range.start),
      holidayEndDate: utcMsToDate(range.end),
      sourcePolicy: 'managed_child_split',
      childHolidayKey: `${desired.imsReservationId}:${utcMsToDate(range.start)}:${utcMsToDate(range.end)}:${index}`,
    }));
}

function splitCarmoreDesiredRowsByUnmanagedWalls({ desiredRows = [], unmanagedWalls = [] } = {}) {
  return (Array.isArray(desiredRows) ? desiredRows : []).flatMap((desired) => splitDateRangeByUnmanagedWalls(desired, unmanagedWalls));
}

function planReconcile({ desiredRows = [], actualRows = [], unmanagedWalls = [] } = {}) {
  const effectiveDesiredRows = unmanagedWalls.length > 0
    ? splitCarmoreDesiredRowsByUnmanagedWalls({ desiredRows, unmanagedWalls })
    : desiredRows;
  const additions = [];
  const changes = [];
  const deletions = [];
  const unchanged = [];
  const consumedActualIndexes = new Set();

  for (const desired of effectiveDesiredRows) {
    const exactIndex = actualRows.findIndex((actual, index) => !consumedActualIndexes.has(index) && getDesiredPlanKey(actual) === getDesiredPlanKey(desired));
    if (exactIndex >= 0) {
      consumedActualIndexes.add(exactIndex);
      const actual = actualRows[exactIndex];
      if (hasChanged(desired, actual)) changes.push({ desired, actual });
      else unchanged.push({ desired, actual });
      continue;
    }

    const sameImsIndex = actualRows.findIndex((actual, index) => !consumedActualIndexes.has(index) && String(actual.imsReservationId) === String(desired.imsReservationId));
    if (sameImsIndex >= 0) {
      consumedActualIndexes.add(sameImsIndex);
      changes.push({ desired, actual: actualRows[sameImsIndex] });
      continue;
    }

    additions.push({ desired });
  }

  for (const [index, actual] of actualRows.entries()) {
    if (!consumedActualIndexes.has(index)) deletions.push({ actual });
  }

  return {
    additions: dedupePlanEntries(additions, ({ desired }) => getDesiredPlanKey(desired)),
    changes: dedupePlanEntries(changes, ({ desired, actual }) => `${getDesiredPlanKey(desired)}=>${actual.carmoreHolidaySerial || actual.imsReservationId || ''}`),
    deletions: dedupePlanEntries(deletions, ({ actual }) => String(actual.carmoreHolidaySerial || getDesiredPlanKey(actual))),
    unchanged: dedupePlanEntries(unchanged, ({ desired }) => getDesiredPlanKey(desired)),
  };
}

function buildHolidayMemo(desired) {
  return `IMS ${desired.imsReservationId}`;
}

function findRecoverableHoliday({ rows = [], desired, memo }) {
  return (Array.isArray(rows) ? rows : []).find((row) => row.memo === memo && row.startDate === desired.holidayStartDate && row.endDate === desired.holidayEndDate) || null;
}

function isDuplicateHolidayError(error) {
  const message = String(error?.message || '');
  return message.includes('duplicate')
    || message.includes('DUPLICATION')
    || message.includes('중복')
    || message.includes('이미')
    || message.includes('휴무');
}

async function createOrRecoverHoliday({ desired, client }) {
  const memo = buildHolidayMemo(desired);
  let existing = await client.getRentcarHolidays({ rentcarSerial: desired.carmoreRentcarSerial });
  const exact = findRecoverableHoliday({ rows: existing, desired, memo });
  if (exact?.serial) {
    return { memo, holidaySerial: exact.serial, createResult: null, recoveredExisting: true, row: exact };
  }

  let createResult = null;
  try {
    createResult = await client.createHoliday({
      rentcarSerial: desired.carmoreRentcarSerial,
      memo,
      startDate: desired.holidayStartDate,
      endDate: desired.holidayEndDate,
    });
  } catch (error) {
    if (!isDuplicateHolidayError(error)) throw error;
    existing = await client.getRentcarHolidays({ rentcarSerial: desired.carmoreRentcarSerial });
    const duplicate = findRecoverableHoliday({ rows: existing, desired, memo });
    if (!duplicate?.serial) throw error;
    return {
      memo,
      holidaySerial: duplicate.serial,
      createResult: { duplicateRecovered: true, error: error.message },
      recoveredExisting: true,
      row: duplicate,
    };
  }

  if (!createResult.holidaySerial) {
    existing = await client.getRentcarHolidays({ rentcarSerial: desired.carmoreRentcarSerial });
    const created = findRecoverableHoliday({ rows: existing, desired, memo });
    createResult.holidaySerial = created?.serial || null;
    createResult.row = created || createResult.row || null;
  }

  if (!createResult.holidaySerial) throw new Error(`Carmore holiday serial not found after create for imsReservationId=${desired.imsReservationId}`);
  return { memo, holidaySerial: createResult.holidaySerial, createResult, recoveredExisting: false, row: createResult.row };
}

async function applyAddition({ desired, client, shouldSave }) {
  const base = { action: 'add', imsReservationId: desired.imsReservationId, desired, applied: false };
  if (!shouldSave) return base;
  const result = await createOrRecoverHoliday({ desired, client });
  return { ...base, applied: true, ...result };
}

function findSharedActiveHolidayMappings({ actual, actualRows = [] } = {}) {
  if (!actual?.carmoreHolidaySerial) return [];
  return (Array.isArray(actualRows) ? actualRows : []).filter((row) => (
    row
    && String(row.imsReservationId) !== String(actual.imsReservationId)
    && String(row.syncStatus || 'active') === 'active'
    && row.carmoreHolidaySerial != null
    && String(row.carmoreHolidaySerial) === String(actual.carmoreHolidaySerial)
  ));
}

async function applyDeletion({ actual, actualRows = [], client, shouldSave }) {
  const sharedActiveMappings = findSharedActiveHolidayMappings({ actual, actualRows });
  const base = { action: 'delete', imsReservationId: actual.imsReservationId, actual, applied: false, deleteResult: null, skippedCarmoreDelete: false, sharedActiveMappings };
  if (!shouldSave) return base;
  if (!actual.carmoreHolidaySerial) throw new Error(`carmoreHolidaySerial is required for delete: ${actual.imsReservationId}`);
  if (sharedActiveMappings.length > 0) {
    return { ...base, applied: true, skippedCarmoreDelete: true };
  }
  const deleteResult = await client.deleteHoliday({ holidaySerial: actual.carmoreHolidaySerial });
  return { ...base, applied: true, deleteResult };
}

async function applyChange({ desired, actual, actualRows = [], client, shouldSave }) {
  const base = { action: 'change', imsReservationId: desired.imsReservationId, desired, actual, applied: false };
  if (!shouldSave) return base;
  const deletion = await applyDeletion({ actual, actualRows, client, shouldSave });
  const addition = await createOrRecoverHoliday({ desired, client });
  return { ...base, applied: true, deletion, addition };
}

function classifyCarmoreHolidayRows({ currentRows = [], previousMappings = [], carmoreRentcarSerial, carNumber } = {}) {
  const managedBySerial = new Set((Array.isArray(previousMappings) ? previousMappings : [])
    .map((mapping) => mapping?.carmoreHolidaySerial)
    .filter(Boolean)
    .map(String));

  const unmanagedWalls = [];
  for (const row of Array.isArray(currentRows) ? currentRows : []) {
    if (!row) continue;
    const serial = row.serial != null ? String(row.serial) : null;
    if (serial && managedBySerial.has(serial)) continue;
    if (!row.startDate || !row.endDate) continue;
    unmanagedWalls.push({
      carNumber,
      carmoreRentcarSerial: String(carmoreRentcarSerial),
      carmoreHolidaySerial: serial,
      holidayStartDate: row.startDate,
      holidayEndDate: row.endDate,
      source: 'carmore_unmanaged_wall',
      unmanaged: true,
      raw: row,
    });
  }
  return unmanagedWalls;
}

async function fetchCurrentCarmoreUnmanagedWalls({ desiredRows = [], actualRows = [], client } = {}) {
  if (!client) return [];
  const serials = new Map();
  for (const row of [...(Array.isArray(desiredRows) ? desiredRows : []), ...(Array.isArray(actualRows) ? actualRows : [])]) {
    if (!row?.carmoreRentcarSerial) continue;
    const serial = String(row.carmoreRentcarSerial);
    if (!serials.has(serial)) serials.set(serial, { carmoreRentcarSerial: serial, carNumber: row.carNumber || '' });
  }

  const unmanagedWalls = [];
  for (const vehicle of serials.values()) {
    const currentRows = await client.getRentcarHolidays({ rentcarSerial: vehicle.carmoreRentcarSerial });
    unmanagedWalls.push(...classifyCarmoreHolidayRows({
      currentRows,
      previousMappings: actualRows,
      carmoreRentcarSerial: vehicle.carmoreRentcarSerial,
      carNumber: vehicle.carNumber,
    }));
  }
  return unmanagedWalls;
}

async function fetchEnrichedDesiredRows({ now, supabaseClient, mappingOptions } = {}) {
  const desiredRows = await fetchDesiredImsReservations({ now, supabaseClient });
  return desiredRows.map((desired) => enrichDesiredReservation(desired, mappingOptions));
}

async function reconcileCarmoreHolidays({
  shouldSave = false,
  noWriteSmoke = false,
  now = new Date(),
  supabaseClient,
  client,
  mappingOptions,
  limit = 0,
  onlyImsReservationId = '',
  eventLogger = logReconcileEvent,
} = {}) {
  const supabase = supabaseClient;
  if (shouldSave && noWriteSmoke) throw new Error('noWriteSmoke cannot be used with shouldSave');
  assertCarmoreSaveScopeSafe({ shouldSave, onlyImsReservationId, limit });
  const syncMode = noWriteSmoke ? 'no-write-smoke' : (shouldSave ? 'save' : 'dry-run');
  const run = noWriteSmoke
    ? { id: `carmore-no-write-smoke-${new Date().toISOString()}`, syncMode, status: 'running' }
    : await createRun({ syncMode, supabaseClient: supabase });
  try {
    let desiredRows = await fetchEnrichedDesiredRows({ now, supabaseClient: supabase, mappingOptions });
    if (onlyImsReservationId) {
      desiredRows = desiredRows.filter((row) => String(row.imsReservationId) === String(onlyImsReservationId));
    }
    const maxRows = Number(limit || 0);
    if (maxRows > 0) {
      desiredRows = desiredRows.slice(0, maxRows);
    }
    const actualRows = await fetchActiveMappings({ supabaseClient: supabase, allowMissingTable: !shouldSave || noWriteSmoke });
    const carmoreClient = client || new CarmoreClient();
    const shouldFetchUnmanagedWalls = desiredRows.length > 0 && (shouldSave || client);
    const unmanagedWalls = shouldFetchUnmanagedWalls
      ? await fetchCurrentCarmoreUnmanagedWalls({ desiredRows, actualRows, client: carmoreClient })
      : [];
    for (const wall of unmanagedWalls) {
      eventLogger({
        runId: run.id,
        action: 'unmanaged_wall_detected',
        severity: 'warn',
        eventType: 'sync_unmanaged_wall_detected',
        carNumber: wall.carNumber,
        message: 'Carmore unmanaged holiday wall detected and preserved',
        metadata: { carmoreRentcarSerial: wall.carmoreRentcarSerial, holidayStartDate: wall.holidayStartDate, holidayEndDate: wall.holidayEndDate, carmoreHolidaySerial: wall.carmoreHolidaySerial },
        requiresAck: true,
        visibility: 'admin',
        ackKey: `carmore:unmanaged_wall:${wall.carmoreHolidaySerial || `${wall.carmoreRentcarSerial}:${wall.holidayStartDate}:${wall.holidayEndDate}`}`,
        dedupeKey: `carmore:unmanaged_wall:${wall.carmoreHolidaySerial || `${wall.carmoreRentcarSerial}:${wall.holidayStartDate}:${wall.holidayEndDate}`}`,
      });
    }
    const plan = planReconcile({ desiredRows, actualRows, unmanagedWalls });
    const results = { additions: [], deletions: [], changes: [], unchanged: plan.unchanged, errors: [] };

    if (shouldSave && (plan.additions.length || plan.deletions.length || plan.changes.length)) {
      await carmoreClient.ensureLoggedIn();
    }

    for (const entry of plan.additions) {
      try {
        const result = await applyAddition({ ...entry, client: carmoreClient, shouldSave });
        results.additions.push(result);
        if (shouldSave) await upsertMapping({ mapping: {
          imsReservationId: result.imsReservationId,
          carNumber: result.desired.carNumber,
          carmoreRentcarSerial: result.desired.carmoreRentcarSerial,
          carmoreHolidaySerial: result.holidaySerial,
          childHolidayKey: result.desired.childHolidayKey,
          startAt: result.desired.startAt,
          endAt: result.desired.endAt,
          holidayStartDate: result.desired.holidayStartDate,
          holidayEndDate: result.desired.holidayEndDate,
          syncStatus: 'active',
        }, supabaseClient: supabase });
      } catch (error) {
        results.errors.push({ action: 'add', imsReservationId: entry.desired.imsReservationId, error: error.message });
        logReconcileError({ runId: run.id, action: 'add', desired: entry.desired, error });
        if (shouldSave) await markMappingFailed({ ...entry.desired, childHolidayKey: entry.desired.childHolidayKey, lastError: error.message, syncStatus: 'sync_failed', supabaseClient: supabase });
      }
    }

    for (const entry of plan.deletions) {
      try {
        const result = await applyDeletion({ ...entry, actualRows, client: carmoreClient, shouldSave });
        results.deletions.push(result);
        if (shouldSave) await markMappingDeleted({ imsReservationId: result.imsReservationId, childHolidayKey: entry.actual.childHolidayKey, holidayStartDate: entry.actual.holidayStartDate, holidayEndDate: entry.actual.holidayEndDate, supabaseClient: supabase });
      } catch (error) {
        results.errors.push({ action: 'delete', imsReservationId: entry.actual.imsReservationId, error: error.message });
        logReconcileError({ runId: run.id, action: 'delete', actual: entry.actual, error });
        if (shouldSave) await markMappingFailed({ ...entry.actual, childHolidayKey: entry.actual.childHolidayKey, lastError: error.message, syncStatus: 'delete_failed', supabaseClient: supabase });
      }
    }

    for (const entry of plan.changes) {
      try {
        const result = await applyChange({ ...entry, actualRows, client: carmoreClient, shouldSave });
        results.changes.push(result);
        if (shouldSave) await upsertMapping({ mapping: {
          imsReservationId: result.imsReservationId,
          carNumber: result.desired.carNumber,
          carmoreRentcarSerial: result.desired.carmoreRentcarSerial,
          carmoreHolidaySerial: result.addition.holidaySerial,
          childHolidayKey: result.desired.childHolidayKey,
          startAt: result.desired.startAt,
          endAt: result.desired.endAt,
          holidayStartDate: result.desired.holidayStartDate,
          holidayEndDate: result.desired.holidayEndDate,
          syncStatus: 'active',
        }, supabaseClient: supabase });
      } catch (error) {
        results.errors.push({ action: 'change', imsReservationId: entry.desired.imsReservationId, error: error.message });
        logReconcileError({ runId: run.id, action: 'change', desired: entry.desired, actual: entry.actual, error });
        if (shouldSave) await markMappingFailed({ ...entry.desired, carmoreHolidaySerial: entry.actual.carmoreHolidaySerial, childHolidayKey: entry.desired.childHolidayKey, lastError: error.message, syncStatus: 'sync_failed', supabaseClient: supabase });
      }
    }

    const summary = {
      mode: syncMode,
      desiredCount: desiredRows.length,
      actualCount: actualRows.length,
      unmanagedWallCount: unmanagedWalls.length,
      additionsCount: results.additions.length,
      deletionsCount: results.deletions.length,
      changesCount: results.changes.length,
      unchangedCount: results.unchanged.length,
      errorsCount: results.errors.length,
      results,
    };
    const finalStatus = results.errors.length ? ((results.additions.length || results.deletions.length || results.changes.length) ? 'partial_success' : 'failed') : 'success';
    if (!noWriteSmoke) await finishRun({ runId: run.id, status: finalStatus, summary, supabaseClient: supabase });
    return summary;
  } catch (error) {
    if (!noWriteSmoke) await finishRun({
      runId: run.id,
      status: 'failed',
      summary: { desiredCount: 0, actualCount: 0, additionsCount: 0, deletionsCount: 0, changesCount: 0, unchangedCount: 0, errorsCount: 1, results: { errors: [{ error: error.message }] } },
      errorSummary: error.message,
      supabaseClient: supabase,
    }).catch(() => {});
    throw error;
  }
}

module.exports = {
  applyAddition,
  applyChange,
  applyDeletion,
  assertCarmoreSaveScopeSafe,
  buildHolidayMemo,
  classifyCarmoreHolidayRows,
  buildMapByImsReservationId,
  createOrRecoverHoliday,
  fetchCurrentCarmoreUnmanagedWalls,
  findRecoverableHoliday,
  findSharedActiveHolidayMappings,
  isDuplicateHolidayError,
  getDesiredPlanKey,
  enrichDesiredReservation,
  fetchEnrichedDesiredRows,
  hasChanged,
  planReconcile,
  splitCarmoreDesiredRowsByUnmanagedWalls,
  splitDateRangeByUnmanagedWalls,
  reconcileCarmoreHolidays,
};
