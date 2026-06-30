const { getSupabaseAdmin } = require('../../ims-sync/lib/supabase-admin');

function buildChildHolidayKey(mapping = {}) {
  if (mapping.childHolidayKey != null && String(mapping.childHolidayKey)) return String(mapping.childHolidayKey);
  return [mapping.imsReservationId, mapping.holidayStartDate, mapping.holidayEndDate].map((value) => String(value || '')).join(':');
}

function normalizeMapping(row) {
  return {
    id: row.id,
    imsReservationId: String(row.ims_reservation_id),
    childHolidayKey: row.child_holiday_key || buildChildHolidayKey({ imsReservationId: row.ims_reservation_id, holidayStartDate: row.holiday_start_date, holidayEndDate: row.holiday_end_date }),
    carNumber: row.car_number,
    carmoreRentcarSerial: row.carmore_rentcar_serial != null ? String(row.carmore_rentcar_serial) : null,
    carmoreHolidaySerial: row.carmore_holiday_serial != null ? String(row.carmore_holiday_serial) : null,
    startAt: row.start_at,
    endAt: row.end_at,
    holidayStartDate: row.holiday_start_date,
    holidayEndDate: row.holiday_end_date,
    syncStatus: row.sync_status,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
    raw: row,
  };
}

async function fetchActiveMappings({ supabaseClient, allowMissingTable = false } = {}) {
  const supabase = supabaseClient || getSupabaseAdmin();
  const { data, error } = await supabase
    .from('carmore_holiday_sync_mappings')
    .select('*')
    .eq('sync_status', 'active');
  if (error) {
    const message = String(error.message || '');
    if (allowMissingTable && message.includes('carmore_holiday_sync_mappings')) return [];
    throw error;
  }
  return (Array.isArray(data) ? data : []).map(normalizeMapping);
}

async function upsertMapping({ mapping, supabaseClient } = {}) {
  const supabase = supabaseClient || getSupabaseAdmin();
  const row = {
    ims_reservation_id: String(mapping.imsReservationId),
    child_holiday_key: buildChildHolidayKey(mapping),
    car_number: String(mapping.carNumber),
    carmore_rentcar_serial: String(mapping.carmoreRentcarSerial),
    carmore_holiday_serial: mapping.carmoreHolidaySerial != null ? String(mapping.carmoreHolidaySerial) : null,
    start_at: mapping.startAt,
    end_at: mapping.endAt,
    holiday_start_date: mapping.holidayStartDate,
    holiday_end_date: mapping.holidayEndDate,
    sync_status: mapping.syncStatus || 'active',
    last_synced_at: new Date().toISOString(),
    last_error: mapping.lastError || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('carmore_holiday_sync_mappings')
    .upsert(row, { onConflict: 'ims_reservation_id,child_holiday_key' })
    .select('*')
    .single();
  if (error) throw error;
  return normalizeMapping(data);
}

async function markMappingDeleted({ imsReservationId, childHolidayKey = null, holidayStartDate = null, holidayEndDate = null, lastError = null, supabaseClient } = {}) {
  const supabase = supabaseClient || getSupabaseAdmin();
  let query = supabase
    .from('carmore_holiday_sync_mappings')
    .update({
      sync_status: 'deleted',
      last_error: lastError,
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    })
    .eq('ims_reservation_id', String(imsReservationId));
  const effectiveChildHolidayKey = childHolidayKey || (holidayStartDate && holidayEndDate ? buildChildHolidayKey({ imsReservationId, holidayStartDate, holidayEndDate }) : null);
  if (effectiveChildHolidayKey) query = query.eq('child_holiday_key', effectiveChildHolidayKey);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return normalizeMapping(data);
}

async function markMappingFailed({
  imsReservationId,
  carNumber,
  carmoreRentcarSerial,
  carmoreHolidaySerial = null,
  childHolidayKey = null,
  startAt,
  endAt,
  holidayStartDate,
  holidayEndDate,
  lastError,
  syncStatus = 'sync_failed',
  supabaseClient,
} = {}) {
  const supabase = supabaseClient || getSupabaseAdmin();
  const { data, error } = await supabase
    .from('carmore_holiday_sync_mappings')
    .upsert({
      ims_reservation_id: String(imsReservationId),
      child_holiday_key: buildChildHolidayKey({ imsReservationId, childHolidayKey, holidayStartDate, holidayEndDate }),
      car_number: String(carNumber || ''),
      carmore_rentcar_serial: carmoreRentcarSerial != null ? String(carmoreRentcarSerial) : '0',
      carmore_holiday_serial: carmoreHolidaySerial != null ? String(carmoreHolidaySerial) : null,
      start_at: startAt,
      end_at: endAt,
      holiday_start_date: holidayStartDate,
      holiday_end_date: holidayEndDate,
      sync_status: syncStatus,
      last_error: String(lastError || ''),
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'ims_reservation_id,child_holiday_key' })
    .select('*')
    .single();
  if (error) throw error;
  return normalizeMapping(data);
}

module.exports = {
  buildChildHolidayKey,
  fetchActiveMappings,
  markMappingDeleted,
  markMappingFailed,
  normalizeMapping,
  upsertMapping,
};
