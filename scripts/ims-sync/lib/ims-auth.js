const crypto = require('crypto');

const IMS_API_BASE_URL = process.env.IMS_API_BASE_URL || 'https://api.rencar.co.kr';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function getAuthorizationHeader(token) {
  return `JWT ${token}`;
}

function resolveImsPassword(env = process.env) {
  const candidates = [
    env.IMS_PW,
    env.IMS_PASSWORD,
  ];

  for (const candidate of candidates) {
    if (candidate && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }

  return '';
}

async function loginToIms(options = {}) {
  const username = options.username || process.env.IMS_ID;
  const password = options.password || resolveImsPassword();

  if (!username) {
    throw new Error('IMS_ID is required');
  }

  if (!password) {
    throw new Error('IMS_PW or IMS_PASSWORD is required');
  }

  const passwordHash = sha256Hex(password);
  const response = await fetch(`${IMS_API_BASE_URL}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'rentcar00-booking-system/ims-sync',
    },
    body: JSON.stringify({
      username,
      password: passwordHash,
      disableErrorHandler: true,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.access_token) {
    const detail = data?.error_name || data?.message || `HTTP ${response.status}`;
    const error = new Error(`IMS auth failed: ${detail}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return {
    accessToken: data.access_token,
    enabled: data.enabled,
    authorization: getAuthorizationHeader(data.access_token),
    passwordHash,
    raw: data,
  };
}

module.exports = {
  IMS_API_BASE_URL,
  getAuthorizationHeader,
  loginToIms,
  sha256Hex,
};
