'use strict'

const { createBookingConfirmToken } = require('../security/bookingConfirmToken')

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatLocalDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(/\. /g, '.').replace(/\.$/, '')
}

function formatPhone(value) {
  const digits = String(value || '').replace(/[^\d]/g, '')
  if (!digits) return '-'
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  return digits
}

function formatBirth(value) {
  const digits = String(value || '').replace(/[^\d]/g, '')
  if (!digits) return '-'
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
  }
  return digits
}

function buildOrigin(req) {
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim()
  const protocol = forwardedProto || 'https'
  const host = String(req?.headers?.host || '').trim()
  if (!host) {
    throw new Error('missing_request_host')
  }
  return `${protocol}://${host}`
}

function buildBookingConfirmationEmail({ booking, req, customerPhone, customerBirth } = {}) {
  if (!booking?.id || !booking?.publicReservationCode) {
    throw new Error('invalid_booking_for_confirmation_email')
  }

  const origin = buildOrigin(req)
  const { token } = createBookingConfirmToken({
    bookingOrderId: booking.id,
    reservationCode: booking.publicReservationCode,
  })

  const confirmUrl = `${origin}/admin/booking-confirm?token=${encodeURIComponent(token)}`
  const detailUrl = `${confirmUrl}&view=detail`
  const carName = booking.pricingSnapshot?.carName || '-'
  const carNumber = booking.pricingSnapshot?.carNumber || '-'
  const displayedCustomerPhone = formatPhone(customerPhone || booking.customerPhone || booking.customerPhoneLast4 || '')
  const displayedCustomerBirth = formatBirth(customerBirth || booking.customerBirth || '')
  const paymentMethod = booking.pricingSnapshot?.paymentMethod || '확인 필요'
  const totalAmount = `${Number(booking.quotedTotalAmount || 0).toLocaleString('ko-KR')}원`

  const subject = `[00렌트카] 예약 확정 ${booking.publicReservationCode}`
  const previewText = '결제가 완료되어 홈페이지 예약 원장에 확정 예약이 생성되었습니다. 관리자 상세에서 바로 확인해 주세요.'

  const text = [
    '예약 확정 알림',
    '',
    '결제가 완료되어 예약이 확정되었습니다.',
    `예약번호: ${booking.publicReservationCode}`,
    `고객명: ${booking.customerName || '-'}`,
    `연락처: ${displayedCustomerPhone}`,
    `생년월일: ${displayedCustomerBirth}`,
    `차량명: ${carName}`,
    `차량 번호: ${carNumber}`,
    `대여일시: ${formatLocalDateTime(booking.pickupAt)}`,
    `반납일시: ${formatLocalDateTime(booking.returnAt)}`,
    `배차/수령: ${booking.pickupLocationSnapshot?.pickupOption === 'delivery'
      ? booking.pickupLocationSnapshot?.deliveryAddress || '딜리버리'
      : '회사 방문 수령'}`,
    `총 금액: ${totalAmount}`,
    `결제수단: ${paymentMethod}`,
    '',
    '아래 링크는 관리자 로그인 후 사용할 수 있습니다.',
    '상세 페이지에서 예약 상태와 취소/환불 진행 여부를 확인해 주세요.',
    `관리자 상세 확인: ${detailUrl}`,
  ].join('\n')

  const html = `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(previewText)}</div>
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fb;padding:24px;color:#17212b;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:700;color:#166534;background:#f0fdf4;display:inline-block;padding:6px 10px;border-radius:999px;">예약 확정</div>
          <h1 style="margin:14px 0 8px;font-size:24px;line-height:1.3;">예약 확정 알림</h1>
          <p style="margin:0;color:#475569;line-height:1.6;">결제가 완료되어 홈페이지 예약 원장에 확정 예약이 생성되었습니다. 관리자 상세에서 바로 확인해 주세요.</p>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
          <div style="background:#f0fdf4;border-radius:12px;padding:14px;">
            <div style="font-size:12px;color:#166534;margin-bottom:6px;">상태</div>
            <strong style="font-size:16px;color:#166534;">예약 확정</strong>
          </div>
          <div style="background:#eff6ff;border-radius:12px;padding:14px;">
            <div style="font-size:12px;color:#1d4ed8;margin-bottom:6px;">결제상태</div>
            <strong style="font-size:16px;color:#1d4ed8;">결제 완료</strong>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tbody>
            ${[
              ['예약번호', booking.publicReservationCode],
              ['고객명', booking.customerName || '-'],
              ['연락처', displayedCustomerPhone],
              ['생년월일', displayedCustomerBirth],
              ['차량명', carName],
              ['차량 번호', carNumber],
              ['대여일시', formatLocalDateTime(booking.pickupAt)],
              ['반납일시', formatLocalDateTime(booking.returnAt)],
              ['배차/수령', booking.pickupLocationSnapshot?.pickupOption === 'delivery'
                ? booking.pickupLocationSnapshot?.deliveryAddress || '딜리버리'
                : '회사 방문 수령'],
              ['총 금액', totalAmount],
              ['결제수단', paymentMethod],
            ].map(([label, value]) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:14px;vertical-align:top;width:140px;">${escapeHtml(label)}</td>
                <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#17212b;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
          <a href="${detailUrl}" style="background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;display:inline-block;">관리자 상세 확인</a>
        </div>

        <p style="margin:0 0 8px;color:#475569;line-height:1.6;">취소가 필요하면 관리자 상세에서 예약 취소 후 환불 상태를 관리해 주세요.</p>
        <p style="margin:0;color:#475569;line-height:1.6;">관리자 로그인 세션이 없으면 상세 확인이 제한됩니다.</p>
      </div>
    </div>
  `

  return {
    token,
    confirmUrl,
    detailUrl,
    subject,
    previewText,
    text,
    html,
  }
}

module.exports = {
  buildBookingConfirmationEmail,
}
