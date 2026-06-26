const { getSupabaseAdmin, hasSupabaseConfig } = require('./lib/supabase-admin');
const { buildRawReservationRow, normalizeSchedule } = require('./normalize-ims-reservation');

async function createSyncRun({ syncType = 'ims_reservations' } = {}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('reservation_sync_runs')
    .insert({ sync_type: syncType, status: 'running' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function finishSyncRun(syncRunId, fields) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('reservation_sync_runs')
    .update({ ...fields, finished_at: new Date().toISOString() })
    .eq('id', syncRunId);

  if (error) throw error;
}

async function insertSyncErrors(syncRunId, errors) {
  if (!errors.length) return;
  const supabase = getSupabaseAdmin();
  const rows = errors.map((entry) => ({
    sync_run_id: syncRunId,
    ims_reservation_id: entry.ims_reservation_id || null,
    stage: entry.stage,
    error_code: entry.error_code || null,
    error_message: entry.error_message,
    payload: entry.payload || null,
  }));
  const { error } = await supabase.from('reservation_sync_errors').insert(rows);
  if (error) throw error;
}

async function insertRawRows(rawRows) {
  if (!rawRows.length) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('ims_reservations_raw')
    .insert(rawRows)
    .select('id, ims_reservation_id');

  if (error) throw error;
  return data || [];
}

async function updateRawParseResults(updates) {
  if (!updates.length) return;
  const supabase = getSupabaseAdmin();
  for (const update of updates) {
    const { error } = await supabase
      .from('ims_reservations_raw')
      .update({
        parse_status: update.parse_status,
        parse_error: update.parse_error,
      })
      .eq('id', update.id);
    if (error) throw error;
  }
}

async function upsertReservations(rows) {
  if (!rows.length) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('ims_sync_reservations')
    .upsert(rows, { onConflict: 'ims_reservation_id' })
    .select('id, ims_reservation_id');

  if (error) throw error;
  return data || [];
}

async function syncReservationsToSupabase({ schedules, syncType = 'ims_reservations', dryRun = false }) {
  const useDryRun = dryRun || !hasSupabaseConfig();
  const errors = [];
  const normalizedRows = [];
  const rawRowsPreview = [];

  if (useDryRun) {
    for (const schedule of schedules) {
      try {
        rawRowsPreview.push(buildRawReservationRow(schedule, 'dry-run'));
        normalizedRows.push(normalizeSchedule(schedule, null));
      } catch (error) {
        errors.push({
          ims_reservation_id: schedule?.id != null ? String(schedule.id) : null,
          stage: 'normalize',
          error_message: error.message,
          payload: schedule,
        });
      }
    }

    return {
      mode: hasSupabaseConfig() ? 'dry-run' : 'no-supabase-env',
      syncRunId: null,
      fetchedCount: schedules.length,
      parsedCount: normalizedRows.length,
      upsertedCount: 0,
      failedCount: errors.length,
      rawInsertedCount: 0,
      normalizedPreview: normalizedRows.slice(0, 3),
      rawPreview: rawRowsPreview.slice(0, 3),
      errors,
    };
  }

  const syncRun = await createSyncRun({ syncType });

  try {
    const rawRows = schedules.map((schedule) => buildRawReservationRow(schedule, syncRun.id));
    const insertedRawRows = await insertRawRows(rawRows);
    const rawByImsId = new Map(insertedRawRows.map((row) => [String(row.ims_reservation_id), row.id]));
    const rawUpdates = [];

    for (const schedule of schedules) {
      try {
        const rawId = rawByImsId.get(String(schedule.id)) || null;
        const normalized = normalizeSchedule(schedule, rawId);
        normalizedRows.push(normalized);
        if (rawId) {
          rawUpdates.push({ id: rawId, parse_status: 'parsed', parse_error: null });
        }
      } catch (error) {
        const imsReservationId = schedule?.id != null ? String(schedule.id) : null;
        const rawId = rawByImsId.get(imsReservationId);
        if (rawId) {
          rawUpdates.push({ id: rawId, parse_status: 'failed', parse_error: error.message });
        }
        errors.push({
          ims_reservation_id: imsReservationId,
          stage: 'normalize',
          error_message: error.message,
          payload: schedule,
        });
      }
    }

    await updateRawParseResults(rawUpdates);
    const upserted = await upsertReservations(normalizedRows);
    await insertSyncErrors(syncRun.id, errors);
    await finishSyncRun(syncRun.id, {
      status: errors.length ? 'partial_success' : 'success',
      fetched_count: schedules.length,
      parsed_count: normalizedRows.length,
      upserted_count: upserted.length,
      failed_count: errors.length,
      error_summary: errors[0]?.error_message || null,
    });

    return {
      mode: 'write',
      syncRunId: syncRun.id,
      fetchedCount: schedules.length,
      parsedCount: normalizedRows.length,
      upsertedCount: upserted.length,
      failedCount: errors.length,
      rawInsertedCount: insertedRawRows.length,
      errors,
    };
  } catch (error) {
    await insertSyncErrors(syncRun.id, [{
      stage: 'sync',
      error_message: error.message,
      payload: error.payload || null,
    }]).catch(() => {});
    await finishSyncRun(syncRun.id, {
      status: 'failed',
      fetched_count: schedules.length,
      parsed_count: normalizedRows.length,
      upserted_count: 0,
      failed_count: errors.length + 1,
      error_summary: error.message,
    }).catch(() => {});
    throw error;
  }
}

module.exports = {
  syncReservationsToSupabase,
};
