'use strict'

function getAccessTokenFromRequest(req = {}) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const value = Array.isArray(header) ? header[0] : header
  if (!value || typeof value !== 'string') return ''

  const match = value.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

module.exports = {
  getAccessTokenFromRequest,
}
