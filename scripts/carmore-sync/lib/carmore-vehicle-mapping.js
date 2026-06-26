const fs = require('fs');
const path = require('path');

const DEFAULT_RELINK_RESULT_PATH = process.env.CARMORE_RELINK_RESULT_PATH
  || '/Users/otang_server/.openclaw/workspace/projects/rentcar00-pricing-normalizer/outputs/carmore/vehicle-relink-result.json';

function normalizeCarNumber(value) {
  return String(value || '').replace(/\s+/g, '').trim().toUpperCase();
}

function loadCarmoreVehicleMappings({ filePath = DEFAULT_RELINK_RESULT_PATH } = {}) {
  if (!fs.existsSync(filePath)) throw new Error(`Carmore vehicle mapping file not found: ${filePath}`);
  const payload = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  const rows = Array.isArray(payload.results) ? payload.results : [];
  const mappings = [];
  for (const row of rows) {
    const assignment = row.assignment || {};
    if (!assignment.carNumber || !assignment.rentcarSerial) continue;
    mappings.push({
      carNumber: normalizeCarNumber(assignment.carNumber),
      rentcarSerial: String(assignment.rentcarSerial),
      sourceGroupId: assignment.sourceGroupId != null ? String(assignment.sourceGroupId) : null,
      targetModelSerial: assignment.targetModelSerial != null ? String(assignment.targetModelSerial) : null,
      targetModelName: assignment.targetModelName || null,
      raw: assignment,
    });
  }
  return mappings;
}

function buildCarmoreVehicleMap(options = {}) {
  return new Map(loadCarmoreVehicleMappings(options).map((row) => [row.carNumber, row]));
}

function findCarmoreVehicleByCarNumber(carNumber, options = {}) {
  return buildCarmoreVehicleMap(options).get(normalizeCarNumber(carNumber)) || null;
}

module.exports = {
  DEFAULT_RELINK_RESULT_PATH,
  buildCarmoreVehicleMap,
  findCarmoreVehicleByCarNumber,
  loadCarmoreVehicleMappings,
  normalizeCarNumber,
};
