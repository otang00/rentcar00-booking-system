const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyAddition,
  applyDeletion,
  buildMapByImsReservationId,
  findSharedActiveDisableTimeMappings,
  hasChanged,
  isDuplicateDisableTimeError,
  planReconcile,
} = require('../lib/reconcile-zzimcar-disable-times');

test('buildMapByImsReservationId indexes rows by imsReservationId', () => {
  const map = buildMapByImsReservationId([
    { imsReservationId: 'A1', carNumber: '101하9257' },
    { imsReservationId: 'A2', carNumber: '201하0001' },
  ]);
  assert.equal(map.get('A1').carNumber, '101하9257');
  assert.equal(map.get('A2').carNumber, '201하0001');
});

test('hasChanged detects start_at difference', () => {
  assert.equal(hasChanged(
    { imsReservationId: 'A1', carNumber: '101하9257', startAt: '2026-05-01T01:00:00.000Z', endAt: '2026-05-02T01:00:00.000Z' },
    { imsReservationId: 'A1', carNumber: '101하9257', startAt: '2026-05-01T02:00:00.000Z', endAt: '2026-05-02T01:00:00.000Z', zzimcarVehiclePid: '10', zzimcarDisableTimePid: '20' },
  ), true);
});

test('hasChanged detects incomplete active mapping', () => {
  assert.equal(hasChanged(
    { imsReservationId: 'A1', carNumber: '101하9257', startAt: '2026-05-01T01:00:00.000Z', endAt: '2026-05-02T01:00:00.000Z' },
    { imsReservationId: 'A1', carNumber: '101하9257', startAt: '2026-05-01T01:00:00.000Z', endAt: '2026-05-02T01:00:00.000Z', zzimcarVehiclePid: '10', zzimcarDisableTimePid: null },
  ), true);
});

test('planReconcile splits add/delete/change/unchanged correctly', () => {
  const desiredRows = [
    { imsReservationId: 'A1', carNumber: '101하9257', startAt: '2026-05-01T01:00:00.000Z', endAt: '2026-05-02T01:00:00.000Z' },
    { imsReservationId: 'A2', carNumber: '201하0001', startAt: '2026-05-03T01:00:00.000Z', endAt: '2026-05-04T01:00:00.000Z' },
    { imsReservationId: 'A3', carNumber: '301하0002', startAt: '2026-05-05T01:00:00.000Z', endAt: '2026-05-06T01:00:00.000Z' },
  ];
  const actualRows = [
    { imsReservationId: 'A1', carNumber: '101하9257', startAt: '2026-05-01T01:00:00.000Z', endAt: '2026-05-02T01:00:00.000Z', zzimcarVehiclePid: '10', zzimcarDisableTimePid: '20' },
    { imsReservationId: 'A2', carNumber: '201하0001', startAt: '2026-05-03T02:00:00.000Z', endAt: '2026-05-04T01:00:00.000Z', zzimcarVehiclePid: '11', zzimcarDisableTimePid: '21' },
    { imsReservationId: 'A4', carNumber: '401하0003', startAt: '2026-05-07T01:00:00.000Z', endAt: '2026-05-08T01:00:00.000Z', zzimcarVehiclePid: '12', zzimcarDisableTimePid: '22' },
  ];

  const plan = planReconcile({ desiredRows, actualRows });
  assert.equal(plan.additions.length, 1);
  assert.equal(plan.additions[0].desired.imsReservationId, 'A3');
  assert.equal(plan.changes.length, 1);
  assert.equal(plan.changes[0].desired.imsReservationId, 'A2');
  assert.equal(plan.deletions.length, 1);
  assert.equal(plan.deletions[0].actual.imsReservationId, 'A4');
  assert.equal(plan.unchanged.length, 1);
  assert.equal(plan.unchanged[0].desired.imsReservationId, 'A1');
});


test('findSharedActiveDisableTimeMappings finds other active mappings using same disable time pid', () => {
  const actual = { imsReservationId: 'A1', zzimcarDisableTimePid: 'P1' };
  const actualRows = [
    { imsReservationId: 'A1', zzimcarDisableTimePid: 'P1', syncStatus: 'active' },
    { imsReservationId: 'A2', zzimcarDisableTimePid: 'P1', syncStatus: 'active' },
    { imsReservationId: 'A3', zzimcarDisableTimePid: 'P1', syncStatus: 'deleted' },
    { imsReservationId: 'A4', zzimcarDisableTimePid: 'P2', syncStatus: 'active' },
  ];

  const shared = findSharedActiveDisableTimeMappings({ actual, actualRows });
  assert.equal(shared.length, 1);
  assert.equal(shared[0].imsReservationId, 'A2');
});

test('applyDeletion skips zzimcar delete when another active mapping shares same disable time pid', async () => {
  let deleteCalled = false;
  const actual = { imsReservationId: 'A1', zzimcarDisableTimePid: 'P1' };
  const actualRows = [
    actual,
    { imsReservationId: 'A2', zzimcarDisableTimePid: 'P1', syncStatus: 'active' },
  ];
  const client = {
    async deleteDisableTime() {
      deleteCalled = true;
    },
  };

  const result = await applyDeletion({ actual, actualRows, client, shouldSave: true });
  assert.equal(deleteCalled, false);
  assert.equal(result.skippedZzimcarDelete, true);
  assert.equal(result.sharedActiveMappings.length, 1);
  assert.equal(result.deleteResult, null);
});

test('applyDeletion deletes zzimcar disable time when no other active mapping shares pid', async () => {
  let deletedPid = null;
  const actual = { imsReservationId: 'A1', zzimcarDisableTimePid: 'P1' };
  const actualRows = [
    actual,
    { imsReservationId: 'A2', zzimcarDisableTimePid: 'P1', syncStatus: 'deleted' },
  ];
  const client = {
    async deleteDisableTime({ pid }) {
      deletedPid = pid;
      return { ok: true };
    },
  };

  const result = await applyDeletion({ actual, actualRows, client, shouldSave: true });
  assert.equal(deletedPid, 'P1');
  assert.equal(result.skippedZzimcarDelete, false);
  assert.deepEqual(result.deleteResult, { ok: true });
});

test('isDuplicateDisableTimeError detects zzimcar duplicate message', () => {
  assert.equal(isDuplicateDisableTimeError(new Error('Disable time create failed: HTTP 400 [VEHICLE_SCHEDULE_DUPLICATION_ERROR] 차량 스케줄이 중복되었습니다.')), true);
  assert.equal(isDuplicateDisableTimeError(new Error('Disable time create failed: HTTP 400')), false);
});

test('applyAddition recovers pid from exact disable time on duplicate error', async () => {
  const desired = {
    imsReservationId: 'A9',
    carNumber: '101하9257',
    startAt: '2026-05-01T01:00:00.000Z',
    endAt: '2026-05-01T02:00:00.000Z',
  };

  const client = {
    async findVehicleByCarNumber() {
      return { vehiclePid: '22304' };
    },
    async createDisableTime() {
      throw new Error('Disable time create failed: HTTP 400 [VEHICLE_SCHEDULE_DUPLICATION_ERROR] 차량 스케줄이 중복되었습니다.');
    },
    async getDisableTimes() {
      return [
        { pid: '219999', startDtime: '2026-05-01 10:00:00', endDtime: '2026-05-01 11:00:00' },
      ];
    },
  };

  const result = await applyAddition({ desired, client, shouldSave: true });
  assert.equal(result.disableTimePid, '219999');
  assert.equal(result.createResult.duplicateRecovered, true);
});
