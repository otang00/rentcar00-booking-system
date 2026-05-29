const { fetchDesiredImsReservations } = require('../../zzimcar-sync/lib/fetch-desired-ims-reservations');
const { CarmoreClient } = require('./carmore-client');
const { buildHolidayDateRange } = require('./carmore-holiday-date');
const { findCarmoreVehicleByCarNumber } = require('./carmore-vehicle-mapping');
const { fetchActiveMappings, markMappingDeleted, markMappingFailed, upsertMapping } = require('./carmore-sync-mapping-repo');
const { createRun, finishRun } = require('./carmore-sync-run-repo');

function buildMapByImsReservationId(rows = []) {
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [String(row.imsReservationId), row]));
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

function planReconcile({ desiredRows = [], actualRows = [] } = {}) {
  const desiredMap = buildMapByImsReservationId(desiredRows);
  const actualMap = buildMapByImsReservationId(actualRows);
  const additions = [];
  const changes = [];
  const deletions = [];
  const unchanged = [];

  for (const desired of desiredRows) {
    const actual = actualMap.get(String(desired.imsReservationId));
    if (!actual) additions.push({ desired });
    else if (hasChanged(desired, actual)) changes.push({ desired, actual });
    else unchanged.push({ desired, actual });
  }

  for (const actual of actualRows) {
    if (!desiredMap.has(String(actual.imsReservationId))) deletions.push({ actual });
  }
  return { additions, changes, deletions, unchanged };
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

async function fetchEnrichedDesiredRows({ now, supabaseClient, mappingOptions } = {}) {
  const desiredRows = await fetchDesiredImsReservations({ now, supabaseClient });
  return desiredRows.map((desired) => enrichDesiredReservation(desired, mappingOptions));
}

async function reconcileCarmoreHolidays({
  shouldSave = false,
  now = new Date(),
  supabaseClient,
  client,
  mappingOptions,
  limit = 0,
  onlyImsReservationId = '',
} = {}) {
  const supabase = supabaseClient;
  const syncMode = shouldSave ? 'save' : 'dry-run';
  const run = await createRun({ syncMode, supabaseClient: supabase });
  try {
    let desiredRows = await fetchEnrichedDesiredRows({ now, supabaseClient: supabase, mappingOptions });
    if (onlyImsReservationId) {
      desiredRows = desiredRows.filter((row) => String(row.imsReservationId) === String(onlyImsReservationId));
    }
    const maxRows = Number(limit || 0);
    if (maxRows > 0) {
      desiredRows = desiredRows.slice(0, maxRows);
    }
    const actualRows = await fetchActiveMappings({ supabaseClient: supabase, allowMissingTable: !shouldSave });
    const plan = planReconcile({ desiredRows, actualRows });
    const results = { additions: [], deletions: [], changes: [], unchanged: plan.unchanged, errors: [] };
    const carmoreClient = client || new CarmoreClient();

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
          startAt: result.desired.startAt,
          endAt: result.desired.endAt,
          holidayStartDate: result.desired.holidayStartDate,
          holidayEndDate: result.desired.holidayEndDate,
          syncStatus: 'active',
        }, supabaseClient: supabase });
      } catch (error) {
        results.errors.push({ action: 'add', imsReservationId: entry.desired.imsReservationId, error: error.message });
        if (shouldSave) await markMappingFailed({ ...entry.desired, lastError: error.message, syncStatus: 'sync_failed', supabaseClient: supabase });
      }
    }

    for (const entry of plan.deletions) {
      try {
        const result = await applyDeletion({ ...entry, actualRows, client: carmoreClient, shouldSave });
        results.deletions.push(result);
        if (shouldSave) await markMappingDeleted({ imsReservationId: result.imsReservationId, supabaseClient: supabase });
      } catch (error) {
        results.errors.push({ action: 'delete', imsReservationId: entry.actual.imsReservationId, error: error.message });
        if (shouldSave) await markMappingFailed({ ...entry.actual, lastError: error.message, syncStatus: 'delete_failed', supabaseClient: supabase });
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
          startAt: result.desired.startAt,
          endAt: result.desired.endAt,
          holidayStartDate: result.desired.holidayStartDate,
          holidayEndDate: result.desired.holidayEndDate,
          syncStatus: 'active',
        }, supabaseClient: supabase });
      } catch (error) {
        results.errors.push({ action: 'change', imsReservationId: entry.desired.imsReservationId, error: error.message });
        if (shouldSave) await markMappingFailed({ ...entry.desired, carmoreHolidaySerial: entry.actual.carmoreHolidaySerial, lastError: error.message, syncStatus: 'sync_failed', supabaseClient: supabase });
      }
    }

    const summary = {
      mode: syncMode,
      desiredCount: desiredRows.length,
      actualCount: actualRows.length,
      additionsCount: results.additions.length,
      deletionsCount: results.deletions.length,
      changesCount: results.changes.length,
      unchangedCount: results.unchanged.length,
      errorsCount: results.errors.length,
      results,
    };
    const finalStatus = results.errors.length ? ((results.additions.length || results.deletions.length || results.changes.length) ? 'partial_success' : 'failed') : 'success';
    await finishRun({ runId: run.id, status: finalStatus, summary, supabaseClient: supabase });
    return summary;
  } catch (error) {
    await finishRun({
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
  buildHolidayMemo,
  buildMapByImsReservationId,
  createOrRecoverHoliday,
  findRecoverableHoliday,
  findSharedActiveHolidayMappings,
  isDuplicateHolidayError,
  enrichDesiredReservation,
  fetchEnrichedDesiredRows,
  hasChanged,
  planReconcile,
  reconcileCarmoreHolidays,
};
