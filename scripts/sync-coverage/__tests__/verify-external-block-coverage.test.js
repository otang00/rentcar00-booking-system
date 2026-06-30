'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildImsRequiredCoverage } = require('../build-ims-required-coverage');
const { COVERAGE_STATUS, subtractIntervals, verifyExternalBlockCoverage } = require('../verify-external-block-coverage');

test('buildImsRequiredCoverage unions actual overlaps and preserves source ids without merging adjacent', () => {
  const rows = [
    { imsReservationId: 'A2', carNumber: '101하9257', startAt: '2026-06-25T00:00:00.000Z', endAt: '2026-07-01T00:00:00.000Z', status: 'confirmed' },
    { imsReservationId: 'A1', carNumber: '101하9257', startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-06-26T00:00:00.000Z', status: 'paid' },
    { imsReservationId: 'A3', carNumber: '101하9257', startAt: '2026-07-01T00:00:00.000Z', endAt: '2026-07-02T00:00:00.000Z', status: 'pending' },
  ];

  const coverage = buildImsRequiredCoverage(rows);

  assert.equal(coverage.length, 2);
  assert.deepEqual(coverage[0].sourceImsReservationIds, ['A1', 'A2']);
  assert.equal(coverage[0].startAt, '2026-06-22T00:00:00.000Z');
  assert.equal(coverage[0].endAt, '2026-07-01T00:00:00.000Z');
  assert.equal(coverage[1].imsReservationId, 'A3');
});

test('subtractIntervals returns only missing uncovered intervals', () => {
  const missing = subtractIntervals(
    { startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-07-01T00:00:00.000Z' },
    [{ startAt: '2026-06-30T00:00:00.000Z', endAt: '2026-07-05T00:00:00.000Z' }],
  );

  assert.deepEqual(missing, [{ startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-06-30T00:00:00.000Z' }]);
});

test('verifyExternalBlockCoverage is read-only and reports unmanaged/manual wall coverage as WARN, not missing', () => {
  const report = verifyExternalBlockCoverage({
    imsReservations: [{ imsReservationId: 'A1', carNumber: '101하9257', startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-07-01T00:00:00.000Z', status: 'paid' }],
    homepageBlocks: [{ carNumber: '101하9257', startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-07-01T00:00:00.000Z' }],
    zzimcar: {
      managedBlocks: [{ carNumber: '101하9257', startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-06-30T00:00:00.000Z' }],
      unmanagedWalls: [{ carNumber: '101하9257', startAt: '2026-06-30T00:00:00.000Z', endAt: '2026-07-05T00:00:00.000Z' }],
    },
    carmore: {
      managedBlocks: [{ carNumber: '101하9257', startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-06-30T00:00:00.000Z' }],
      unmanagedWalls: [{ carNumber: '101하9257', startAt: '2026-06-30T00:00:00.000Z', endAt: '2026-07-05T00:00:00.000Z' }],
    },
  });

  assert.equal(report.readOnly, true);
  assert.equal(report.criticalMissingCount, 0);
  assert.equal(report.warningCount, 2);
  assert.equal(report.unmanagedManualCoveredWarnings.length, 2);
  assert.equal(report.providers.zzimcar[0].status, COVERAGE_STATUS.UNMANAGED_MANUAL_COVERED_WARN);
  assert.equal(report.providers.carmore[0].status, COVERAGE_STATUS.UNMANAGED_MANUAL_COVERED_WARN);
  assert.equal(report.unmanagedWallConflicts.length, 2);
});


test('verifyExternalBlockCoverage accepts IMS one-to-two managed child coverage rows', () => {
  const report = verifyExternalBlockCoverage({
    imsReservations: [{ imsReservationId: 'A1', carNumber: '101하9257', startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-07-10T00:00:00.000Z', status: 'paid' }],
    homepageBlocks: [{ carNumber: '101하9257', startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-07-10T00:00:00.000Z' }],
    zzimcar: {
      managedBlocks: [
        { imsReservationId: 'A1', childBlockKey: 'A1:left', carNumber: '101하9257', startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-06-30T00:00:00.000Z' },
        { imsReservationId: 'A1', childBlockKey: 'A1:right', carNumber: '101하9257', startAt: '2026-07-05T00:00:00.000Z', endAt: '2026-07-10T00:00:00.000Z' },
      ],
      unmanagedWalls: [{ carNumber: '101하9257', startAt: '2026-06-30T00:00:00.000Z', endAt: '2026-07-05T00:00:00.000Z' }],
    },
    carmore: {
      managedBlocks: [
        { imsReservationId: 'A1', childHolidayKey: 'A1:left', carNumber: '101하9257', startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-06-30T00:00:00.000Z' },
        { imsReservationId: 'A1', childHolidayKey: 'A1:right', carNumber: '101하9257', startAt: '2026-07-05T00:00:00.000Z', endAt: '2026-07-10T00:00:00.000Z' },
      ],
      unmanagedWalls: [{ carNumber: '101하9257', startAt: '2026-06-30T00:00:00.000Z', endAt: '2026-07-05T00:00:00.000Z' }],
    },
  });

  assert.equal(report.criticalMissingCount, 0);
  assert.equal(report.warningCount, 2);
});

test('verifyExternalBlockCoverage distinguishes real missing coverage from unmanaged/manual covered warning', () => {
  const report = verifyExternalBlockCoverage({
    imsReservations: [{ imsReservationId: 'A1', carNumber: '101하9257', startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-07-01T00:00:00.000Z', status: 'paid' }],
    homepageBlocks: [{ carNumber: '101하9257', startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-07-01T00:00:00.000Z' }],
    zzimcar: {
      managedBlocks: [],
      unmanagedWalls: [{ carNumber: '101하9257', startAt: '2026-06-25T00:00:00.000Z', endAt: '2026-07-01T00:00:00.000Z' }],
    },
    carmore: {
      managedBlocks: [],
      unmanagedWalls: [{ carNumber: '101하9257', startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-07-01T00:00:00.000Z' }],
    },
  });

  assert.equal(report.providers.zzimcar[0].status, COVERAGE_STATUS.MISSING);
  assert.deepEqual(report.providers.zzimcar[0].missing, [{ startAt: '2026-06-22T00:00:00.000Z', endAt: '2026-06-25T00:00:00.000Z' }]);
  assert.equal(report.providers.carmore[0].status, COVERAGE_STATUS.UNMANAGED_MANUAL_COVERED_WARN);
  assert.equal(report.criticalMissingCount, 1);
  assert.equal(report.warningCount, 1);
});

test('verifyExternalBlockCoverage reports unknown coverage when interval inputs cannot be interpreted', () => {
  const report = verifyExternalBlockCoverage({
    imsReservations: [{ imsReservationId: 'A1', carNumber: '101하9257', startAt: 'not-a-date', endAt: '2026-07-01T00:00:00.000Z', status: 'paid' }],
    homepageBlocks: [],
    zzimcar: {},
    carmore: {},
  });

  assert.equal(report.providers.homepage[0].status, COVERAGE_STATUS.UNKNOWN);
  assert.equal(report.criticalMissingCount, 0);
  assert.equal(report.unknownCount, 3);
});
