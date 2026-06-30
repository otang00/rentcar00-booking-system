function requireNoWriteAllowed({ save = false, noWriteSmoke = false } = {}) {
  if (save && noWriteSmoke) throw new Error('save and noWriteSmoke cannot be used together');
  if (save) {
    throw new Error('External vehicle state save-run is disabled until explicit operator approval and DB migration apply are complete. Use --no-write-smoke.');
  }
}

function toCarmoreRow(plan) {
  return {
    car_number: plan.carNumber,
    local_car_id: plan.localCarId || null,
    ims_car_id: plan.imsCarId || null,
    carmore_rentcar_serial: String(plan.carmoreRentcarSerial),
    observed_app_flag: plan.observedAppFlag,
    observed_month_flag: plan.observedMonthFlag,
    decided_app_flag: plan.decidedAppFlag,
    decided_month_flag: plan.decidedMonthFlag,
    applied_app_flag: plan.appliedAppFlag,
    applied_month_flag: plan.appliedMonthFlag,
    active_monthly_reservation_ids: plan.activeMonthlyReservationIds || [],
    reason: plan.reasons || [],
    sync_status: plan.action === 'unchanged' ? 'skipped' : 'planned',
    last_synced_at: null,
    last_error: null,
    metadata: { action: plan.action },
  };
}

function toZzimcarRow(plan) {
  return {
    car_number: plan.carNumber,
    local_car_id: plan.localCarId || null,
    ims_car_id: plan.imsCarId || null,
    zzimcar_vehicle_pid: String(plan.zzimcarVehiclePid),
    observed_is_publish: plan.observedIsPublish,
    decided_is_publish: plan.decidedIsPublish,
    applied_is_publish: plan.appliedIsPublish,
    active_monthly_reservation_ids: plan.activeMonthlyReservationIds || [],
    reason: plan.reasons || [],
    sync_status: plan.action === 'unchanged' ? 'skipped' : 'planned',
    last_synced_at: null,
    last_error: null,
    metadata: { action: plan.action },
  };
}

async function upsertCarmoreVehicleStatePlans({ supabase, plans = [], save = false, noWriteSmoke = false } = {}) {
  requireNoWriteAllowed({ save, noWriteSmoke });
  const rows = plans.map(toCarmoreRow);
  if (noWriteSmoke || rows.length === 0) return { skipped: true, rows };
  const { data, error } = await supabase
    .from('carmore_vehicle_state_sync_mappings')
    .upsert(rows, { onConflict: 'carmore_rentcar_serial' })
    .select('*');
  if (error) throw error;
  return { skipped: false, rows: data || [] };
}

async function upsertZzimcarVehicleStatePlans({ supabase, plans = [], save = false, noWriteSmoke = false } = {}) {
  requireNoWriteAllowed({ save, noWriteSmoke });
  const rows = plans.map(toZzimcarRow);
  if (noWriteSmoke || rows.length === 0) return { skipped: true, rows };
  const { data, error } = await supabase
    .from('zzimcar_vehicle_state_sync_mappings')
    .upsert(rows, { onConflict: 'zzimcar_vehicle_pid' })
    .select('*');
  if (error) throw error;
  return { skipped: false, rows: data || [] };
}

module.exports = {
  requireNoWriteAllowed,
  toCarmoreRow,
  toZzimcarRow,
  upsertCarmoreVehicleStatePlans,
  upsertZzimcarVehicleStatePlans,
};
