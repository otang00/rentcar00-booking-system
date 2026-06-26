import { cancelMemberBooking as cancelMemberBookingRequest, fetchMemberBookingDetail, fetchMemberBookings } from './authApi'
import { toBookingViewModel } from './bookingViewModel'

export { toBookingViewModel }

export async function getMemberBookings(session) {
  const result = await fetchMemberBookings(session)
  return {
    profile: result.profile || null,
    bookings: Array.isArray(result.bookings) ? result.bookings.map(toBookingViewModel) : [],
  }
}

export async function getMemberBookingDetail(session, reservationCode) {
  const result = await fetchMemberBookingDetail(session, reservationCode)
  return {
    booking: toBookingViewModel(result.booking),
  }
}

export async function cancelMemberBooking(session, reservationCode, payload = {}) {
  const result = await cancelMemberBookingRequest(session, reservationCode, payload)
  return {
    booking: toBookingViewModel(result.booking),
    mapping: result.mapping || null,
  }
}
