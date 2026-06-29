'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileZzimcarDisableTimes } = require('./zzimcar-sync/lib/reconcile-zzimcar-disable-times');
const { reconcileCarmoreHolidays } = require('./carmore-sync/lib/reconcile-carmore-holidays');
const { syncReservationsToSupabase } = require('./ims-sync/upsert-ims-reservations');
const { syncVehiclesToSupabase } = require('./ims-sync/upsert-ims-vehicles');

function createNoWriteSupabase({ tableRows = {} } = {}) {
  const calls = [];
  const failWrite = (method) => {
    calls.push(method);
    throw new Error(`no-write smoke forbids DB ${method}`);
  };
  return {
    calls,
    from(tableName) {
      const rows = tableRows[tableName] || [];
      const query = {
        select() { calls.push(`select:${tableName}`); return this; },
        eq() { return this; },
        not() { return this; },
        gt() { return this; },
        in() { return this; },
        order() { return Promise.resolve({ data: rows, error: null }); },
        insert() { return failWrite(`insert:${tableName}`); },
        update() { return failWrite(`update:${tableName}`); },
        upsert() { return failWrite(`upsert:${tableName}`); },
        delete() { return failWrite(`delete:${tableName}`); },
      };
      return query;
    },
  };
}

const activeImsRows = [{
  ims_reservation_id: 'A1',
  car_number: '101하9257',
  start_at: '2099-06-22T00:00:00.000Z',
  end_at: '2099-06-25T00:00:00.000Z',
  status: 'paid',
  status_raw: 'paid',
  last_synced_at: '2099-06-01T00:00:00.000Z',
}];

test('zzimcar no-write smoke does not create run, mapping, sync_event, or external writes', async () => {
  const supabase = createNoWriteSupabase({ tableRows: { ims_sync_reservations: activeImsRows, zzimcar_disable_time_sync_mappings: [] } });
  const externalCalls = [];
  const client = {
    async ensureLoggedIn() { externalCalls.push('ensureLoggedIn'); return { ok: true }; },
    async findVehicleByCarNumber({ carNumber }) { externalCalls.push(['findVehicleByCarNumber', carNumber]); return { vehiclePid: 'V1' }; },
    async getDisableTimes({ vehiclePid }) { externalCalls.push(['getDisableTimes', vehiclePid]); return []; },
    async createDisableTime() { throw new Error('no-write smoke must not create zzimcar disable_time'); },
    async deleteDisableTime() { throw new Error('no-write smoke must not delete zzimcar disable_time'); },
  };
  const events = [];

  const summary = await reconcileZzimcarDisableTimes({
    noWriteSmoke: true,
    now: new Date('2099-01-01T00:00:00.000Z'),
    supabaseClient: supabase,
    client,
    eventLogger: (event) => events.push(event),
  });

  assert.equal(summary.mode, 'no-write-smoke');
  assert.equal(summary.additionsCount, 1);
  assert.deepEqual(supabase.calls.filter((call) => /insert|update|upsert|delete/.test(call)), []);
  assert.deepEqual(externalCalls.map((call) => Array.isArray(call) ? call[0] : call), ['findVehicleByCarNumber', 'getDisableTimes']);
  assert.equal(events.length, 0);
});

test('carmore no-write smoke does not create run, mapping, sync_event, or external writes', async () => {
  const supabase = createNoWriteSupabase({ tableRows: { ims_sync_reservations: activeImsRows, carmore_holiday_sync_mappings: [] } });
  const externalCalls = [];
  const client = {
    async ensureLoggedIn() { externalCalls.push('ensureLoggedIn'); return { ok: true }; },
    async getRentcarHolidays({ rentcarSerial }) { externalCalls.push(['getRentcarHolidays', rentcarSerial]); return []; },
    async createHoliday() { throw new Error('no-write smoke must not create carmore holiday'); },
    async deleteHoliday() { throw new Error('no-write smoke must not delete carmore holiday'); },
  };
  const mappingOptions = { filePath: '/tmp/not-used-by-test.json' };
  const original = require('./carmore-sync/lib/carmore-vehicle-mapping').findCarmoreVehicleByCarNumber;

  // Pass direct mappingOptions through a temporary fixture file path by using the normal loader override file.
  const fs = require('fs');
  fs.writeFileSync(mappingOptions.filePath, JSON.stringify({ results: [{ assignment: { carNumber: '101하9257', rentcarSerial: 'R1' } }] }));
  try {
    const summary = await reconcileCarmoreHolidays({
      noWriteSmoke: true,
      now: new Date('2099-01-01T00:00:00.000Z'),
      supabaseClient: supabase,
      client,
      mappingOptions,
      eventLogger: () => { throw new Error('no-write smoke must not persist/log sync events'); },
    });

    assert.equal(summary.mode, 'no-write-smoke');
    assert.equal(summary.additionsCount, 1);
    assert.deepEqual(supabase.calls.filter((call) => /insert|update|upsert|delete/.test(call)), []);
    assert.deepEqual(externalCalls.map((call) => Array.isArray(call) ? call[0] : call), ['getRentcarHolidays']);
  } finally {
    fs.rmSync(mappingOptions.filePath, { force: true });
    assert.equal(typeof original, 'function');
  }
});

test('IMS dry/no-write path normalizes without DB write calls', async () => {
  const reservations = await syncReservationsToSupabase({
    dryRun: true,
    schedules: [{ id: 1, car: { carNum: '101하9257' }, detail: { id: 1, rental_type: 'daily' }, start_at: '2099-06-22T00:00:00.000Z', end_at: '2099-06-25T00:00:00.000Z' }],
  });
  const vehicles = await syncVehiclesToSupabase({
    dryRun: true,
    vehicles: [{ id: 100, can_general_rental: true, can_monthly_rental: false }],
  });

  assert.equal(reservations.syncRunId, null);
  assert.equal(reservations.upsertedCount, 0);
  assert.equal(reservations.rawInsertedCount, 0);
  assert.equal(vehicles.syncRunId, null);
  assert.equal(vehicles.updatedCount, 0);
});
