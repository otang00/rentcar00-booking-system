const { normalizeCarNumber, buildDisableTimeCreatePayload, buildDisableTimeDeletePayload, buildDisableTimeListPath } = require('./disable-time');

const ZZIMCAR_BASE_URL = process.env.ZZIMCAR_BASE_URL || 'https://admin.zzimcar.com';

function buildUrl(pathname) {
  return new URL(pathname, ZZIMCAR_BASE_URL).toString();
}

function buildLoginFormBody({ username, password }) {
  const params = new URLSearchParams();
  params.set('username', String(username || '').trim());
  params.set('password', String(password || '').trim());
  return params.toString();
}

function extractSessionCookie(setCookieHeader) {
  const header = String(setCookieHeader || '');
  const match = header.match(/(?:^|,\s*)SESSION=([^;\s,]+)/);
  return match ? `SESSION=${match[1]}` : '';
}

function parseVehiclePagingResponse(payload, targetCarNumber) {
  const normalizedTarget = normalizeCarNumber(targetCarNumber);
  const data = Array.isArray(payload?.data) ? payload.data : [];
  const matches = data.filter((row) => normalizeCarNumber(row?.carNum) === normalizedTarget);

  return {
    recordsTotal: Number(payload?.recordsTotal || 0),
    recordsFiltered: Number(payload?.recordsFiltered || 0),
    matches,
    match: matches[0] || null,
  };
}

function formatKstDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(formatter.formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

class ZzimcarClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || ZZIMCAR_BASE_URL;
    this.username = options.username || process.env.ZZIMCAR_ID;
    this.password = options.password || process.env.ZZIMCAR_PASSWORD;
    this.cookie = options.cookie || '';
    this.fetchImpl = options.fetchImpl || global.fetch;

    if (typeof this.fetchImpl !== 'function') {
      throw new Error('fetch implementation is required');
    }
  }

  async request(pathname, options = {}) {
    const headers = new Headers(options.headers || {});
    if (this.cookie) {
      headers.set('Cookie', this.cookie);
    }

    const response = await this.fetchImpl(buildUrl(pathname), {
      method: options.method || 'GET',
      redirect: options.redirect || 'manual',
      headers,
      body: options.body,
    });

    const setCookie = response.headers.get('set-cookie');
    const sessionCookie = extractSessionCookie(setCookie);
    if (sessionCookie) {
      this.cookie = sessionCookie;
    }

    return response;
  }

  async login() {
    if (!this.username) throw new Error('ZZIMCAR_ID is required');
    if (!this.password) throw new Error('ZZIMCAR_PASSWORD is required');

    const response = await this.request('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: this.baseUrl,
        Referer: buildUrl('/login'),
      },
      body: buildLoginFormBody({ username: this.username, password: this.password }),
    });

    const location = response.headers.get('location') || '';
    const isLoginErrorRedirect = /\/login\?error/i.test(location);
    const isSuccessRedirect = response.status === 302 && !isLoginErrorRedirect;
    if (!isSuccessRedirect || !this.cookie) {
      this.cookie = '';
      throw new Error(isLoginErrorRedirect
        ? 'Zzimcar login failed: invalid credentials or rejected login'
        : `Zzimcar login failed: HTTP ${response.status}`);
    }

    return {
      ok: true,
      status: response.status,
      location,
      cookie: this.cookie,
    };
  }

  async ensureLoggedIn() {
    if (this.cookie) return { ok: true, cookie: this.cookie, reused: true };
    const result = await this.login();
    return { ...result, reused: false };
  }

  async findVehicleByCarNumber({ carNumber }) {
    await this.ensureLoggedIn();
    const normalized = normalizeCarNumber(carNumber);
    const query = new URLSearchParams({
      draw: '1',
      start: '0',
      length: '10',
      'search[value]': normalized,
      'search[regex]': 'false',
    });

    const response = await this.request(`/vehicle/vehicle/paging?${query.toString()}`, {
      headers: { Accept: 'application/json, text/plain, */*' },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      throw new Error(`Vehicle search failed: HTTP ${response.status}`);
    }

    const parsed = parseVehiclePagingResponse(payload, normalized);
    if (parsed.matches.length === 0) {
      throw new Error(`Vehicle not found for carNumber=${normalized}`);
    }
    if (parsed.matches.length > 1) {
      throw new Error(`Multiple vehicles matched for carNumber=${normalized}`);
    }

    const row = parsed.match;
    return {
      carNumber: normalizeCarNumber(row.carNum),
      vehiclePid: String(row.pid),
      row,
    };
  }

  async getVehicleDetail({ vehiclePid }) {
    await this.ensureLoggedIn();
    const response = await this.request(`/vehicle/vehicle/detail/${String(vehiclePid)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        lang: 'ko',
      },
      body: '{}',
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      throw new Error(`Vehicle detail failed: HTTP ${response.status}`);
    }

    return payload;
  }

  async getDisableTimes({ vehiclePid }) {
    await this.ensureLoggedIn();
    const response = await this.request(buildDisableTimeListPath(vehiclePid), {
      headers: { Accept: 'application/json, text/plain, */*' },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload)) {
      throw new Error(`Disable time list failed: HTTP ${response.status}`);
    }

    return payload.map((row) => ({
      pid: row?.pid != null ? String(row.pid) : null,
      startDtime: row?.startDtime || row?.start_dtime || row?.startDate || null,
      endDtime: row?.endDtime || row?.end_dtime || row?.endDate || null,
      raw: row,
    }));
  }

  async createDisableTime({ vehiclePid, startDtime, endDtime }) {
    await this.ensureLoggedIn();
    const payload = buildDisableTimeCreatePayload({ vehiclePid, startDtime, endDtime });
    const response = await this.request('/vehicle/disable_time', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: this.baseUrl,
        Referer: buildUrl('/vehicle/vehicle'),
        lang: 'ko',
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = body?.message || body?.errors?.[0]?.defaultMessage || '';
      throw new Error(`Disable time create failed: HTTP ${response.status}${detail ? ` ${detail}` : ''}`);
    }

    return {
      payload,
      body,
      disableTimePid: body?.pid != null
        ? String(body.pid)
        : (body?.msg != null && String(body.msg).trim() ? String(body.msg).trim() : null),
    };
  }

  async deleteDisableTime({ pid }) {
    await this.ensureLoggedIn();
    const payload = buildDisableTimeDeletePayload({ pid });
    const response = await this.request('/vehicle/disable_time', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: this.baseUrl,
        Referer: buildUrl('/vehicle/vehicle'),
        lang: 'ko',
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = body?.message || body?.errors?.[0]?.defaultMessage || '';
      throw new Error(`Disable time delete failed: HTTP ${response.status}${detail ? ` ${detail}` : ''}`);
    }

    return { payload, body };
  }
}

module.exports = {
  ZZIMCAR_BASE_URL,
  ZzimcarClient,
  buildLoginFormBody,
  buildUrl,
  extractSessionCookie,
  formatKstDateTime,
  parseVehiclePagingResponse,
};
