const { IMS_API_BASE_URL, loginToIms } = require('./lib/ims-auth');

const DEFAULT_SYNC_WINDOW_DAYS = Number(process.env.IMS_SYNC_WINDOW_DAYS || 180);
const DEFAULT_MAX_RENTAL_DAYS = Number(process.env.IMS_SYNC_MAX_RENTAL_DAYS || 30);

function formatDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildReservationsQuery(params = {}) {
  const today = params.baseDate ? new Date(params.baseDate) : new Date();
  const startDate = params.start ? new Date(params.start) : today;
  const windowDays = Number.isFinite(Number(params.windowDays)) ? Number(params.windowDays) : DEFAULT_SYNC_WINDOW_DAYS;
  const endDate = params.end ? new Date(params.end) : addDays(startDate, windowDays);

  const query = new URLSearchParams({
    page: String(params.page || 1),
    base_date: formatDate(today),
    rental_type: params.rentalType || 'all',
    status: params.status || 'all',
    exclude_returned: String(params.excludeReturned ?? false),
    date_option: params.dateOption || 'end_at',
    start: formatDate(startDate),
    end: formatDate(endDate),
  });

  if (params.option) {
    query.set('option', params.option);
  }

  return query;
}

async function fetchReservationsPage({ authorization, page = 1, ...rest } = {}) {
  const authHeader = authorization || (await loginToIms()).authorization;
  const query = buildReservationsQuery({ page, ...rest });
  const response = await fetch(`${IMS_API_BASE_URL}/v2/company-car-schedules/reservations?${query.toString()}`, {
    headers: {
      Authorization: authHeader,
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'rentcar00-booking-system/ims-sync',
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    const detail = data?.error_name || data?.message || `HTTP ${response.status}`;
    const error = new Error(`IMS reservations fetch failed: ${detail}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return {
    page,
    query: Object.fromEntries(query.entries()),
    schedules: Array.isArray(data.schedules) ? data.schedules : [],
    totalPage: Number(data.total_page || 1),
    defaultInfo: data.defaultInfo || null,
    raw: data,
  };
}

async function fetchAllReservations(options = {}) {
  const authHeader = options.authorization || (await loginToIms()).authorization;
  const pages = [];
  let page = Number(options.page || 1);

  while (true) {
    const current = await fetchReservationsPage({ ...options, authorization: authHeader, page });
    pages.push(current);

    const isLastPage = current.schedules.length === 0 || page >= current.totalPage;
    if (isLastPage) break;
    page += 1;
  }

  return {
    authorization: authHeader,
    pages,
    schedules: pages.flatMap((entry) => entry.schedules),
    totalPagesFetched: pages.length,
  };
}

function dedupeSchedulesById(schedules = []) {
  const scheduleMap = new Map();

  for (const schedule of schedules) {
    const key = schedule?.id != null ? String(schedule.id) : null;
    if (!key) continue;
    if (!scheduleMap.has(key)) {
      scheduleMap.set(key, schedule);
    }
  }

  return Array.from(scheduleMap.values());
}

async function fetchReservationSyncBatch(options = {}) {
  const authHeader = options.authorization || (await loginToIms()).authorization;
  const futureWindowDays = Number.isFinite(Number(options.futureWindowDays))
    ? Number(options.futureWindowDays)
    : DEFAULT_SYNC_WINDOW_DAYS;
  const maxRentalDays = Number.isFinite(Number(options.maxRentalDays))
    ? Number(options.maxRentalDays)
    : DEFAULT_MAX_RENTAL_DAYS;
  const baseOptions = {
    ...options,
    authorization: authHeader,
  };

  const endAtResult = await fetchAllReservations({
    ...baseOptions,
    dateOption: 'end_at',
    windowDays: futureWindowDays + maxRentalDays,
  });

  const startAtResult = await fetchAllReservations({
    ...baseOptions,
    dateOption: 'start_at',
    windowDays: futureWindowDays,
  });

  const schedules = dedupeSchedulesById([
    ...endAtResult.schedules,
    ...startAtResult.schedules,
  ]);

  return {
    authorization: authHeader,
    schedules,
    totalPagesFetched: endAtResult.totalPagesFetched + startAtResult.totalPagesFetched,
    scopeResults: {
      endAt: {
        totalPagesFetched: endAtResult.totalPagesFetched,
        schedulesCount: endAtResult.schedules.length,
        query: endAtResult.pages?.[0]?.query || null,
      },
      startAt: {
        totalPagesFetched: startAtResult.totalPagesFetched,
        schedulesCount: startAtResult.schedules.length,
        query: startAtResult.pages?.[0]?.query || null,
      },
    },
    dedupedCount: schedules.length,
  };
}

module.exports = {
  DEFAULT_MAX_RENTAL_DAYS,
  DEFAULT_SYNC_WINDOW_DAYS,
  buildReservationsQuery,
  fetchReservationsPage,
  fetchAllReservations,
  fetchReservationSyncBatch,
  dedupeSchedulesById,
};
