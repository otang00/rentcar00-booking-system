const fs = require('fs');
const crypto = require('crypto');

const CARMORE_BASE_URL = process.env.CARMORE_BASE_URL || 'https://partners.carmore.kr/partners';
const DEFAULT_ENV_PATH = process.env.CARMORE_ENV_PATH || '/Users/otang_server/.openclaw/skills/manual/manuals/carmore-api/files/.env';
const DEFAULT_VENDORS_PATH = process.env.CARMORE_VENDORS_PATH || '/tmp/carmore_js/vendors.bundle.js';

function readEnvFile(path = DEFAULT_ENV_PATH) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(fs.readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1)];
    }));
}

function makeCarmoreCrypto(vendorsPath = DEFAULT_VENDORS_PATH) {
  const vendors = fs.readFileSync(vendorsPath, 'utf8');
  const secret = vendors.match(/var I=t\.CRYPTR="([^"]+)"/)?.[1];
  if (!secret) throw new Error(`CRYPTR secret not found in ${vendorsPath}`);
  const decryptCryptr = (hex) => {
    const data = Buffer.from(hex, 'hex');
    const iv = data.subarray(0, 16);
    const ciphertext = data.subarray(16);
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString();
  };
  const key = Buffer.from(decryptCryptr('af6cdb0c62926edd14ebcd3f69b8768369e61d07e0760258b4f1783597c870c8b9eff6147d2d7e259a994f1948f5674b'), 'hex');
  const iv = Buffer.from(decryptCryptr('10232e435bf93eabe211105f0ec71f87deeea7a4596275ef188d6a922b06a50643905110c605949e61b419ee688abb73'), 'hex');
  return {
    encForServer(value) {
      const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
      return encodeURIComponent(Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]).toString('base64'));
    },
  };
}

function addParam(params, key, value) {
  if (value == null) return;
  if (Array.isArray(value)) value.forEach((item, idx) => addParam(params, `${key}[${idx}]`, item));
  else if (typeof value === 'object') Object.keys(value).forEach((childKey) => addParam(params, `${key}[${childKey}]`, value[childKey]));
  else params.push([key, String(value)]);
}

function formBody(payload) {
  const params = [];
  Object.keys(payload || {}).forEach((key) => addParam(params, key, payload[key]));
  return params.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
}

function normalizeHolidayRow(row) {
  if (!row) return null;
  return {
    serial: row.serial != null ? String(row.serial) : (row.holidaySerial != null ? String(row.holidaySerial) : null),
    memo: row.memo || row.title || '',
    startDate: row.startDate || row.start_date || null,
    endDate: row.endDate || row.end_date || null,
    state: row.state != null ? String(row.state) : null,
    raw: row,
  };
}

class CarmoreClient {
  constructor(options = {}) {
    const fileEnv = readEnvFile(options.envPath || DEFAULT_ENV_PATH);
    this.baseUrl = options.baseUrl || CARMORE_BASE_URL;
    this.username = options.username || process.env.CARMORE_USERNAME || fileEnv.CARMORE_USERNAME;
    this.password = options.password || process.env.CARMORE_PASSWORD || fileEnv.CARMORE_PASSWORD;
    this.cookie = options.cookie || '';
    this.fetchImpl = options.fetchImpl || global.fetch;
    this.crypto = options.crypto || makeCarmoreCrypto(options.vendorsPath || DEFAULT_VENDORS_PATH);
    this.session = options.session || null;

    if (typeof this.fetchImpl !== 'function') throw new Error('fetch implementation is required');
  }

  async post(path, data) {
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/php/${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        cookie: this.cookie,
        'x-requested-with': 'XMLHttpRequest',
        referer: `${this.baseUrl.replace(/\/$/, '')}/main.html`,
      },
      body: formBody(data),
    });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
    if (setCookies.length) this.cookie = [this.cookie, ...setCookies.map((item) => item.split(';')[0])].filter(Boolean).join('; ');
    const text = await res.text();
    try { return JSON.parse(text); } catch { throw new Error(`${path} non-json ${res.status}: ${text.slice(0, 200)}`); }
  }

  async login() {
    if (!this.username) throw new Error('CARMORE_USERNAME is required');
    if (!this.password) throw new Error('CARMORE_PASSWORD is required');
    const result = await this.post('set/loginProcess.php', {
      id: this.crypto.encForServer(this.username),
      pw: this.crypto.encForServer(this.password),
      isJejuApi: 0,
    });
    if (!(result.loginCheck === 1 || result.loginCheck === 4)) throw new Error(`Carmore login failed: ${JSON.stringify(result)}`);
    this.session = {
      companySerial: result.rentCompanySerial,
      branchSerial: result.rentCompanyBranchSerial,
      dealerSerial: result.serial,
    };
    return { ok: true, ...this.session };
  }

  async ensureLoggedIn() {
    if (this.session) return { ok: true, reused: true, ...this.session };
    return this.login();
  }

  async getRentcarHolidays({ rentcarSerial }) {
    const session = await this.ensureLoggedIn();
    const result = await this.post('get/JSON/rentcarHoliday.php', { ...session, rentcarSerial: String(rentcarSerial) });
    if (Number(result.result) !== 1) throw new Error(`Carmore rentcarHoliday failed: ${JSON.stringify(result)}`);
    return (Array.isArray(result.list) ? result.list : []).map(normalizeHolidayRow).filter(Boolean);
  }

  async createHoliday({ rentcarSerial, memo, startDate, endDate }) {
    const session = await this.ensureLoggedIn();
    const payload = { ...session, rentcarSerial: [String(rentcarSerial)], memo: String(memo || ''), startDate: String(startDate), endDate: String(endDate), serial: 'new' };
    const result = await this.post('set/setCarmoreRentcarHoliday.php', payload);
    if (Number(result.result) !== 1) throw new Error(`Carmore holiday create failed: ${JSON.stringify(result)}`);
    const rows = await this.getRentcarHolidays({ rentcarSerial });
    const exact = rows.find((row) => row.memo === payload.memo && row.startDate === payload.startDate && row.endDate === payload.endDate) || null;
    return { payload, result, holidaySerial: exact?.serial || null, row: exact };
  }

  async deleteHoliday({ holidaySerial }) {
    const session = await this.ensureLoggedIn();
    const result = await this.post('set/deleteCarmoreRentcarHoliday.php', { ...session, holidaySerial: String(holidaySerial) });
    if (Number(result.result) !== 1) throw new Error(`Carmore holiday delete failed: ${JSON.stringify(result)}`);
    return { result };
  }
}

module.exports = {
  CARMORE_BASE_URL,
  CarmoreClient,
  addParam,
  formBody,
  makeCarmoreCrypto,
  normalizeHolidayRow,
  readEnvFile,
};
