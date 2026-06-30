function buildZzimcarPublishPayload({ isPublish } = {}) {
  if (!(isPublish === 0 || isPublish === 1 || isPublish === true || isPublish === false)) throw new Error('isPublish must be 0/1 or boolean');
  return { isPublish: isPublish === true ? 1 : (isPublish === false ? 0 : Number(isPublish)) };
}
function normalizeObservedPublish(value) {
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  return null;
}
function planZzimcarVehicleState({ desired = [], actualByCarNumber = new Map() } = {}) {
  const results = [], errors = [];
  for (const decision of desired) {
    const actual = actualByCarNumber.get(decision.carNumber);
    if (!actual) { errors.push({ carNumber: decision.carNumber, error: 'zzimcar_vehicle_not_found', decision }); continue; }
    const observedIsPublish = normalizeObservedPublish(actual.isPublish);
    const decidedIsPublish = Number(decision.zzimcar.isPublish);
    const changed = observedIsPublish !== decidedIsPublish;
    results.push({ provider: 'zzimcar', carNumber: decision.carNumber, localCarId: decision.localCarId, imsCarId: decision.imsCarId, zzimcarVehiclePid: String(actual.vehiclePid), observedIsPublish, decidedIsPublish, appliedIsPublish: null, activeMonthlyReservationIds: decision.activeMonthlyReservations.map((item) => item.imsReservationId), reasons: decision.reasons.filter((reason) => reason !== 'ims_monthly_flag'), action: changed ? 'set_state' : 'unchanged', payload: changed ? buildZzimcarPublishPayload({ isPublish: decidedIsPublish }) : null, actual, decision });
  }
  return { provider: 'zzimcar', results, errors, counts: { total: results.length, setState: results.filter((item) => item.action === 'set_state').length, unchanged: results.filter((item) => item.action === 'unchanged').length, errors: errors.length } };
}
module.exports = { buildZzimcarPublishPayload, normalizeObservedPublish, planZzimcarVehicleState };
