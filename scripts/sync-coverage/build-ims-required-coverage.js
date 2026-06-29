'use strict';

const ACTIVE_IMS_STATUSES = new Set(['pending', 'confirmed', 'paid']);
const INACTIVE_IMS_STATUSES = new Set(['cancelled', 'completed', 'failed']);
const STATUS_PRIORITY = new Map([
  ['paid', 3],
  ['confirmed', 2],
  ['pending', 1],
]);

function getStatusPriority(status) {
  return STATUS_PRIORITY.get(String(status || '').trim().toLowerCase()) || 0;
}

function getPrimaryImsReservationId(sourceImsReservationIds = []) {
  return [...sourceImsReservationIds].map(String).sort()[0] || null;
}

function overlapsRequiredCoverage(left, right) {
  if (!left || !right) return false;
  const leftStart = new Date(left.startAt).getTime();
  const leftEnd = new Date(left.endAt).getTime();
  const rightStart = new Date(right.startAt).getTime();
  const rightEnd = new Date(right.endAt).getTime();
  if (![leftStart, leftEnd, rightStart, rightEnd].every(Number.isFinite)) return false;
  return leftStart < rightEnd && rightStart < leftEnd;
}

function buildRequiredCoverageCluster(row) {
  const sourceImsReservationIds = [String(row.imsReservationId)];
  return {
    imsReservationId: getPrimaryImsReservationId(sourceImsReservationIds),
    sourceImsReservationIds,
    carNumber: row.carNumber,
    startAt: row.startAt,
    endAt: row.endAt,
    status: String(row.status || ''),
    sourceReservations: [row],
  };
}

function mergeRequiredCoverageCluster(cluster, row) {
  const startAt = new Date(row.startAt).getTime() < new Date(cluster.startAt).getTime() ? row.startAt : cluster.startAt;
  const endAt = new Date(row.endAt).getTime() > new Date(cluster.endAt).getTime() ? row.endAt : cluster.endAt;
  const sourceReservations = [...cluster.sourceReservations, row];
  const sourceImsReservationIds = [...new Set(sourceReservations.map((source) => String(source.imsReservationId)))].sort();
  const status = sourceReservations.reduce((selected, source) => (
    getStatusPriority(source.status) > getStatusPriority(selected) ? String(source.status) : selected
  ), String(cluster.status || ''));

  return {
    imsReservationId: getPrimaryImsReservationId(sourceImsReservationIds),
    sourceImsReservationIds,
    carNumber: cluster.carNumber,
    startAt,
    endAt,
    status,
    sourceReservations,
  };
}

function buildImsRequiredCoverage(rows = []) {
  const sorted = [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const carCompare = String(a.carNumber).localeCompare(String(b.carNumber));
    if (carCompare !== 0) return carCompare;
    const startCompare = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    if (startCompare !== 0) return startCompare;
    return new Date(a.endAt).getTime() - new Date(b.endAt).getTime();
  });

  const clusters = [];
  for (const row of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && last.carNumber === row.carNumber && overlapsRequiredCoverage(last, row)) {
      clusters[clusters.length - 1] = mergeRequiredCoverageCluster(last, row);
      continue;
    }
    clusters.push(buildRequiredCoverageCluster(row));
  }
  return clusters;
}

module.exports = {
  ACTIVE_IMS_STATUSES,
  INACTIVE_IMS_STATUSES,
  buildImsRequiredCoverage,
  buildRequiredCoverageCluster,
  getPrimaryImsReservationId,
  mergeRequiredCoverageCluster,
  overlapsRequiredCoverage,
};
