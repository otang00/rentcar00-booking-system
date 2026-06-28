import { buildSearchQuery } from '../utils/searchQuery'
import { company as mockCompany } from '../data/mock'
import { parseApiResponse } from '../utils/apiResponse'

export function getMockCompany() {
  return mockCompany
}

export function mergeCompanyWithFallback(company) {
  const hasApiDeliveryCostList = Array.isArray(company?.deliveryCostList)
  return {
    ...mockCompany,
    ...(company || {}),
    deliveryCostList: hasApiDeliveryCostList
      ? company.deliveryCostList
      : mockCompany.deliveryCostList,
  }
}

export async function fetchSearchCompany(searchState) {
  const query = buildSearchQuery({
    ...searchState,
    pickupOption: 'pickup',
    dongId: null,
    deliveryAddress: '',
  })

  const response = await fetch(`/api/search-cars?${query}`)
  const payload = await parseApiResponse(response, '회사 정보를 불러오지 못했습니다.')

  return mergeCompanyWithFallback(payload.company)
}
