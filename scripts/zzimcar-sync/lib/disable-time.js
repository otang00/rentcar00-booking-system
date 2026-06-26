function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function normalizeCarNumber(value) {
  return normalizeWhitespace(value).toUpperCase();
}

function buildDisableTimeListPath(vehiclePid) {
  if (!vehiclePid && vehiclePid !== 0) {
    throw new Error('vehiclePid is required');
  }

  return `/vehicle/vehicle/${String(vehiclePid)}/disable_time`;
}

function buildDisableTimeCreatePayload({ vehiclePid, startDtime, endDtime } = {}) {
  if (!vehiclePid && vehiclePid !== 0) throw new Error('vehiclePid is required');
  if (!startDtime) throw new Error('startDtime is required');
  if (!endDtime) throw new Error('endDtime is required');

  return {
    disableClass: 'vehicle',
    vehiclePid: String(vehiclePid),
    startDtime: String(startDtime),
    endDtime: String(endDtime),
  };
}

function buildDisableTimeUpdatePayload({ pid, startDtime, endDtime } = {}) {
  if (!pid && pid !== 0) throw new Error('pid is required');
  if (!startDtime) throw new Error('startDtime is required');
  if (!endDtime) throw new Error('endDtime is required');

  return {
    pid: String(pid),
    startDtime: String(startDtime),
    endDtime: String(endDtime),
  };
}

function buildDisableTimeDeletePayload({ pid } = {}) {
  if (!pid && pid !== 0) throw new Error('pid is required');

  return {
    pid: String(pid),
  };
}

function extractVehiclePidFromRowHtml(rowHtml) {
  const html = String(rowHtml || '');
  const match = html.match(/data-pid=["']?(\d+)["']?/i);
  return match ? match[1] : null;
}

function sameDisableWindow(a, b) {
  if (!a || !b) return false;
  return String(a.startDtime || '') === String(b.startDtime || '')
    && String(a.endDtime || '') === String(b.endDtime || '');
}

function hasMatchingDisableWindow(existingRows = [], targetWindow = {}) {
  return (Array.isArray(existingRows) ? existingRows : []).some((row) => sameDisableWindow(row, targetWindow));
}

function planDisableTimeCreate({ existingRows = [], targetWindow } = {}) {
  if (!targetWindow?.startDtime || !targetWindow?.endDtime) {
    throw new Error('targetWindow startDtime/endDtime is required');
  }

  return {
    shouldCreate: !hasMatchingDisableWindow(existingRows, targetWindow),
    duplicate: hasMatchingDisableWindow(existingRows, targetWindow),
  };
}

module.exports = {
  normalizeWhitespace,
  normalizeCarNumber,
  buildDisableTimeListPath,
  buildDisableTimeCreatePayload,
  buildDisableTimeUpdatePayload,
  buildDisableTimeDeletePayload,
  extractVehiclePidFromRowHtml,
  sameDisableWindow,
  hasMatchingDisableWindow,
  planDisableTimeCreate,
};
