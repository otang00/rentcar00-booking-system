const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ACTIVE_IMS_STATUSES,
  INACTIVE_IMS_STATUSES,
  collapseOverlappingReservationsByCar,
  isDesiredImsReservation,
  normalizeDesiredReservation,
} = require('../lib/fetch-desired-ims-reservations');
const { mapImsStatus } = require('../../ims-sync/normalize-ims-reservation');


test('mapImsStatus treats using_car as confirmed blocking status', () => {
  assert.equal(mapImsStatus('using_car'), 'confirmed');
  assert.equal(ACTIVE_IMS_STATUSES.has(mapImsStatus('using_car')), true);
});

test('active IMS statuses remain desired while inactive statuses are excluded', () => {
  const now = new Date('2026-04-29T03:00:00.000Z');
  for (const status of ACTIVE_IMS_STATUSES) {
    assert.equal(isDesiredImsReservation({
      ims_reservation_id: `active-${status}`,
      car_number: '101하9257',
      status,
      end_at: '2026-04-29T05:00:00.000Z',
    }, now), true, `${status} should block zzimcar availability`);
  }

  for (const status of INACTIVE_IMS_STATUSES) {
    assert.equal(isDesiredImsReservation({
      ims_reservation_id: `inactive-${status}`,
      car_number: '101하9257',
      status,
      end_at: '2026-04-29T05:00:00.000Z',
    }, now), false, `${status} should not block zzimcar availability`);
  }
});

test('stale or missing last_synced_at does not release active future reservation', () => {
  const now = new Date('2026-04-29T03:00:00.000Z');
  assert.equal(isDesiredImsReservation({
    ims_reservation_id: 'A1',
    car_number: '101하9257',
    status: 'confirmed',
    end_at: '2026-04-29T05:00:00.000Z',
    last_synced_at: '2026-04-01T00:00:00.000Z',
  }, now), true);
});

test('isDesiredImsReservation accepts active future reservation', () => {
  const now = new Date('2026-04-29T03:00:00.000Z');
  assert.equal(isDesiredImsReservation({
    ims_reservation_id: 'A1',
    car_number: '101하9257',
    status: 'confirmed',
    end_at: '2026-04-29T05:00:00.000Z',
  }, now), true);
});

test('isDesiredImsReservation rejects cancelled reservation', () => {
  const now = new Date('2026-04-29T03:00:00.000Z');
  assert.equal(isDesiredImsReservation({
    ims_reservation_id: 'A1',
    car_number: '101하9257',
    status: 'cancelled',
    end_at: '2026-04-29T05:00:00.000Z',
  }, now), false);
});

test('normalizeDesiredReservation normalizes shape', () => {
  const result = normalizeDesiredReservation({
    ims_reservation_id: 77,
    car_number: '101하 9257',
    start_at: '2026-05-01T01:00:00.000Z',
    end_at: '2026-05-02T01:00:00.000Z',
    status: 'paid',
  });

  assert.deepEqual(result, {
    imsReservationId: '77',
    carNumber: '101하9257',
    startAt: '2026-05-01T01:00:00.000Z',
    endAt: '2026-05-02T01:00:00.000Z',
    status: 'paid',
    raw: {
      ims_reservation_id: 77,
      car_number: '101하 9257',
      start_at: '2026-05-01T01:00:00.000Z',
      end_at: '2026-05-02T01:00:00.000Z',
      status: 'paid',
    },
  });
});

function desired({ id, carNumber = '101하9257', startAt, endAt, status = 'confirmed' }) {
  return { imsReservationId: id, carNumber, startAt, endAt, status, raw: { id } };
}

test('collapseOverlappingReservationsByCar merges only actual overlaps into vehicle blocked interval clusters', () => {
  const rows = [
    desired({ id: 'A1', startAt: '2026-06-20T00:00:00.000Z', endAt: '2026-07-20T00:00:00.000Z' }),
    desired({ id: 'A2', startAt: '2026-07-07T00:00:00.000Z', endAt: '2026-07-23T00:00:00.000Z', status: 'paid' }),
    desired({ id: 'B1', startAt: '2026-07-23T00:00:00.000Z', endAt: '2026-07-24T00:00:00.000Z' }),
  ];

  const collapsed = collapseOverlappingReservationsByCar(rows);

  assert.equal(collapsed.length, 2);
  assert.deepEqual(collapsed[0].sourceImsReservationIds, ['A1', 'A2']);
  assert.equal(collapsed[0].imsReservationId, 'A1');
  assert.equal(collapsed[0].startAt, '2026-06-20T00:00:00.000Z');
  assert.equal(collapsed[0].endAt, '2026-07-23T00:00:00.000Z');
  assert.equal(collapsed[0].status, 'paid');
  assert.equal(collapsed[0].sourceReservations.length, 2);
  assert.deepEqual(collapsed[1].sourceImsReservationIds, ['B1']);
});

test('collapseOverlappingReservationsByCar does not merge adjacent intervals', () => {
  const rows = [
    desired({ id: 'A1', startAt: '2026-06-20T00:00:00.000Z', endAt: '2026-07-20T00:00:00.000Z' }),
    desired({ id: 'A2', startAt: '2026-07-20T00:00:00.000Z', endAt: '2026-07-23T00:00:00.000Z' }),
  ];

  const collapsed = collapseOverlappingReservationsByCar(rows);

  assert.equal(collapsed.length, 2);
  assert.deepEqual(collapsed.map((row) => row.sourceImsReservationIds), [['A1'], ['A2']]);
});

test('collapseOverlappingReservationsByCar recomputes remaining blocked interval after cancellation-like removal', () => {
  const activeRows = [
    desired({ id: 'A1', startAt: '2026-06-20T00:00:00.000Z', endAt: '2026-07-20T00:00:00.000Z' }),
    desired({ id: 'A2', startAt: '2026-07-07T00:00:00.000Z', endAt: '2026-07-23T00:00:00.000Z' }),
  ];
  const remainingRows = activeRows.filter((row) => row.imsReservationId !== 'A1');

  const [cluster] = collapseOverlappingReservationsByCar(remainingRows);

  assert.deepEqual(cluster.sourceImsReservationIds, ['A2']);
  assert.equal(cluster.startAt, '2026-07-07T00:00:00.000Z');
  assert.equal(cluster.endAt, '2026-07-23T00:00:00.000Z');
});
