function buildCarmoreVehicleSettingPayload({ session = {}, rentcarSerial, appFlag, monthFlag, currentAppFlag, currentMonthFlag } = {}) {
  if (!rentcarSerial) throw new Error('rentcarSerial is required');
  const serial = String(rentcarSerial);
  return { ...session, list: [{ serial, appFlag: String(appFlag), monthFlag: String(monthFlag) }], originNormal: currentAppFlag === '1' ? [serial] : [], originMonth: currentMonthFlag === '1' ? [serial] : [], newNormal: String(appFlag) === '1' ? [serial] : [], newMonth: String(monthFlag) === '1' ? [serial] : [] };
}
function planCarmoreVehicleState({ desired = [], actualByCarNumber = new Map(), session = {} } = {}) {
  const results = [], errors = [];
  for (const decision of desired) {
    const actual = actualByCarNumber.get(decision.carNumber);
    if (!actual) { errors.push({ carNumber: decision.carNumber, error: 'carmore_vehicle_not_found', decision }); continue; }
    const observedAppFlag = actual.appFlag == null ? null : String(actual.appFlag);
    const observedMonthFlag = actual.monthFlag == null ? null : String(actual.monthFlag);
    const decidedAppFlag = String(decision.carmore.appFlag);
    const decidedMonthFlag = String(decision.carmore.monthFlag);
    const changed = observedAppFlag !== decidedAppFlag || observedMonthFlag !== decidedMonthFlag;
    results.push({ provider: 'carmore', carNumber: decision.carNumber, localCarId: decision.localCarId, imsCarId: decision.imsCarId, carmoreRentcarSerial: String(actual.serial), observedAppFlag, observedMonthFlag, decidedAppFlag, decidedMonthFlag, appliedAppFlag: null, appliedMonthFlag: null, activeMonthlyReservationIds: decision.activeMonthlyReservations.map((item) => item.imsReservationId), reasons: decision.reasons, action: changed ? 'set_state' : 'unchanged', payload: changed ? buildCarmoreVehicleSettingPayload({ session, rentcarSerial: actual.serial, appFlag: decidedAppFlag, monthFlag: decidedMonthFlag, currentAppFlag: observedAppFlag, currentMonthFlag: observedMonthFlag }) : null, actual, decision });
  }
  return { provider: 'carmore', results, errors, counts: { total: results.length, setState: results.filter((item) => item.action === 'set_state').length, unchanged: results.filter((item) => item.action === 'unchanged').length, errors: errors.length } };
}
module.exports = { buildCarmoreVehicleSettingPayload, planCarmoreVehicleState };
