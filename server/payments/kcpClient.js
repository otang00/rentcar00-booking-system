'use strict'

const { assertKcpConfig } = require('./kcpConfig')

async function readResponseBody(response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

function readKcpMessage(payload, fallback) {
  return payload?.res_msg || payload?.message || payload?.Message || payload?.raw || fallback
}

function readKcpCode(payload, fallback = '') {
  return String(payload?.res_cd || payload?.Code || payload?.code || fallback || '')
}

function stringifyAmount(amount) {
  const normalized = Number(amount || 0)
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error('invalid_payment_amount')
  }

  return String(Math.round(normalized))
}

async function registerKcpTrade({
  orderId,
  amount,
  goodName,
  returnUrl,
  buyerName,
  buyerPhone,
  buyerEmail,
  sessionToken,
} = {}) {
  const config = assertKcpConfig()
  const body = {
    site_cd: config.siteCode,
    ordr_idxx: String(orderId || '').trim(),
    good_mny: stringifyAmount(amount),
    good_name: String(goodName || '렌터카 예약').trim() || '렌터카 예약',
    pay_method: 'CARD',
    Ret_URL: String(returnUrl || '').trim(),
    user_agent: 'Mozilla/5.0',
    currency: '410',
    buyr_name: String(buyerName || '').trim(),
    buyr_tel2: String(buyerPhone || '').trim(),
    buyr_mail: String(buyerEmail || '').trim(),
    param_opt_1: String(sessionToken || '').trim(),
    param_opt_2: 'website_booking',
  }

  const response = await fetch(config.tradeRegisterUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  })

  const payload = await readResponseBody(response)

  if (!response.ok) {
    const message = readKcpMessage(payload, 'kcp_trade_register_failed')
    const error = new Error(message)
    error.code = 'kcp_trade_register_failed'
    error.payload = payload
    throw error
  }

  if (readKcpCode(payload) !== '0000') {
    const error = new Error(readKcpMessage(payload, 'kcp_trade_register_failed'))
    error.code = 'kcp_trade_register_rejected'
    error.payload = payload
    throw error
  }

  return payload
}

async function approveKcpPayment({
  orderId,
  amount,
  encData,
  encInfo,
} = {}) {
  const config = assertKcpConfig()
  const response = await fetch(config.approveUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      site_cd: config.siteCode,
      kcp_cert_info: config.certInfo,
      enc_data: String(encData || '').trim(),
      enc_info: String(encInfo || '').trim(),
      tran_cd: '00100000',
      ordr_mony: stringifyAmount(amount),
      ordr_no: String(orderId || '').trim(),
      pay_type: 'PACA',
    }),
  })

  const payload = await readResponseBody(response)

  if (!response.ok) {
    const message = readKcpMessage(payload, 'kcp_payment_approve_failed')
    const error = new Error(message)
    error.code = 'kcp_payment_approve_failed'
    error.payload = payload
    throw error
  }

  if (readKcpCode(payload) !== '0000') {
    const error = new Error(readKcpMessage(payload, 'kcp_payment_approve_failed'))
    error.code = 'kcp_payment_approve_rejected'
    error.payload = payload
    throw error
  }

  return payload
}

module.exports = {
  registerKcpTrade,
  approveKcpPayment,
  stringifyAmount,
}
