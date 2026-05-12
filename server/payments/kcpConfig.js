'use strict'

const KCP_ENDPOINTS = {
  test: {
    tradeRegisterUrl: 'https://testsmpay.kcp.co.kr/trade/register.do',
    approveUrl: 'https://stg-spl.kcp.co.kr/gw/enc/v1/payment',
  },
  production: {
    tradeRegisterUrl: 'https://smpay.kcp.co.kr/trade/register.do',
    approveUrl: 'https://spl.kcp.co.kr/gw/enc/v1/payment',
  },
}

function resolveKcpMode(env = process.env) {
  const explicit = String(env.KCP_MODE || env.KCP_ENV || '').trim().toLowerCase()
  if (['test', 'sandbox', 'staging', 'stage'].includes(explicit)) return 'test'
  if (['production', 'prod', 'live'].includes(explicit)) return 'production'

  const siteCode = String(env.KCP_SITE_CD || '').trim()
  if (/^T/i.test(siteCode)) {
    return 'test'
  }

  return env.NODE_ENV === 'production' ? 'production' : 'test'
}

function getKcpConfig(env = process.env) {
  const mode = resolveKcpMode(env)
  const siteCode = String(env.KCP_SITE_CD || '').trim()
  const siteKey = String(env.KCP_SITE_KEY || '').trim()
  const certInfo = String(env.KCP_CERT_INFO || '').trim().replace(/\\n/g, '\n')

  return {
    mode,
    siteCode,
    siteKey,
    certInfo,
    ...KCP_ENDPOINTS[mode],
  }
}

function assertKcpConfig(env = process.env) {
  const config = getKcpConfig(env)
  const missing = []

  if (!config.siteCode) missing.push('KCP_SITE_CD')
  if (!config.certInfo) missing.push('KCP_CERT_INFO')

  if (missing.length > 0) {
    const error = new Error(`kcp_config_missing:${missing.join(',')}`)
    error.code = 'kcp_config_missing'
    error.missing = missing
    throw error
  }

  return config
}

module.exports = {
  KCP_ENDPOINTS,
  getKcpConfig,
  assertKcpConfig,
  resolveKcpMode,
}
