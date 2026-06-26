const { IMS_API_BASE_URL, loginToIms } = require('./lib/ims-auth');

function buildVehiclesQuery(params = {}) {
  return new URLSearchParams({
    page: String(params.page || 1),
    state: params.state || 'all',
    per_page: String(params.perPage || 200),
  });
}

async function fetchVehiclesPage({ authorization, page = 1, ...rest } = {}) {
  const authHeader = authorization || (await loginToIms()).authorization;
  const query = buildVehiclesQuery({ page, ...rest });
  const response = await fetch(`${IMS_API_BASE_URL}/v2/rent-company-cars?${query.toString()}`, {
    headers: {
      Authorization: authHeader,
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'rentcar00-booking-system/ims-sync',
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    const detail = data?.error_name || data?.message || `HTTP ${response.status}`;
    const error = new Error(`IMS vehicles fetch failed: ${detail}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return {
    page,
    query: Object.fromEntries(query.entries()),
    vehicles: Array.isArray(data.list) ? data.list : [],
    totalPage: Number(data.total_page || 1),
    raw: data,
  };
}

async function fetchAllVehicles(options = {}) {
  const authHeader = options.authorization || (await loginToIms()).authorization;
  const pages = [];
  let page = Number(options.page || 1);

  while (true) {
    const current = await fetchVehiclesPage({ ...options, authorization: authHeader, page });
    pages.push(current);

    const isLastPage = current.vehicles.length === 0 || page >= current.totalPage;
    if (isLastPage) break;
    page += 1;
  }

  return {
    authorization: authHeader,
    pages,
    vehicles: pages.flatMap((entry) => entry.vehicles),
    totalPagesFetched: pages.length,
  };
}

module.exports = {
  buildVehiclesQuery,
  fetchVehiclesPage,
  fetchAllVehicles,
};
