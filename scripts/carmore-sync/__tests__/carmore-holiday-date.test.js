const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHolidayDateRange } = require('../lib/carmore-holiday-date');

test('buildHolidayDateRange converts UTC to KST dates', () => {
  assert.deepEqual(buildHolidayDateRange({
    startAt: '2026-05-01T01:00:00.000Z',
    endAt: '2026-05-02T01:00:00.000Z',
  }), {
    holidayStartDate: '2026-05-01',
    holidayEndDate: '2026-05-02',
  });
});

test('buildHolidayDateRange treats KST midnight end as previous date', () => {
  assert.deepEqual(buildHolidayDateRange({
    startAt: '2026-05-01T01:00:00.000Z',
    endAt: '2026-05-02T15:00:00.000Z',
  }), {
    holidayStartDate: '2026-05-01',
    holidayEndDate: '2026-05-02',
  });
});

test('buildHolidayDateRange never ends before start date', () => {
  assert.deepEqual(buildHolidayDateRange({
    startAt: '2026-05-01T14:00:00.000Z',
    endAt: '2026-05-01T15:00:00.000Z',
  }), {
    holidayStartDate: '2026-05-01',
    holidayEndDate: '2026-05-01',
  });
});
