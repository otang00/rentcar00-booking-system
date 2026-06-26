const { getSupabaseAdmin, hasSupabaseConfig } = require('./lib/supabase-admin');

async function createSyncRun({ syncType = 'ims_vehicle_flags' } = {}) {
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

function normalizeVehicle(vehicle, syncedAt) {
  const sourceCarId = Number(vehicle?.id);

  if (!Number.isInteger(sourceCarId) || sourceCarId <= 0) {
    throw new Error('vehicle.id is required');
  }

  return {
    source_car_id: sourceCarId,
    ims_can_general_rental: vehicle?.can_general_rental == null ? null : Boolean(vehicle.can_general_rental),
    ims_can_monthly_rental: vehicle?.can_monthly_rental == null ? null : Boolean(vehicle.can_monthly_rental),
    ims_vehicle_synced_at: syncedAt,
  };
}

async function fetchExistingCarIds(sourceCarIds) {
  if (!sourceCarIds.length) return new Set();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('cars')
    .select('source_car_id')
    .in('source_car_id', sourceCarIds);

  if (error) throw error;
  return new Set((data || []).map((row) => Number(row.source_car_id)));
}

async function updateVehicleFlags(rows) {
  if (!rows.length) return [];
  const supabase = getSupabaseAdmin();
  const updated = [];

  for (const row of rows) {
    const { data, error } = await supabase
      .from('cars')
      .update({
        ims_can_general_rental: row.ims_can_general_rental,
        ims_can_monthly_rental: row.ims_can_monthly_rental,
        ims_vehicle_synced_at: row.ims_vehicle_synced_at,
      })
      .eq('source_car_id', row.source_car_id)
      .select('source_car_id');

    if (error) throw error;
    if (Array.isArray(data)) {
      updated.push(...data);
    }
  }

  return updated;
}

async function syncVehiclesToSupabase({ vehicles, syncType = 'ims_vehicle_flags', dryRun = false }) {
  const useDryRun = dryRun || !hasSupabaseConfig();
  const syncedAt = new Date().toISOString();
  const errors = [];
  const normalizedRows = [];

  for (const vehicle of vehicles) {
    try {
      normalizedRows.push(normalizeVehicle(vehicle, syncedAt));
    } catch (error) {
      errors.push({
        ims_reservation_id: vehicle?.id != null ? String(vehicle.id) : null,
        stage: 'normalize_vehicle',
        error_message: error.message,
        payload: vehicle,
      });
    }
  }

  if (useDryRun) {
    const existingIds = hasSupabaseConfig()
      ? await fetchExistingCarIds(normalizedRows.map((row) => row.source_car_id))
      : new Set();
    const matchedCount = normalizedRows.filter((row) => existingIds.has(row.source_car_id)).length;

    return {
      mode: hasSupabaseConfig() ? 'dry-run' : 'no-supabase-env',
      syncRunId: null,
      fetchedCount: vehicles.length,
      parsedCount: normalizedRows.length,
      matchedCount,
      updatedCount: 0,
      unmatchedCount: normalizedRows.length - matchedCount,
      failedCount: errors.length,
      normalizedPreview: normalizedRows.slice(0, 3),
      errors,
    };
  }

  const syncRun = await createSyncRun({ syncType });

  try {
    const existingIds = await fetchExistingCarIds(normalizedRows.map((row) => row.source_car_id));
    const matchedRows = normalizedRows.filter((row) => existingIds.has(row.source_car_id));
    const unmatchedRows = normalizedRows.filter((row) => !existingIds.has(row.source_car_id));
    const updated = await updateVehicleFlags(matchedRows);

    if (unmatchedRows.length) {
      errors.push(...unmatchedRows.slice(0, 20).map((row) => ({
        ims_reservation_id: String(row.source_car_id),
        stage: 'match_vehicle',
        error_message: 'matching car not found in cars table',
        payload: row,
      })));
    }

    await insertSyncErrors(syncRun.id, errors);
    await finishSyncRun(syncRun.id, {
      status: errors.length ? 'partial_success' : 'success',
      fetched_count: vehicles.length,
      parsed_count: normalizedRows.length,
      upserted_count: updated.length,
      failed_count: errors.length,
      error_summary: errors[0]?.error_message || null,
    });

    return {
      mode: 'write',
      syncRunId: syncRun.id,
      fetchedCount: vehicles.length,
      parsedCount: normalizedRows.length,
      matchedCount: matchedRows.length,
      updatedCount: updated.length,
      unmatchedCount: unmatchedRows.length,
      failedCount: errors.length,
      errors,
    };
  } catch (error) {
    await insertSyncErrors(syncRun.id, [{
      stage: 'sync_vehicle',
      error_message: error.message,
      payload: error.payload || null,
    }]).catch(() => {});
    await finishSyncRun(syncRun.id, {
      status: 'failed',
      fetched_count: vehicles.length,
      parsed_count: normalizedRows.length,
      upserted_count: 0,
      failed_count: errors.length + 1,
      error_summary: error.message,
    }).catch(() => {});
    throw error;
  }
}

module.exports = {
  normalizeVehicle,
  syncVehiclesToSupabase,
};

