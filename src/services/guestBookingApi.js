import { parseApiResponse } from '../utils/apiResponse'
import { toBookingViewModel } from './bookingViewModel'

export async function prepareGuestBookingPayment(payload, options = {}) {
  const accessToken = options.session?.access_token
  const response = await fetch('/api/payments/prepare', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  return parseApiResponse(response, '결제 준비에 실패했습니다.')
}

export async function lookupGuestBooking(payload) {
  const response = await fetch('/api/guest-bookings/lookup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const result = await parseApiResponse(response, '예약 조회에 실패했습니다.')
  return {
    bookings: Array.isArray(result.bookings) ? result.bookings.map((booking) => toBookingViewModel(booking)).filter(Boolean) : [],
    lookupToken: result.lookupToken || '',
    lookupTokenExpiresAt: result.lookupTokenExpiresAt || null,
    verifiedPhone: result.verifiedPhone || '',
  }
}

export async function fetchCompletedGuestBooking(completionToken) {
  const response = await fetch('/api/guest-bookings/lookup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ completionToken }),
  })
  const result = await parseApiResponse(response, '예약 정보를 찾지 못했습니다.')
  return {
    booking: toBookingViewModel(result.booking),
  }
}

export async function cancelGuestBooking(payload) {
  const response = await fetch('/api/guest-bookings/cancel', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const result = await parseApiResponse(response, '예약 취소에 실패했습니다.')
  return {
    booking: toBookingViewModel(result.booking),
    lookupTokenExpiresAt: result.lookupTokenExpiresAt || null,
  }
}
