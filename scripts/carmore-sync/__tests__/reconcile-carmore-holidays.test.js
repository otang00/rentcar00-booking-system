const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyAddition,
  applyChange,
  applyDeletion,
  buildHolidayMemo,
  hasChanged,
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
