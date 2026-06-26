const { getSupabaseAdmin } = require('../../ims-sync/lib/supabase-admin');

function normalizeMapping(row) {
  return {
    id: row.id,
    imsReservationId: String(row.ims_reservation_id),
    carNumber: row.car_number,
    zzimcarVehiclePid: row.zzimcar_vehicle_pid != null ? String(row.zzimcar_vehicle_pid) : null,
    zzimcarDisableTimePid: row.zzimcar_disable_time_pid != null ? String(row.zzimcar_disable_time_pid) : null,
    startAt: row.start_at,
    endAt: row.end_at,
    syncStatus: row.sync_status,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
    raw: row,
  };
}

async function fetchActiveMappings({ supabaseClient, allowMissingTable = false } = {}) {
  const supabase = supabaseClient || getSupabaseAdmin();
  const { data, error } = await supabase
    .from('zzimcar_disable_time_sync_mappings')
    .select('*')
    .eq('sync_status', 'active');

  if (error) {
    const message = String(error.message || '');
    if (allowMissingTable && message.includes('zzimcar_disable_time_sync_mappings')) {
      return [];
    }
    throw error;
  }
  return (Array.isArray(data) ? data : []).map(normalizeMapping);
}

async function upsertMapping({ mapping, supabaseClient } = {}) {
  const supabase = supabaseClient || getSupabaseAdmin();
  const row = {
    ims_reservation_id: String(mapping.imsReservationId),
    car_number: String(mapping.carNumber),
    zzimcar_vehicle_pid: String(mapping.zzimcarVehiclePid),
    zzimcar_disable_time_pid: mapping.zzimcarDisableTimePid != null ? String(mapping.zzimcarDisableTimePid) : null,
    start_at: mapping.startAt,
    end_at: mapping.endAt,
    sync_status: mapping.syncStatus || 'active',
    last_synced_at: new Date().toISOString(),
    last_error: mapping.lastError || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('zzimcar_disable_time_sync_mappings')
    .upsert(row, { onConflict: 'ims_reservation_id' })
    .select('*')
    .single();

  if (error) throw error;
  return normalizeMapping(data);
}

async function markMappingDeleted({ imsReservationId, lastError = null, supabaseClient } = {}) {
  const supabase = supabaseClient || getSupabaseAdmin();
  const { data, error } = await supabase
    .from('zzimcar_disable_time_sync_mappings')
    .update({
      sync_status: 'deleted',
      last_error: lastError,
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    })
    .eq('ims_reservation_id', String(imsReservationId))
    .select('*')
    .single();

  if (error) throw error;
  return normalizeMapping(data);
}

async function markMappingFailed({
  imsReservationId,
  carNumber,
  zzimcarVehiclePid,
  zzimcarDisableTimePid = null,
  startAt,
  endAt,
  lastError,
  syncStatus = 'sync_failed',
  supabaseClient,
} = {}) {
  const supabase = supabaseClient || getSupabaseAdmin();
  const { data, error } = await supabase
    .from('zzimcar_disable_time_sync_mappings')
    .upsert({
      ims_reservation_id: String(imsReservationId),
      car_number: String(carNumber || ''),
      zzimcar_vehicle_pid: zzimcarVehiclePid != null ? String(zzimcarVehiclePid) : '0',
      zzimcar_disable_time_pid: zzimcarDisableTimePid != null ? String(zzimcarDisableTimePid) : null,
      start_at: startAt,
      end_at: endAt,
      sync_status: syncStatus,
      last_error: String(lastError || ''),
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'ims_reservation_id' })
    .select('*')
    .single();

  if (error) throw error;
  return normalizeMapping(data);
}

module.exports = {
  fetchActiveMappings,
  markMappingDeleted,
  markMappingFailed,
  normalizeMapping,
  upsertMapping,
};
