import { parseApiResponse } from '../utils/apiResponse'

function getAuthorizationHeaders(session) {
  const accessToken = session?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

async function request(session, { method = 'GET', action = '', params = {}, body, fallbackMessage }) {
  const searchParams = new URLSearchParams()
  if (action) searchParams.set('action', action)
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value == null || value === '') return
    searchParams.set(key, String(value))
  })

  const url = `/api/admin/pricing-hub${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthorizationHeaders(session),
    },
    body: body ? JSON.stringify({ action, ...body }) : undefined,
  })

  return parseApiResponse(response, fallbackMessage)
}

export function listPricingHubGroups(session, params = {}) {
  return request(session, {
    method: 'GET',
    action: 'list-groups',
    params,
    fallbackMessage: '통합 요금 그룹 목록을 불러오지 못했습니다.',
  })
}

export function getPricingHubPolicyEditor(session, paramsOrPricePolicyGroupId) {
  const params = typeof paramsOrPricePolicyGroupId === 'object'
    ? paramsOrPricePolicyGroupId
    : { pricePolicyGroupId: paramsOrPricePolicyGroupId }

  return request(session, {
    method: 'GET',
    action: 'get-policy-editor',
    params,
    fallbackMessage: '통합 요금 편집 정보를 불러오지 못했습니다.',
  })
}

export function savePricingHubPeriod(session, payload) {
  return request(session, {
    method: 'POST',
    action: 'save-period',
    body: payload,
    fallbackMessage: '기간 저장에 실패했습니다.',
  })
}

export function savePricingHubRate(session, payload) {
  return request(session, {
    method: 'POST',
    action: 'save-rate',
    body: payload,
    fallbackMessage: '요율 저장에 실패했습니다.',
  })
}

export function savePricingHubEditor(session, payload) {
  return request(session, {
    method: 'POST',
    action: 'save-editor',
    body: payload,
    fallbackMessage: '요금 수정 저장에 실패했습니다.',
  })
}

