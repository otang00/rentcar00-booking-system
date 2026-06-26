import { parseApiResponse } from '../utils/apiResponse'
import { toBookingViewModel } from './memberBookingApi'

function getAuthorizationHeaders(session) {
  const accessToken = session?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export async function getAdminBookings(session, params = {}) {
  const searchParams = new URLSearchParams()
  if (params.tab) searchParams.set('tab', params.tab)
  if (params.q) searchParams.set('q', params.q)
  if (params.qField) searchParams.set('qField', params.qField)
  if (params.page) searchParams.set('page', String(params.page))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))

  const response = await fetch(`/api/admin/bookings?${searchParams.toString()}`, {
    method: 'GET',
    headers: {
      ...getAuthorizationHeaders(session),
    },
  })

  const result = await parseApiResponse(response, '관리자 예약 목록을 불러오지 못했습니다.')
  return {
    items: Array.isArray(result.items)
      ? result.items.map((item) => ({
        ...item,
        booking: toBookingViewModel({
          publicReservationCode: item.reservationNumber,
          pricingSnapshot: {
            carName: item.carName,
            carNumber: item.carNumber,
          },
          customerName: item.customerName,
          pickupAt: item.pickupAt,
          returnAt: item.returnAt,
          quotedTotalAmount: item.quotedTotalAmount,
          bookingStatus: item.bookingStatus,
          paymentStatus: item.paymentStatus,
        }),
      }))
      : [],
    page: Number(result.page || 1),
    pageSize: Number(result.pageSize || 20),
    total: Number(result.total || 0),
    filters: result.filters || {},
    imsSync: result.imsSync || null,
    imsSyncErrors: Array.isArray(result.imsSyncErrors) ? result.imsSyncErrors : [],
    zzimcarSync: result.zzimcarSync || null,
    zzimcarSyncErrors: Array.isArray(result.zzimcarSyncErrors) ? result.zzimcarSyncErrors : [],
  }
}
