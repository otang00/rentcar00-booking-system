function formatDisplay(dateText) {
  const [datePart = '', timePart = ''] = String(dateText || '').split(' ')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour = '00', minute = '00'] = timePart.split(':')
  const d = new Date(year || 0, (month || 1) - 1, day || 1)
  const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] || ''
  return `${String(month || '').padStart(2, '0')}.${String(day || '').padStart(2, '0')}(${week}) ${hour}:${minute}`
}

function formatIsoToLocalDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function getPickupLabel(snapshot, pickupMethod) {
  if (pickupMethod !== 'delivery') return '회사 방문 수령'
  if (!snapshot) return '-'
  return [snapshot.deliveryAddress, snapshot.deliveryAddressDetail].filter(Boolean).join(' ')
}

function resolveBookingPresentation(booking = {}) {
  const bookingStatus = String(booking.bookingStatus || '')
  const paymentStatus = String(booking.paymentStatus || '')

  if (bookingStatus === 'cancelled') {
    const paymentPresentation = paymentStatus === 'refunded'
      ? { statusLabel: '환불 완료', statusTone: 'cancelled' }
      : paymentStatus === 'refund_pending'
        ? { statusLabel: '환불 처리 중', statusTone: 'pending' }
        : { statusLabel: '예약 취소', statusTone: 'cancelled' }

    return {
      status: 'cancelled',
      statusLabel: paymentPresentation.statusLabel,
      statusTone: paymentPresentation.statusTone,
      canCancel: false,
    }
  }

  if (bookingStatus === 'confirmed') {
    return {
      status: 'confirmed',
      statusLabel: '예약 확정',
      statusTone: 'confirmed',
      canCancel: true,
    }
  }

  return {
    status: bookingStatus || 'unknown',
    statusLabel: bookingStatus || '상태 확인 필요',
    statusTone: 'confirmed',
    canCancel: false,
  }
}

export function toBookingViewModel(booking) {
  if (!booking) return null

  const presentation = resolveBookingPresentation(booking)

  return {
    ...booking,
    reservationNumber: booking.publicReservationCode,
    carNumber: booking.pricingSnapshot?.carNumber || '',
    ...presentation,
    pricing: {
      finalPrice: `${Number(booking.quotedTotalAmount || 0).toLocaleString('ko-KR')}원`,
      rawFinalPrice: Number(booking.quotedTotalAmount || 0),
    },
    schedule: {
      deliveryDateTime: formatIsoToLocalDateTime(booking.pickupAt),
      returnDateTime: formatIsoToLocalDateTime(booking.returnAt),
      pickupOption: booking.pickupMethod,
      deliveryAddress: booking.pickupLocationSnapshot?.deliveryAddress || '',
      deliveryAddressDetail: booking.pickupLocationSnapshot?.deliveryAddressDetail || '',
      displayPickupLabel: getPickupLabel(booking.pickupLocationSnapshot, booking.pickupMethod),
    },
    display: {
      pickupAt: formatDisplay(formatIsoToLocalDateTime(booking.pickupAt)),
      returnAt: formatDisplay(formatIsoToLocalDateTime(booking.returnAt)),
    },
  }
}
