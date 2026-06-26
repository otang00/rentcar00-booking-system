'use strict'

const { SolapiMessageService } = require('solapi')

let cachedService = null
let cachedKey = ''
let cachedSecret = ''

function createMessageService(env = process.env) {
  const apiKey = String(env.SOLAPI_API_KEY || '').trim()
  const apiSecret = String(env.SOLAPI_API_SECRET || '').trim()

  if (!apiKey || !apiSecret) {
    throw new Error('Solapi API 설정이 준비되지 않았습니다.')
  }

  if (!cachedService || cachedKey !== apiKey || cachedSecret !== apiSecret) {
    cachedService = new SolapiMessageService(apiKey, apiSecret)
    cachedKey = apiKey
    cachedSecret = apiSecret
  }

  return cachedService
}

async function sendSolapiMessage({ to, text, env = process.env } = {}) {
  const from = String(env.SOLAPI_SENDER || '').trim()
  if (!from) {
    throw new Error('SOLAPI_SENDER 설정이 준비되지 않았습니다.')
  }

  const messageService = createMessageService(env)
  const result = await messageService.send({
    to,
    from,
    text,
  })

  const messageId = result?.messageId || result?.messageList?.[0]?.messageId || result?.messages?.[0]?.messageId || null

  return {
    raw: result,
    messageId,
  }
}

module.exports = {
  sendSolapiMessage,
}
