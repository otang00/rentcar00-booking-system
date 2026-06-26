const crypto = require('crypto');

function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function assertValidScheduleWindow({ imsReservationId, startAt, endAt }) {
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error(`schedule start/end is invalid for ${imsReservationId}`);
  }

  if (endMs <= startMs) {
    throw new Error(`schedule end_at must be after start_at for ${imsReservationId}`);
  }
}

function mapImsStatus(rawStatus) {
  const value = String(rawStatus || '').toLowerCase();

  if (!value) return 'pending';
  if (value.includes('cancel')) return 'cancelled';
  if (value.includes('complete') || value.includes('returned') || value.includes('done')) return 'completed';
  if (value.includes('fail')) return 'failed';
  if (value.includes('paid')) return 'paid';
  if (value.includes('confirm') || value.includes('using') || value.includes('reserve')) return 'confirmed';
  return 'pending';
}

function deriveDeliveryAddress(detail = {}) {
  return detail.pickup_address || detail.dropoff_address || null;
}

function normalizeSchedule(schedule, rawPayloadRefId = null) {
  if (!schedule || typeof schedule !== 'object') {
    throw new Error('schedule payload is required');
  }

  const imsReservationId = schedule.id != null ? String(schedule.id) : null;
  const rawStatus = schedule.status != null ? String(schedule.status) : null;
  const carId = schedule.car?.id != null ? String(schedule.car.id) : null;
  const startAt = toIsoOrNull(schedule.start_at);
  const endAt = toIsoOrNull(schedule.end_at);

  if (!imsReservationId) {
    throw new Error('schedule.id is required');
  }
  if (!rawStatus) {
    throw new Error(`schedule.status is required for ${imsReservationId}`);
  }
  if (!carId) {
    throw new Error(`schedule.car.id is required for ${imsReservationId}`);
  }
  if (!startAt || !endAt) {
    throw new Error(`schedule start/end is invalid for ${imsReservationId}`);
  }
  assertValidScheduleWindow({ imsReservationId, startAt, endAt });

  const detail = schedule.detail || {};
  const normalizedStatus = mapImsStatus(rawStatus);

  return {
    ims_reservation_id: imsReservationId,
    source: 'ims',
    source_updated_at: null,
    car_id: carId,
    car_number: schedule.car?.car_identity != null ? String(schedule.car.car_identity) : null,
    car_group_id: schedule.car?.car_group_id != null ? String(schedule.car.car_group_id) : null,
    status: normalizedStatus,
    status_raw: rawStatus,
    pickup_option: detail.type != null ? String(detail.type) : null,
    delivery_region_id: null,
    pickup_address: detail.pickup_address || null,
    dropoff_address: detail.dropoff_address || null,
    delivery_address: deriveDeliveryAddress(detail),
    customer_name: detail.customer_name || null,
    customer_phone: detail.customer_contact || null,
    start_at: startAt,
    end_at: endAt,
    cancelled_at: normalizedStatus === 'cancelled' ? new Date().toISOString() : null,
    confirmed_at: ['confirmed', 'paid', 'completed'].includes(normalizedStatus) ? startAt : null,
    quoted_price_snapshot: null,
    confirmed_price_snapshot: null,
    raw_payload_ref_id: rawPayloadRefId,
    last_synced_at: new Date().toISOString(),
  };
}

function buildRawReservationRow(schedule, syncRunId) {
  if (!syncRunId) {
    throw new Error('syncRunId is required');
  }

  const imsReservationId = schedule?.id != null ? String(schedule.id) : null;
  if (!imsReservationId) {
    throw new Error('schedule.id is required');
  }

  return {
    sync_run_id: syncRunId,
    ims_reservation_id: imsReservationId,
    ims_status: schedule?.status != null ? String(schedule.status) : null,
    ims_updated_at: null,
    payload: schedule,
    payload_hash: hashPayload(schedule),
    parse_status: 'pending',
    parse_error: null,
  };
}

module.exports = {
  buildRawReservationRow,
  hashPayload,
  mapImsStatus,
  normalizeSchedule,
  toIsoOrNull,
  assertValidScheduleWindow,
};
