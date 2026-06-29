'use strict';

const { buildImsRequiredCoverage } = require('./build-ims-required-coverage');

const COVERAGE_STATUS = Object.freeze({
  COVERED: 'covered',
  MISSING: 'missing',
  UNMANAGED_MANUAL_COVERED_WARN: 'unmanaged_manual_covered_warn',
  UNKNOWN: 'unknown',
});

function toMs(value) {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function normalizeInterval(row = {}) {
  const start = toMs(row.startAt);
  const end = toMs(row.endAt);
  if (start == null || end == null || start >= end) return null;
  return { ...row, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), start, end };
}

function subtractIntervals(base, blockers = []) {
  const normalizedBase = normalizeInterval(base);
  if (!normalizedBase) return [];
  let ranges = [{ start: normalizedBase.start, end: normalizedBase.end }];
  const sortedBlockers = blockers
    .map(normalizeInterval)
    .filter(Boolean)
    .filter((blocker) => blocker.start < normalizedBase.end && blocker.end > normalizedBase.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  for (const blocker of sortedBlockers) {
    const next = [];
    for (const range of ranges) {
      if (blocker.end <= range.start || blocker.start >= range.end) {
        next.push(range);
        continue;
      }
      if (blocker.start > range.start) next.push({ start: range.start, end: Math.min(blocker.start, range.end) });
      if (blocker.end < range.end) next.push({ start: Math.max(blocker.end, range.start), end: range.end });
    }
    ranges = next;
  }

  return ranges.map((range) => ({
    startAt: new Date(range.start).toISOString(),
    endAt: new Date(range.end).toISOString(),
  }));
}

function groupByCar(rows = []) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = String(row.carNumber || '');
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function hasUnknownCoverageInput({ required, managedBlocks, unmanagedWalls }) {
  if (!normalizeInterval(required)) return true;
  const allBlocks = [...managedBlocks, ...unmanagedWalls];
  return allBlocks.some((block) => !normalizeInterval(block));
}

function getOverlappingUnmanagedWalls(required, unmanagedWalls = []) {
  return unmanagedWalls.filter((wall) => subtractIntervals(wall, [required]).length < 1 || intervalsOverlap(wall, required));
}

function classifyCoverage({ required, managedBlocks = [], unmanagedWalls = [] } = {}) {
  const managedMissing = subtractIntervals(required, managedBlocks);
  const fullMissing = subtractIntervals(required, [...managedBlocks, ...unmanagedWalls]);
  const unmanagedWallsForRequired = getOverlappingUnmanagedWalls(required, unmanagedWalls);

  if (hasUnknownCoverageInput({ required, managedBlocks, unmanagedWalls })) {
    return {
      status: COVERAGE_STATUS.UNKNOWN,
      severity: 'unknown',
      covered: false,
      missing: fullMissing,
      managedMissing,
      unmanagedManualCovered: [],
      unmanagedWalls: unmanagedWallsForRequired,
    };
  }

  if (fullMissing.length > 0) {
    return {
      status: COVERAGE_STATUS.MISSING,
      severity: 'critical',
      covered: false,
      missing: fullMissing,
      managedMissing,
      unmanagedManualCovered: [],
      unmanagedWalls: unmanagedWallsForRequired,
    };
  }

  if (managedMissing.length > 0 && unmanagedWallsForRequired.length > 0) {
    return {
      status: COVERAGE_STATUS.UNMANAGED_MANUAL_COVERED_WARN,
      severity: 'warn',
      covered: true,
      missing: [],
      managedMissing,
      unmanagedManualCovered: managedMissing,
      unmanagedWalls: unmanagedWallsForRequired,
    };
  }

  return {
    status: COVERAGE_STATUS.COVERED,
    severity: 'ok',
    covered: true,
    missing: [],
    managedMissing,
    unmanagedManualCovered: [],
    unmanagedWalls: unmanagedWallsForRequired,
  };
}

function verifyProviderCoverage({ requiredCoverage = [], provider = 'provider', managedBlocks = [], unmanagedWalls = [] } = {}) {
  const managedByCar = groupByCar(managedBlocks);
  const unmanagedByCar = groupByCar(unmanagedWalls);
  const results = [];

  for (const required of requiredCoverage) {
    const carNumber = String(required.carNumber || '');
    const providerManagedBlocks = managedByCar.get(carNumber) || [];
    const providerUnmanagedWalls = unmanagedByCar.get(carNumber) || [];
    const classification = classifyCoverage({
      required,
      managedBlocks: providerManagedBlocks,
      unmanagedWalls: providerUnmanagedWalls,
    });
    results.push({
      provider,
      imsReservationId: required.imsReservationId,
      sourceImsReservationIds: required.sourceImsReservationIds || [required.imsReservationId].filter(Boolean),
      carNumber,
      required,
      ...classification,
    });
  }

  return results;
}

function intervalsOverlap(left, right) {
  const a = normalizeInterval(left);
  const b = normalizeInterval(right);
  if (!a || !b) return false;
  return a.start < b.end && b.start < a.end;
}

function verifyExternalBlockCoverage({ imsReservations = [], homepageBlocks = [], zzimcar = {}, carmore = {} } = {}) {
  const requiredCoverage = buildImsRequiredCoverage(imsReservations);
  const homepage = verifyProviderCoverage({ requiredCoverage, provider: 'homepage', managedBlocks: homepageBlocks });
  const zzimcarResults = verifyProviderCoverage({
    requiredCoverage,
    provider: 'zzimcar',
    managedBlocks: zzimcar.managedBlocks || [],
    unmanagedWalls: zzimcar.unmanagedWalls || [],
  });
  const carmoreResults = verifyProviderCoverage({
    requiredCoverage,
    provider: 'carmore',
    managedBlocks: carmore.managedBlocks || [],
    unmanagedWalls: carmore.unmanagedWalls || [],
  });
  const providerResults = [...homepage, ...zzimcarResults, ...carmoreResults];
  const missingCoverage = providerResults.filter((result) => result.status === COVERAGE_STATUS.MISSING);
  const unmanagedManualCoveredWarnings = providerResults.filter((result) => result.status === COVERAGE_STATUS.UNMANAGED_MANUAL_COVERED_WARN);
  const unknownCoverage = providerResults.filter((result) => result.status === COVERAGE_STATUS.UNKNOWN);
  const unmanagedWallConflicts = providerResults.flatMap((result) => (
    result.unmanagedWalls.map((wall) => ({ provider: result.provider, carNumber: result.carNumber, required: result.required, wall }))
  ));

  return {
    readOnly: true,
    requiredCoverage,
    providers: { homepage, zzimcar: zzimcarResults, carmore: carmoreResults },
    missingCoverage,
    unmanagedManualCoveredWarnings,
    unknownCoverage,
    criticalMissingCount: missingCoverage.length,
    warningCount: unmanagedManualCoveredWarnings.length,
    unknownCount: unknownCoverage.length,
    unmanagedWallConflicts,
  };
}

module.exports = {
  COVERAGE_STATUS,
  classifyCoverage,
  subtractIntervals,
  verifyExternalBlockCoverage,
  verifyProviderCoverage,
};
