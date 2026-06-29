const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyAddition,
  applyChange,
  applyDeletion,
  buildHolidayMemo,
  classifyCarmoreHolidayRows,
  createOrRecoverHoliday,
  fetchCurrentCarmoreUnmanagedWalls,
  findSharedActiveHolidayMappings,
  hasChanged,
  isDuplicateHolidayError,
  planReconcile,
} = require('../lib/reconcile-carmore-holidays');

test('buildHolidayMemo uses IMS reservation id', () => {
  assert.equal(buildHolidayMemo({ imsReservationId: 'A1' }), 'IMS A1');
});

test('hasChanged detects holiday date change and missing serial', () => {
  const desired = { imsReservationId: 'A1', carNumber: '101하9257', carmoreRentcarSerial: '100', startAt: 's', endAt: 'e', holidayStartDate: '2026-05-01', holidayEndDate: '2026-05-02' };
  assert.equal(hasChanged(desired, { ...desired, carmoreHolidaySerial: 'P1' }), false);
  assert.equal(hasChanged(desired, { ...desired, holidayEndDate: '2026-05-03', carmoreHolidaySerial: 'P1' }), true);
  assert.equal(hasChanged(desired, { ...desired, carmoreHolidaySerial: null }), true);
});

test('planReconcile splits add delete change unchanged', () => {
  const desiredRows = [
    { imsReservationId: 'A1', carNumber: '101하9257', carmoreRentcarSerial: '100', startAt: 's1', endAt: 'e1', holidayStartDate: '2026-05-01', holidayEndDate: '2026-05-02' },
    { imsReservationId: 'A2', carNumber: '101하9258', carmoreRentcarSerial: '101', startAt: 's2', endAt: 'e2', holidayStartDate: '2026-05-03', holidayEndDate: '2026-05-04' },
    { imsReservationId: 'A3', carNumber: '101하9259', carmoreRentcarSerial: '102', startAt: 's3', endAt: 'e3', holidayStartDate: '2026-05-05', holidayEndDate: '2026-05-06' },
  ];
  const actualRows = [
    { ...desiredRows[0], carmoreHolidaySerial: 'P1' },
    { ...desiredRows[1], holidayEndDate: '2026-05-05', carmoreHolidaySerial: 'P2' },
    { imsReservationId: 'A4', carNumber: '101하9260', carmoreRentcarSerial: '103', startAt: 's4', endAt: 'e4', holidayStartDate: '2026-05-07', holidayEndDate: '2026-05-08', carmoreHolidaySerial: 'P4' },
  ];
  const plan = planReconcile({ desiredRows, actualRows });
  assert.equal(plan.unchanged[0].desired.imsReservationId, 'A1');
  assert.equal(plan.changes[0].desired.imsReservationId, 'A2');
  assert.equal(plan.additions[0].desired.imsReservationId, 'A3');
  assert.equal(plan.deletions[0].actual.imsReservationId, 'A4');
});

test('applyAddition creates holiday on save', async () => {
  const desired = { imsReservationId: 'A1', carmoreRentcarSerial: '100', holidayStartDate: '2026-05-01', holidayEndDate: '2026-05-02' };
  const calls = [];
  const client = {
    async getRentcarHolidays() { return []; },
    async createHoliday(payload) { calls.push(payload); return { holidaySerial: 'H1', row: { serial: 'H1' } }; },
  };
  const result = await applyAddition({ desired, client, shouldSave: true });
  assert.equal(result.holidaySerial, 'H1');
  assert.equal(calls[0].memo, 'IMS A1');
});

test('applyDeletion deletes holiday on save', async () => {
  let deleted = null;
  const actual = { imsReservationId: 'A1', carmoreHolidaySerial: 'H1' };
  const client = { async deleteHoliday({ holidaySerial }) { deleted = holidaySerial; return { ok: true }; } };
  const result = await applyDeletion({ actual, client, shouldSave: true });
  assert.equal(deleted, 'H1');
  assert.equal(result.applied, true);
});

test('applyDeletion skips carmore delete when another active mapping shares holiday serial', async () => {
  let deleteCalled = false;
  const actual = { imsReservationId: 'A1', carmoreHolidaySerial: 'H1' };
  const actualRows = [
    actual,
    { imsReservationId: 'A2', carmoreHolidaySerial: 'H1', syncStatus: 'active' },
    { imsReservationId: 'A3', carmoreHolidaySerial: 'H1', syncStatus: 'deleted' },
  ];
  const client = { async deleteHoliday() { deleteCalled = true; return { ok: true }; } };
  const result = await applyDeletion({ actual, actualRows, client, shouldSave: true });
  assert.equal(deleteCalled, false);
  assert.equal(result.skippedCarmoreDelete, true);
  assert.equal(result.sharedActiveMappings.length, 1);
});

test('findSharedActiveHolidayMappings ignores self and deleted mappings', () => {
  const actual = { imsReservationId: 'A1', carmoreHolidaySerial: 'H1' };
  const rows = [
    actual,
    { imsReservationId: 'A2', carmoreHolidaySerial: 'H1', syncStatus: 'active' },
    { imsReservationId: 'A3', carmoreHolidaySerial: 'H1', syncStatus: 'deleted' },
    { imsReservationId: 'A4', carmoreHolidaySerial: 'H2', syncStatus: 'active' },
  ];
  const shared = findSharedActiveHolidayMappings({ actual, actualRows: rows });
  assert.deepEqual(shared.map((row) => row.imsReservationId), ['A2']);
});

test('createOrRecoverHoliday recovers exact IMS memo holiday before create', async () => {
  const desired = { imsReservationId: 'A1', carmoreRentcarSerial: '100', holidayStartDate: '2026-05-01', holidayEndDate: '2026-05-02' };
  let createCalled = false;
  const client = {
    async getRentcarHolidays() { return [{ serial: 'H1', memo: 'IMS A1', startDate: '2026-05-01', endDate: '2026-05-02' }]; },
    async createHoliday() { createCalled = true; return { holidaySerial: 'NEW' }; },
  };
  const result = await createOrRecoverHoliday({ desired, client });
  assert.equal(result.holidaySerial, 'H1');
  assert.equal(result.recoveredExisting, true);
  assert.equal(createCalled, false);
});

test('createOrRecoverHoliday recovers after duplicate error when exact IMS memo exists', async () => {
  const desired = { imsReservationId: 'A1', carmoreRentcarSerial: '100', holidayStartDate: '2026-05-01', holidayEndDate: '2026-05-02' };
  let lookupCount = 0;
  const client = {
    async getRentcarHolidays() {
      lookupCount += 1;
      return lookupCount === 1 ? [] : [{ serial: 'H1', memo: 'IMS A1', startDate: '2026-05-01', endDate: '2026-05-02' }];
    },
    async createHoliday() { throw new Error('Carmore holiday create failed: 중복 휴무'); },
  };
  const result = await createOrRecoverHoliday({ desired, client });
  assert.equal(result.holidaySerial, 'H1');
  assert.equal(result.createResult.duplicateRecovered, true);
});

test('isDuplicateHolidayError detects likely duplicate messages', () => {
  assert.equal(isDuplicateHolidayError(new Error('중복 휴무입니다')), true);
  assert.equal(isDuplicateHolidayError(new Error('Carmore login failed')), false);
});

test('applyChange deletes old and creates new holiday on save', async () => {
  const desired = { imsReservationId: 'A1', carmoreRentcarSerial: '100', holidayStartDate: '2026-05-01', holidayEndDate: '2026-05-02' };
  const actual = { imsReservationId: 'A1', carmoreHolidaySerial: 'OLD' };
  const calls = [];
  const client = {
    async deleteHoliday({ holidaySerial }) { calls.push(['delete', holidaySerial]); return { ok: true }; },
    async getRentcarHolidays() { return []; },
    async createHoliday() { calls.push(['create']); return { holidaySerial: 'NEW', row: { serial: 'NEW' } }; },
  };
  const result = await applyChange({ desired, actual, client, shouldSave: true });
  assert.deepEqual(calls, [['delete', 'OLD'], ['create']]);
  assert.equal(result.addition.holidaySerial, 'NEW');
});

test('planReconcile splits carmore desired holiday dates around unmanaged wall', () => {
  const desiredRows = [{
    imsReservationId: 'A1',
    carNumber: '101하9257',
    carmoreRentcarSerial: '100',
    startAt: '2026-06-22T00:00:00.000Z',
    endAt: '2026-07-01T00:00:00.000Z',
    holidayStartDate: '2026-06-22',
    holidayEndDate: '2026-07-01',
  }];
  const unmanagedWalls = [{ carmoreRentcarSerial: '100', holidayStartDate: '2026-06-30', holidayEndDate: '2026-07-05' }];

  const plan = planReconcile({ desiredRows, actualRows: [], unmanagedWalls });

  assert.equal(plan.additions.length, 1);
  assert.equal(plan.additions[0].desired.holidayStartDate, '2026-06-22');
  assert.equal(plan.additions[0].desired.holidayEndDate, '2026-06-29');
  assert.equal(plan.deletions.length, 0);
  assert.equal(plan.changes.length, 0);
});


test('classifyCarmoreHolidayRows separates unmapped current holidays as unmanaged walls', () => {
  const walls = classifyCarmoreHolidayRows({
    carmoreRentcarSerial: '100',
    carNumber: '101하9257',
    previousMappings: [{ imsReservationId: 'A1', carmoreHolidaySerial: 'H1' }],
    currentRows: [
      { serial: 'H1', memo: 'IMS A1', startDate: '2026-06-22', endDate: '2026-06-29' },
      { serial: 'MANUAL', memo: 'manual block', startDate: '2026-06-30', endDate: '2026-07-05' },
    ],
  });

  assert.equal(walls.length, 1);
  assert.equal(walls[0].carmoreHolidaySerial, 'MANUAL');
  assert.equal(walls[0].holidayStartDate, '2026-06-30');
  assert.equal(walls[0].unmanaged, true);
});

test('fetchCurrentCarmoreUnmanagedWalls reads current holidays and excludes managed serials', async () => {
  const calls = [];
  const client = {
    async getRentcarHolidays({ rentcarSerial }) {
      calls.push(rentcarSerial);
      return [
        { serial: 'H1', memo: 'IMS A1', startDate: '2026-06-22', endDate: '2026-06-29' },
        { serial: 'MANUAL', memo: 'manual block', startDate: '2026-06-30', endDate: '2026-07-05' },
      ];
    },
  };

  const walls = await fetchCurrentCarmoreUnmanagedWalls({
    client,
    desiredRows: [{ imsReservationId: 'A1', carNumber: '101하9257', carmoreRentcarSerial: '100' }],
    actualRows: [{ imsReservationId: 'A1', carNumber: '101하9257', carmoreRentcarSerial: '100', carmoreHolidaySerial: 'H1' }],
  });

  assert.deepEqual(calls, ['100']);
  assert.equal(walls.length, 1);
  assert.equal(walls[0].carmoreHolidaySerial, 'MANUAL');
});

test('planReconcile keeps multiple child holiday additions for same IMS reservation', () => {
  const desiredRows = [{
    imsReservationId: 'A1',
    carNumber: '101하9257',
    carmoreRentcarSerial: '100',
    startAt: '2026-06-22T00:00:00.000Z',
    endAt: '2026-07-10T00:00:00.000Z',
    holidayStartDate: '2026-06-22',
    holidayEndDate: '2026-07-10',
  }];
  const unmanagedWalls = [{ carmoreRentcarSerial: '100', holidayStartDate: '2026-06-30', holidayEndDate: '2026-07-05' }];

  const plan = planReconcile({ desiredRows, actualRows: [], unmanagedWalls });

  assert.equal(plan.additions.length, 2);
  assert.deepEqual(plan.additions.map((entry) => [entry.desired.holidayStartDate, entry.desired.holidayEndDate]), [
    ['2026-06-22', '2026-06-29'],
    ['2026-07-06', '2026-07-10'],
  ]);
  assert.notEqual(plan.additions[0].desired.childHolidayKey, plan.additions[1].desired.childHolidayKey);
});
