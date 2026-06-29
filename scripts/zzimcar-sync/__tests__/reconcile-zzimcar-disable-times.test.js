const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyAddition,
  applyReplacement,
  applyDeletion,
  applyMissingDisableTimeRecovery,
  buildMapByImsReservationId,
  fetchCurrentZzimcarDisableTimeRows,
  findDisableTimeForMapping,
  findSharedActiveDisableTimeMappings,
  hasChanged,
  isDuplicateDisableTimeError,
  planReconcile,
  upsertMappingsForDesired,
} = require('../lib/reconcile-zzimcar-disable-times');

test('buildMapByImsReservationId indexes rows by IMS id plus child block key', () => {
  const map = buildMapByImsReservationId([
    { imsReservationId: 'A1', childBlockKey: 'A1:child-1', carNumber: '101하9257' },
    { imsReservationId: 'A1', childBlockKey: 'A1:child-2', carNumber: '201하0001' },
  ]);
  assert.equal(map.get('A1:A1:child-1').carNumber, '101하9257');
  assert.equal(map.get('A1:A1:child-2').carNumber, '201하0001');
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

test('planReconcile splits create/delete/replace/unchanged correctly', () => {
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
  assert.equal(plan.replacements.length, 1);
  assert.equal(plan.replacements[0].desired.imsReservationId, 'A2');
  assert.equal(plan.deletions.length, 1);
  assert.equal(plan.deletions[0].actual.imsReservationId, 'A4');
  assert.equal(plan.unchanged.length, 1);
  assert.equal(plan.unchanged[0].desired.imsReservationId, 'A1');
});

test('planReconcile plans no replacement when clustered desired exactly matches actual interval', () => {
  const desiredRows = [
    {
      imsReservationId: 'A1',
      sourceImsReservationIds: ['A1', 'A2'],
      carNumber: '101하9257',
      startAt: '2026-06-20T00:00:00.000Z',
      endAt: '2026-07-23T00:00:00.000Z',
    },
  ];
  const actualRows = [
    { imsReservationId: 'A1', carNumber: '101하9257', startAt: '2026-06-20T00:00:00.000Z', endAt: '2026-07-23T00:00:00.000Z', zzimcarVehiclePid: '10', zzimcarDisableTimePid: '20' },
  ];

  const plan = planReconcile({ desiredRows, actualRows });

  assert.equal(plan.replacements.length, 0);
  assert.equal(plan.unchanged.length, 1);
  assert.equal(plan.unchanged[0].desired.sourceImsReservationIds.length, 2);
});

test('planReconcile plans replace when clustered desired overlaps actual but end differs', () => {
  const desiredRows = [
    {
      imsReservationId: 'A1',
      sourceImsReservationIds: ['A1', 'A2'],
      carNumber: '101하9257',
      zzimcarVehiclePid: '10',
      startAt: '2026-06-20T00:00:00.000Z',
      endAt: '2026-07-23T00:00:00.000Z',
    },
  ];
  const actualRows = [
    { imsReservationId: 'A1', carNumber: '101하9257', startAt: '2026-06-20T00:00:00.000Z', endAt: '2026-07-20T00:00:00.000Z', zzimcarVehiclePid: '10', zzimcarDisableTimePid: '20' },
  ];

  const plan = planReconcile({ desiredRows, actualRows });

  assert.equal(plan.replacements.length, 1);
  assert.equal(plan.replacements[0].desired.sourceImsReservationIds.length, 2);
  assert.equal(plan.replacements[0].actual.zzimcarDisableTimePid, '20');
  assert.equal(plan.deletions.length, 0);
});


test('fetchCurrentZzimcarDisableTimeRows reads current zzimcar disable_times using previous vehicle pid hint', async () => {
  const calls = [];
  const rows = await fetchCurrentZzimcarDisableTimeRows({
    desiredRows: [{ imsReservationId: 'A1', carNumber: '101하9257', startAt: '2026-06-20T00:00:00.000Z', endAt: '2026-07-23T00:00:00.000Z' }],
    previousMappings: [{ carNumber: '101하9257', zzimcarVehiclePid: '10' }],
    client: {
      async findVehicleByCarNumber() {
        calls.push('findVehicleByCarNumber');
        return { vehiclePid: 'unexpected' };
      },
      async getDisableTimes({ vehiclePid }) {
        calls.push(['getDisableTimes', vehiclePid]);
        return [{ pid: '20', startDtime: '2026-06-20 09:00:00', endDtime: '2026-07-23 09:00:00' }];
      },
    },
  });

  assert.deepEqual(calls, [['getDisableTimes', '10']]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].imsReservationId, 'zzimcar-disable-time:20');
  assert.equal(rows[0].zzimcarDisableTimePid, '20');
  assert.equal(rows[0].startAt, '2026-06-20T00:00:00.000Z');
  assert.equal(rows[0].endAt, '2026-07-23T00:00:00.000Z');
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


test('findDisableTimeForMapping matches by pid or exact window', () => {
  const actual = {
    imsReservationId: 'A1',
    zzimcarVehiclePid: '22304',
    zzimcarDisableTimePid: 'P1',
    startAt: '2026-05-01T01:00:00.000Z',
    endAt: '2026-05-01T02:00:00.000Z',
  };
  const byPid = findDisableTimeForMapping({
    actual,
    disableTimes: [{ pid: 'P1', startDtime: '2026-05-02 10:00:00', endDtime: '2026-05-02 11:00:00' }],
  });
  assert.equal(byPid.pid, 'P1');

  const byWindow = findDisableTimeForMapping({
    actual: { ...actual, zzimcarDisableTimePid: 'missing' },
    disableTimes: [{ pid: 'P2', startDtime: '2026-05-01 10:00:00', endDtime: '2026-05-01 11:00:00' }],
  });
  assert.equal(byWindow.pid, 'P2');
});

test('applyMissingDisableTimeRecovery creates disable time when active mapping pid is missing in zzimcar', async () => {
  const desired = {
    imsReservationId: 'A1',
    carNumber: '101하9257',
    startAt: '2026-05-01T01:00:00.000Z',
    endAt: '2026-05-01T02:00:00.000Z',
  };
  const actual = {
    imsReservationId: 'A1',
    carNumber: '101하9257',
    zzimcarVehiclePid: '22304',
    zzimcarDisableTimePid: 'old-pid',
    startAt: desired.startAt,
    endAt: desired.endAt,
  };
  const client = {
    async getDisableTimes() {
      return [];
    },
    async createDisableTime(payload) {
      assert.deepEqual(payload, {
        vehiclePid: '22304',
        startDtime: '2026-05-01 10:00:00',
        endDtime: '2026-05-01 11:00:00',
      });
      return { disableTimePid: 'new-pid' };
    },
  };

  const result = await applyMissingDisableTimeRecovery({ desired, actual, client, shouldSave: true });
  assert.equal(result.recovered, true);
  assert.equal(result.disableTimePid, 'new-pid');
  assert.equal(result.createResult.disableTimePid, 'new-pid');
});

test('applyMissingDisableTimeRecovery does not create when mapped disable time exists', async () => {
  let createCalled = false;
  const desired = {
    imsReservationId: 'A1',
    carNumber: '101하9257',
    startAt: '2026-05-01T01:00:00.000Z',
    endAt: '2026-05-01T02:00:00.000Z',
  };
  const actual = {
    imsReservationId: 'A1',
    zzimcarVehiclePid: '22304',
    zzimcarDisableTimePid: 'existing-pid',
    startAt: desired.startAt,
    endAt: desired.endAt,
  };
  const client = {
    async getDisableTimes() {
      return [{ pid: 'existing-pid', startDtime: '2026-05-01 10:00:00', endDtime: '2026-05-01 11:00:00' }];
    },
    async createDisableTime() {
      createCalled = true;
    },
  };

  const result = await applyMissingDisableTimeRecovery({ desired, actual, client, shouldSave: true });
  assert.equal(createCalled, false);
  assert.equal(result.recovered, false);
  assert.equal(result.disableTimePid, 'existing-pid');
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


test('applyReplacement dry-run reports delete target and create payload without external write', async () => {
  let externalWriteCalled = false;
  const desired = {
    imsReservationId: 'A1',
    sourceImsReservationIds: ['A1', 'A2'],
    carNumber: '101하9257',
    zzimcarVehiclePid: '10',
    startAt: '2026-06-20T00:00:00.000Z',
    endAt: '2026-07-23T00:00:00.000Z',
  };
  const actual = {
    imsReservationId: 'A1',
    carNumber: '101하9257',
    zzimcarVehiclePid: '10',
    zzimcarDisableTimePid: '20',
    startAt: '2026-06-20T00:00:00.000Z',
    endAt: '2026-07-20T00:00:00.000Z',
  };
  const client = {
    async deleteDisableTime() {
      externalWriteCalled = true;
    },
    async createDisableTime() {
      externalWriteCalled = true;
    },
  };

  const result = await applyReplacement({ desired, actual, client, shouldSave: false });

  assert.equal(externalWriteCalled, false);
  assert.equal(result.action, 'replace');
  assert.equal(result.applied, false);
  assert.deepEqual(result.imsReservationIds, ['A1', 'A2']);
  assert.deepEqual(result.deleteTarget.pid, '20');
  assert.deepEqual(result.createPayload, {
    vehiclePid: '10',
    startDtime: '2026-06-20 09:00:00',
    endDtime: '2026-07-23 09:00:00',
  });
  assert.deepEqual(result.order, ['delete', 'create']);
});

function createMockMappingSupabase(upserts = []) {
  return {
    from(table) {
      assert.equal(table, 'zzimcar_disable_time_sync_mappings');
      return {
        upsert(row, options = {}) {
          upserts.push({ row, options });
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({ data: { id: row.ims_reservation_id, ...row }, error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}

test('applyReplacement save-run deletes old, creates desired, and upserts clustered mappings', async () => {
  const calls = [];
  const upserts = [];
  const desired = {
    imsReservationId: 'A1',
    sourceImsReservationIds: ['A1', 'A2'],
    carNumber: '101하9257',
    zzimcarVehiclePid: '10',
    startAt: '2026-06-20T00:00:00.000Z',
    endAt: '2026-07-23T00:00:00.000Z',
  };
  const actual = {
    imsReservationId: 'A1',
    carNumber: '101하9257',
    zzimcarVehiclePid: '10',
    zzimcarDisableTimePid: '20',
    startAt: '2026-06-20T00:00:00.000Z',
    endAt: '2026-07-20T00:00:00.000Z',
  };
  const client = {
    async deleteDisableTime({ pid }) {
      calls.push(['delete', pid]);
      return { deleted: pid };
    },
    async createDisableTime(payload) {
      calls.push(['create', payload]);
      return { disableTimePid: '30' };
    },
  };

  const result = await applyReplacement({
    desired,
    actual,
    client,
    shouldSave: true,
    supabaseClient: createMockMappingSupabase(upserts),
  });

  assert.deepEqual(calls.map(([name]) => name), ['delete', 'create']);
  assert.equal(calls[0][1], '20');
  assert.equal(calls[1][1].endDtime, '2026-07-23 09:00:00');
  assert.equal(result.applied, true);
  assert.equal(result.disableTimePid, '30');
  assert.deepEqual(upserts.map(({ row }) => row.ims_reservation_id), ['A1', 'A2']);
  assert.deepEqual([...new Set(upserts.map(({ row }) => row.zzimcar_disable_time_pid))], ['30']);
});

test('applyReplacement rolls back previous actual window when desired create fails after delete', async () => {
  const calls = [];
  const events = [];
  const upserts = [];
  const desired = {
    imsReservationId: 'A1',
    sourceImsReservationIds: ['A1', 'A2'],
    carNumber: '101하9257',
    zzimcarVehiclePid: '10',
    startAt: '2026-06-20T00:00:00.000Z',
    endAt: '2026-07-23T00:00:00.000Z',
  };
  const actual = {
    imsReservationId: 'A1',
    carNumber: '101하9257',
    zzimcarVehiclePid: '10',
    zzimcarDisableTimePid: '20',
    startAt: '2026-06-20T00:00:00.000Z',
    endAt: '2026-07-20T00:00:00.000Z',
  };
  const client = {
    async deleteDisableTime({ pid }) {
      calls.push(['delete', pid]);
      return { deleted: pid };
    },
    async createDisableTime(payload) {
      calls.push(['create', payload]);
      if (calls.filter(([name]) => name === 'create').length === 1) {
        throw new Error('desired create failed');
      }
      return { disableTimePid: 'rollback-30' };
    },
  };

  const result = await applyReplacement({
    desired,
    actual,
    client,
    shouldSave: true,
    supabaseClient: createMockMappingSupabase(upserts),
    eventLogger: (event) => events.push(event),
  });

  assert.deepEqual(calls.map(([name]) => name), ['delete', 'create', 'create']);
  assert.equal(calls[2][1].endDtime, '2026-07-20 09:00:00');
  assert.equal(result.applied, false);
  assert.equal(result.rollback.success, true);
  assert.equal(result.rollback.disableTimePid, 'rollback-30');
  assert.equal(result.requiresManualConfirm, true);
  assert.deepEqual([...new Set(upserts.map(({ row }) => row.zzimcar_disable_time_pid))], ['rollback-30']);
  assert.equal(events.length, 1);
  assert.equal(events[0].action, 'replace_disable_time_rollback_succeeded');
  assert.equal(events[0].requiresAck, true);
});

test('applyReplacement emits manual recovery error when desired create and rollback fail', async () => {
  const events = [];
  const desired = {
    imsReservationId: 'A1',
    sourceImsReservationIds: ['A1', 'A2'],
    carNumber: '101하9257',
    zzimcarVehiclePid: '10',
    startAt: '2026-06-20T00:00:00.000Z',
    endAt: '2026-07-23T00:00:00.000Z',
  };
  const actual = {
    imsReservationId: 'A1',
    carNumber: '101하9257',
    zzimcarVehiclePid: '10',
    zzimcarDisableTimePid: '20',
    startAt: '2026-06-20T00:00:00.000Z',
    endAt: '2026-07-20T00:00:00.000Z',
  };
  const client = {
    async deleteDisableTime() {
      return { ok: true };
    },
    async createDisableTime() {
      throw new Error('create failed');
    },
  };

  await assert.rejects(
    applyReplacement({
      desired,
      actual,
      client,
      shouldSave: true,
      supabaseClient: createMockMappingSupabase([]),
      eventLogger: (event) => events.push(event),
    }),
    /rollback failed/,
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].action, 'replace_disable_time_rollback_failed');
  assert.equal(events[0].severity, 'error');
  assert.equal(events[0].requiresAck, true);
  assert.equal(events[0].metadata.previousActual.zzimcarDisableTimePid, '20');
});

test('upsertMappingsForDesired lets clustered IMS reservation ids share one disable time pid', async () => {
  const upserts = [];
  const supabaseClient = {
    from(table) {
      assert.equal(table, 'zzimcar_disable_time_sync_mappings');
      return {
        upsert(row, options = {}) {
          upserts.push({ row, options });
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({ data: { id: row.ims_reservation_id, ...row }, error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  const rows = await upsertMappingsForDesired({
    desired: {
      imsReservationId: 'A1',
      sourceImsReservationIds: ['A1', 'A2'],
      carNumber: '101하9257',
      startAt: '2026-06-20T00:00:00.000Z',
      endAt: '2026-07-23T00:00:00.000Z',
    },
    vehiclePid: '10',
    disableTimePid: '20',
    supabaseClient,
  });

  assert.equal(rows.length, 2);
  assert.deepEqual(upserts.map(({ row }) => row.ims_reservation_id), ['A1', 'A2']);
  assert.deepEqual([...new Set(upserts.map(({ row }) => row.zzimcar_disable_time_pid))], ['20']);
  assert.deepEqual([...new Set(upserts.map(({ row }) => row.start_at))], ['2026-06-20T00:00:00.000Z']);
  assert.deepEqual([...new Set(upserts.map(({ row }) => row.end_at))], ['2026-07-23T00:00:00.000Z']);
  assert.deepEqual([...new Set(upserts.map(({ options }) => options.onConflict))], ['ims_reservation_id,child_block_key']);
});

test('planReconcile splits desired child blocks around unmanaged wall with one hour boundary gap', () => {
  const desiredRows = [{
    imsReservationId: 'A1',
    sourceImsReservationIds: ['A1', 'A2'],
    carNumber: '101하9257',
    zzimcarVehiclePid: '10',
    startAt: '2026-06-22T00:00:00.000Z',
    endAt: '2026-07-01T00:00:00.000Z',
  }];
  const unmanagedWalls = [{
    imsReservationId: 'zzimcar-disable-time:W1',
    carNumber: '101하9257',
    zzimcarVehiclePid: '10',
    zzimcarDisableTimePid: 'W1',
    startAt: '2026-06-30T00:00:00.000Z',
    endAt: '2026-07-05T00:00:00.000Z',
  }];

  const plan = planReconcile({ desiredRows, actualRows: [], unmanagedWalls });

  assert.equal(plan.additions.length, 1);
  assert.equal(plan.additions[0].desired.startAt, '2026-06-22T00:00:00.000Z');
  assert.equal(plan.additions[0].desired.endAt, '2026-06-29T23:00:00.000Z');
  assert.deepEqual(plan.additions[0].desired.sourceImsReservationIds, ['A1', 'A2']);
  assert.equal(plan.deletions.length, 0);
  assert.equal(plan.replacements.length, 0);
});

test('classifyZzimcarActualRows keeps previous mappings managed and current unmapped disable_times as unmanaged walls', () => {
  const { classifyZzimcarActualRows } = require('../lib/reconcile-zzimcar-disable-times');
  const previousMappings = [{
    imsReservationId: 'A1',
    carNumber: '101하9257',
    zzimcarVehiclePid: '10',
    zzimcarDisableTimePid: 'M1',
    startAt: '2026-06-22T00:00:00.000Z',
    endAt: '2026-06-29T23:00:00.000Z',
  }];
  const currentRows = [
    { imsReservationId: 'zzimcar-disable-time:M1', carNumber: '101하9257', zzimcarVehiclePid: '10', zzimcarDisableTimePid: 'M1', startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-06-29T23:00:00.000Z', source: 'zzimcar_disable_time' },
    { imsReservationId: 'zzimcar-disable-time:W1', carNumber: '101하9257', zzimcarVehiclePid: '10', zzimcarDisableTimePid: 'W1', startAt: '2026-06-30T00:00:00.000Z', endAt: '2026-07-05T00:00:00.000Z', source: 'zzimcar_disable_time' },
  ];

  const result = classifyZzimcarActualRows({ currentRows, previousMappings });

  assert.deepEqual(result.managedActualRows, previousMappings);
  assert.equal(result.unmanagedWalls.length, 1);
  assert.equal(result.unmanagedWalls[0].zzimcarDisableTimePid, 'W1');
  assert.equal(result.unmanagedWalls[0].unmanaged, true);
});


test('planReconcile keeps multiple zzimcar child block additions for same IMS coverage', () => {
  const desiredRows = [{
    imsReservationId: 'A1',
    sourceImsReservationIds: ['A1'],
    carNumber: '101하9257',
    zzimcarVehiclePid: '10',
    startAt: '2026-06-21T15:00:00.000Z',
    endAt: '2026-07-10T15:00:00.000Z',
  }];
  const unmanagedWalls = [{
    carNumber: '101하9257',
    zzimcarVehiclePid: '10',
    startAt: '2026-06-29T15:00:00.000Z',
    endAt: '2026-07-04T15:00:00.000Z',
    unmanaged: true,
  }];

  const plan = planReconcile({ desiredRows, actualRows: [], unmanagedWalls, boundaryGapHours: 1 });

  assert.equal(plan.additions.length, 2);
  assert.deepEqual(plan.additions.map((entry) => [entry.desired.startAt, entry.desired.endAt]), [
    ['2026-06-21T15:00:00.000Z', '2026-06-29T14:00:00.000Z'],
    ['2026-07-04T15:00:00.000Z', '2026-07-10T15:00:00.000Z'],
  ]);
  assert.notEqual(plan.additions[0].desired.childBlockKey, plan.additions[1].desired.childBlockKey);
});

test('upsertMappingsForDesired preserves distinct child block keys for same IMS reservation', async () => {
  const upserts = [];
  const supabaseClient = createMockMappingSupabase(upserts);

  await upsertMappingsForDesired({
    desired: { imsReservationId: 'A1', sourceImsReservationIds: ['A1'], childBlockKey: 'A1:left', carNumber: '101하9257', startAt: '2026-06-21T15:00:00.000Z', endAt: '2026-06-29T14:00:00.000Z' },
    vehiclePid: '10',
    disableTimePid: '20',
    supabaseClient,
  });
  await upsertMappingsForDesired({
    desired: { imsReservationId: 'A1', sourceImsReservationIds: ['A1'], childBlockKey: 'A1:right', carNumber: '101하9257', startAt: '2026-07-04T15:00:00.000Z', endAt: '2026-07-10T15:00:00.000Z' },
    vehiclePid: '10',
    disableTimePid: '21',
    supabaseClient,
  });

  assert.deepEqual(upserts.map(({ row }) => row.child_block_key), ['A1:left', 'A1:right']);
  assert.deepEqual(upserts.map(({ options }) => options.onConflict), ['ims_reservation_id,child_block_key', 'ims_reservation_id,child_block_key']);
});
