const { getSupabaseAdmin } = require('../../ims-sync/lib/supabase-admin');
const { normalizeCarNumber } = require('./disable-time');

const ACTIVE_IMS_STATUSES = new Set(['pending', 'confirmed', 'paid']);
const INACTIVE_IMS_STATUSES = new Set(['cancelled', 'completed', 'failed']);
const STATUS_PRIORITY = new Map([
  ['paid', 3],
  ['confirmed', 2],
  ['pending', 1],
]);

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

function overlapsReservationWindow(left, right) {
  if (!left || !right) return false;
  return new Date(left.startAt).getTime() < new Date(right.endAt).getTime()
    && new Date(left.endAt).getTime() > new Date(right.startAt).getTime();
}

function getStatusPriority(status) {
  return STATUS_PRIORITY.get(String(status || '').trim().toLowerCase()) || 0;
}

function choosePreferredDesiredReservation(current, candidate) {
  const currentEnd = new Date(current.endAt).getTime();
  const candidateEnd = new Date(candidate.endAt).getTime();
  if (candidateEnd !== currentEnd) {
    return candidateEnd > currentEnd ? candidate : current;
  }

  const currentPriority = getStatusPriority(current.status);
  const candidatePriority = getStatusPriority(candidate.status);
  if (candidatePriority !== currentPriority) {
    return candidatePriority > currentPriority ? candidate : current;
  }

  const currentStart = new Date(current.startAt).getTime();
  const candidateStart = new Date(candidate.startAt).getTime();
  if (candidateStart !== currentStart) {
    return candidateStart < currentStart ? candidate : current;
  }

  return String(candidate.imsReservationId) > String(current.imsReservationId) ? candidate : current;
}

function collapseOverlappingReservationsByCar(rows = []) {
  const sorted = [...rows].sort((a, b) => {
    const carCompare = String(a.carNumber).localeCompare(String(b.carNumber));
    if (carCompare !== 0) return carCompare;
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  });

  const collapsed = [];
  for (const row of sorted) {
    const last = collapsed[collapsed.length - 1];
    if (last && last.carNumber === row.carNumber && overlapsReservationWindow(last, row)) {
      collapsed[collapsed.length - 1] = choosePreferredDesiredReservation(last, row);
      continue;
    }
    collapsed.push(row);
  }
  return collapsed;
}

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
  choosePreferredDesiredReservation,
  collapseOverlappingReservationsByCar,
};
