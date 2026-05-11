import { parseApiResponse } from '../utils/apiResponse'
import { toBookingViewModel } from './bookingViewModel'

export async function fetchAdminBookingConfirm(session, token) {
  const accessToken = session?.access_token
  const response = await fetch(`/api/admin/bookings?action=confirm-target&token=${encodeURIComponent(token)}`, {
    method: 'GET',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })

  const result = await parseApiResponse(response, '예약 확인 정보를 불러오지 못했습니다.')
  return {
    booking: toBookingViewModel(result.booking),
  }
}

export async function cancelAdminBooking(session, token, payload = {}) {
  const accessToken = session?.access_token
  const response = await fetch('/api/admin/bookings?action=cancel', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      token,
      reason: payload.reason || '',
    }),
  })

  const result = await parseApiResponse(response, '예약 취소에 실패했습니다.')
  return {
    booking: toBookingViewModel(result.booking),
    mapping: result.mapping || null,
  }
}

export async function completeAdminBookingRefund(session, token, payload = {}) {
  const accessToken = session?.access_token
  const response = await fetch('/api/admin/bookings?action=refund-complete', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      token,
      note: payload.note || '',
    }),
  })

  const result = await parseApiResponse(response, '환불 완료 처리에 실패했습니다.')
  return {
    booking: toBookingViewModel(result.booking),
  }
}
