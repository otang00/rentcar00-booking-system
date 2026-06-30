const { getSupabaseAdmin } = require('../../ims-sync/lib/supabase-admin');
const {
  ACTIVE_IMS_STATUSES,
  INACTIVE_IMS_STATUSES,
  buildImsRequiredCoverage,
  buildRequiredCoverageCluster,
  getPrimaryImsReservationId,
  mergeRequiredCoverageCluster,
  overlapsRequiredCoverage,
} = require('../../sync-coverage/build-ims-required-coverage');
const { normalizeCarNumber } = require('./disable-time');

function isDesiredImsReservation(row, now = new Date()) {
  if (!row) return false;
  const status = String(row.status || '').trim().toLowerCase();
  if (!ACTIVE_IMS_STATUSES.has(status)) return false;
  if (!row.car_number) return false;
  const endAt = new Date(row.end_at);
  if (Number.isNaN(endAt.getTime())) return false;
  return endAt > now;
}

function normalizeDesiredReservation(row) {
  return {
    imsReservationId: String(row.ims_reservation_id),
    carNumber: normalizeCarNumber(row.car_number),
    startAt: row.start_at,
    endAt: row.end_at,
    status: String(row.status),
    raw: row,
  };
}

const overlapsReservationWindow = overlapsRequiredCoverage;
const buildBlockedIntervalCluster = buildRequiredCoverageCluster;
const mergeBlockedIntervalCluster = mergeRequiredCoverageCluster;
const collapseOverlappingReservationsByCar = buildImsRequiredCoverage;

async function fetchDesiredImsReservations({ now = new Date(), supabaseClient } = {}) {
  const supabase = supabaseClient || getSupabaseAdmin();
  const { data, error } = await supabase
    .from('ims_sync_reservations')
    .select('ims_reservation_id, car_number, start_at, end_at, status, status_raw, last_synced_at')
    .not('ims_reservation_id', 'is', null)
    .gt('end_at', now.toISOString())
    .in('status', Array.from(ACTIVE_IMS_STATUSES))
    .order('start_at', { ascending: true });

  if (error) throw error;
  const desiredRows = (Array.isArray(data) ? data : [])
    .filter((row) => isDesiredImsReservation(row, now))
    .map(normalizeDesiredReservation);
  return collapseOverlappingReservationsByCar(desiredRows);
}

module.exports = {
  ACTIVE_IMS_STATUSES,
  INACTIVE_IMS_STATUSES,
  fetchDesiredImsReservations,
  isDesiredImsReservation,
  normalizeDesiredReservation,
  overlapsReservationWindow,
  buildBlockedIntervalCluster,
  collapseOverlappingReservationsByCar,
  getPrimaryImsReservationId,
  mergeBlockedIntervalCluster,
};
