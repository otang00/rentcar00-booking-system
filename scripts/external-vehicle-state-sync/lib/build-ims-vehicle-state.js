const { normalizeCarNumber } = require('../../zzimcar-sync/lib/disable-time');
const { mapImsStatus } = require('../../ims-sync/normalize-ims-reservation');

const ACTIVE_IMS_STATUSES = new Set(['pending', 'confirmed', 'paid']);
function getVehicleCarNumber(vehicle = {}) { return vehicle.car_identity || vehicle.car_num || vehicle.carNumber || vehicle.car_number || null; }
function getScheduleCarNumber(schedule = {}) { return schedule.car?.car_identity || schedule.car_number || schedule.carNumber || null; }
function isActiveMonthlySchedule(schedule = {}) {
  const rentalType = String(schedule.detail?.rental_type || schedule.rental_type || '').toLowerCase();
  return rentalType === 'monthly' && ACTIVE_IMS_STATUSES.has(mapImsStatus(schedule.status || schedule.status_raw));
}
function compactReservation(schedule = {}) {
  return { imsReservationId: schedule.id != null ? String(schedule.id) : String(schedule.ims_reservation_id || ''), carNumber: getScheduleCarNumber(schedule), status: mapImsStatus(schedule.status || schedule.status_raw), statusRaw: schedule.status || schedule.status_raw || null, rentalType: schedule.detail?.rental_type || schedule.rental_type || null, startAt: schedule.start_at || schedule.startAt || null, endAt: schedule.end_at || schedule.endAt || null };
}
function buildActiveMonthlyByCar(schedules = []) {
  const map = new Map();
  for (const schedule of schedules || []) {
    if (!isActiveMonthlySchedule(schedule)) continue;
    const carNumber = getScheduleCarNumber(schedule);
    if (!carNumber) continue;
    const key = normalizeCarNumber(carNumber);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(compactReservation(schedule));
  }
  return map;
}
function buildImsVehicleStateDesired({ vehicles = [], schedules = [], localCars = [] } = {}) {
  const activeMonthlyByCar = buildActiveMonthlyByCar(schedules);
  const localByCar = new Map((localCars || []).filter((car) => car?.car_number).map((car) => [normalizeCarNumber(car.car_number), car]));
  const decisions = [];
  const skipped = [];
  for (const vehicle of vehicles || []) {
    const rawCarNumber = getVehicleCarNumber(vehicle);
    if (!rawCarNumber) { skipped.push({ reason: 'missing_car_number', vehicle }); continue; }
    const carNumber = normalizeCarNumber(rawCarNumber);
    const activeMonthlyReservations = activeMonthlyByCar.get(carNumber) || [];
    const hasActiveMonthly = activeMonthlyReservations.length > 0;
    const canGeneral = vehicle.can_general_rental == null ? null : Boolean(vehicle.can_general_rental);
    const canMonthly = vehicle.can_monthly_rental == null ? null : Boolean(vehicle.can_monthly_rental);
    const localCar = localByCar.get(carNumber) || null;
    decisions.push({
      carNumber,
      imsCarId: vehicle.id != null ? String(vehicle.id) : null,
      localCarId: localCar?.id || null,
      sourceCarId: localCar?.source_car_id || (vehicle.id != null ? String(vehicle.id) : null),
      imsFlags: { canGeneralRental: canGeneral, canMonthlyRental: canMonthly },
      hasActiveMonthly,
      activeMonthlyReservations,
      carmore: { appFlag: hasActiveMonthly ? '0' : (canGeneral === false ? '0' : '1'), monthFlag: hasActiveMonthly ? '0' : (canMonthly === false ? '0' : '1') },
      zzimcar: { isPublish: hasActiveMonthly || canGeneral === false ? 0 : 1 },
      reasons: [ ...(hasActiveMonthly ? ['active_monthly'] : []), ...(canGeneral === false ? ['ims_general_flag'] : []), ...(canMonthly === false ? ['ims_monthly_flag'] : []) ],
      rawVehicle: vehicle,
    });
  }
  return { generatedAt: new Date().toISOString(), counts: { vehicles: decisions.length, skipped: skipped.length, activeMonthlyVehicles: decisions.filter((item) => item.hasActiveMonthly).length, carmoreAppClosed: decisions.filter((item) => item.carmore.appFlag === '0').length, carmoreMonthClosed: decisions.filter((item) => item.carmore.monthFlag === '0').length, zzimcarClosed: decisions.filter((item) => item.zzimcar.isPublish === 0).length }, decisions, skipped };
}
module.exports = { ACTIVE_IMS_STATUSES, buildActiveMonthlyByCar, buildImsVehicleStateDesired, compactReservation, getScheduleCarNumber, getVehicleCarNumber, isActiveMonthlySchedule };
