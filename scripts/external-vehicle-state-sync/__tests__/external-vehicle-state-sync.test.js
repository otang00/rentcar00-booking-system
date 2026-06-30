const assert = require('node:assert/strict');
const test = require('node:test');
const { buildImsVehicleStateDesired } = require('../lib/build-ims-vehicle-state');
const { planCarmoreVehicleState } = require('../lib/carmore-state-planner');
const { planZzimcarVehicleState } = require('../lib/zzimcar-state-planner');
const { requireNoWriteAllowed, toCarmoreRow, toZzimcarRow } = require('../lib/vehicle-state-repos');
const { runExternalVehicleStateSync } = require('../run-external-vehicle-state-sync');

const vehicles = [
  { id: 1, car_identity: '11가1111', can_general_rental: true, can_monthly_rental: true },
  { id: 2, car_identity: '22나2222', can_general_rental: true, can_monthly_rental: false },
  { id: 3, car_identity: '33다3333', can_general_rental: false, can_monthly_rental: true },
];
const schedules = [
  { id: 900, status: 'booking', start_at: '2026-07-01T00:00:00Z', end_at: '2026-08-01T00:00:00Z', detail: { rental_type: 'monthly' }, car: { car_identity: '11가1111' } },
];

test('IMS builder locks policy: active monthly closes all, monthly flag does not close Zzimcar by itself', () => {
  const result = buildImsVehicleStateDesired({ vehicles, schedules });
  const byCar = new Map(result.decisions.map((item) => [item.carNumber, item]));
  assert.equal(byCar.get('11가1111').carmore.appFlag, '0');
  assert.equal(byCar.get('11가1111').carmore.monthFlag, '0');
  assert.equal(byCar.get('11가1111').zzimcar.isPublish, 0);
  assert.equal(byCar.get('22나2222').carmore.appFlag, '1');
  assert.equal(byCar.get('22나2222').carmore.monthFlag, '0');
  assert.equal(byCar.get('22나2222').zzimcar.isPublish, 1);
  assert.equal(byCar.get('33다3333').zzimcar.isPublish, 0);
});

test('provider planners build separated provider-specific states', () => {
  const desired = buildImsVehicleStateDesired({ vehicles, schedules }).decisions;
  const carmoreActual = new Map([
    ['11가1111', { serial: 'c1', appFlag: '1', monthFlag: '1' }],
    ['22나2222', { serial: 'c2', appFlag: '1', monthFlag: '1' }],
    ['33다3333', { serial: 'c3', appFlag: '1', monthFlag: '1' }],
  ]);
  const zzimcarActual = new Map([
    ['11가1111', { vehiclePid: 'z1', isPublish: 1 }],
    ['22나2222', { vehiclePid: 'z2', isPublish: 1 }],
    ['33다3333', { vehiclePid: 'z3', isPublish: 1 }],
  ]);
  const carmore = planCarmoreVehicleState({ desired, actualByCarNumber: carmoreActual, session: { companySerial: 'co' } });
  const zzimcar = planZzimcarVehicleState({ desired, actualByCarNumber: zzimcarActual });
  assert.equal(carmore.counts.setState, 3);
  assert.equal(zzimcar.counts.setState, 2);
  assert.equal(zzimcar.results.find((row) => row.carNumber === '22나2222').action, 'unchanged');
});

test('repo row mapping is provider-specific and save guard blocks save-run', () => {
  assert.throws(() => requireNoWriteAllowed({ save: true }), /save-run is disabled/);
  const carmoreRow = toCarmoreRow({ carNumber: '11가1111', carmoreRentcarSerial: 'c1', observedAppFlag: '1', observedMonthFlag: '1', decidedAppFlag: '0', decidedMonthFlag: '0', action: 'set_state', reasons: ['active_monthly'] });
  const zzimcarRow = toZzimcarRow({ carNumber: '11가1111', zzimcarVehiclePid: 'z1', observedIsPublish: 1, decidedIsPublish: 0, action: 'set_state', reasons: ['active_monthly'] });
  assert.equal(carmoreRow.carmore_rentcar_serial, 'c1');
  assert.equal(zzimcarRow.zzimcar_vehicle_pid, 'z1');
});

test('integrated no-write runner does not write DB or external systems with injected actuals', async () => {
  const desired = buildImsVehicleStateDesired({ vehicles, schedules }).decisions;
  const carmoreActualByCarNumber = new Map(desired.map((item) => [item.carNumber, { serial: `c-${item.carNumber}`, appFlag: '1', monthFlag: '1' }]));
  const zzimcarActualByCarNumber = new Map(desired.map((item) => [item.carNumber, { vehiclePid: `z-${item.carNumber}`, isPublish: 1 }]));
  const result = await runExternalVehicleStateSync({
    noWriteSmoke: true,
    vehicles,
    schedules,
    localCars: [],
    carmoreActualByCarNumber,
    zzimcarActualByCarNumber,
    supabase: {},
  });
  assert.equal(result.wroteDb, false);
  assert.equal(result.wroteExternal, false);
  assert.equal(result.carmore.plannedRows.length, 3);
  assert.equal(result.zzimcar.plannedRows.length, 3);
});
