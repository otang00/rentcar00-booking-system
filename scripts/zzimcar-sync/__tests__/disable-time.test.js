const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeCarNumber,
  buildDisableTimeListPath,
  buildDisableTimeCreatePayload,
  buildDisableTimeUpdatePayload,
  buildDisableTimeDeletePayload,
  extractVehiclePidFromRowHtml,
  sameDisableWindow,
  hasMatchingDisableWindow,
  planDisableTimeCreate,
} = require('../lib/disable-time');

test('normalizeCarNumber removes spaces and uppercases', () => {
  assert.equal(normalizeCarNumber(' 101하 9257 '), '101하9257');
  assert.equal(normalizeCarNumber('ab 12 cd'), 'AB12CD');
});

test('buildDisableTimeListPath returns vehicle disable time path', () => {
  assert.equal(buildDisableTimeListPath(22360), '/vehicle/vehicle/22360/disable_time');
});

test('buildDisableTimeCreatePayload returns expected payload', () => {
  assert.deepEqual(buildDisableTimeCreatePayload({
    vehiclePid: 22360,
    startDtime: '2026-04-29 10:00',
    endDtime: '2026-04-30 10:00',
  }), {
    disableClass: 'vehicle',
    vehiclePid: '22360',
    startDtime: '2026-04-29 10:00',
    endDtime: '2026-04-30 10:00',
  });
});

test('buildDisableTimeUpdatePayload returns expected payload', () => {
  assert.deepEqual(buildDisableTimeUpdatePayload({
    pid: 7788,
    startDtime: '2026-04-29 10:00',
    endDtime: '2026-04-30 10:00',
  }), {
    pid: '7788',
    startDtime: '2026-04-29 10:00',
    endDtime: '2026-04-30 10:00',
  });
});

test('buildDisableTimeDeletePayload returns expected payload', () => {
  assert.deepEqual(buildDisableTimeDeletePayload({ pid: 7788 }), { pid: '7788' });
});

test('extractVehiclePidFromRowHtml reads data-pid from row html', () => {
  const html = '<tr data-pid="22360"><td><a class="link">101하9257</a></td></tr>';
  assert.equal(extractVehiclePidFromRowHtml(html), '22360');
});

test('sameDisableWindow compares exact start/end pair', () => {
  assert.equal(sameDisableWindow(
    { startDtime: '2026-04-29 10:00', endDtime: '2026-04-30 10:00' },
    { startDtime: '2026-04-29 10:00', endDtime: '2026-04-30 10:00' },
  ), true);

  assert.equal(sameDisableWindow(
    { startDtime: '2026-04-29 10:00', endDtime: '2026-04-30 10:00' },
    { startDtime: '2026-04-29 11:00', endDtime: '2026-04-30 10:00' },
  ), false);
});

test('hasMatchingDisableWindow returns true when duplicate exists', () => {
  const existingRows = [
    { startDtime: '2026-04-29 10:00', endDtime: '2026-04-30 10:00' },
  ];
  assert.equal(hasMatchingDisableWindow(existingRows, {
    startDtime: '2026-04-29 10:00',
    endDtime: '2026-04-30 10:00',
  }), true);
});

test('planDisableTimeCreate blocks create when exact duplicate exists', () => {
  const result = planDisableTimeCreate({
    existingRows: [
      { startDtime: '2026-04-29 10:00', endDtime: '2026-04-30 10:00' },
    ],
    targetWindow: {
      startDtime: '2026-04-29 10:00',
      endDtime: '2026-04-30 10:00',
    },
  });

  assert.deepEqual(result, {
    shouldCreate: false,
    duplicate: true,
  });
});

test('planDisableTimeCreate allows create when duplicate does not exist', () => {
  const result = planDisableTimeCreate({
    existingRows: [
      { startDtime: '2026-04-29 10:00', endDtime: '2026-04-30 10:00' },
    ],
    targetWindow: {
      startDtime: '2026-05-01 10:00',
      endDtime: '2026-05-02 10:00',
    },
  });

  assert.deepEqual(result, {
    shouldCreate: true,
    duplicate: false,
  });
});
