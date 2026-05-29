'use strict'

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatLocalDateTime(value) {
  const date = value ? new Date(value) : new Date()
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

function formatBoolean(value) {
  return value ? '동의' : '미동의'
}

function buildSignupNotificationEmail({ member, createdAt = new Date() } = {}) {
  const name = member?.name || '-'
  const phone = formatPhone(member?.phone)
  const email = member?.email || '-'
  const postalCode = member?.postalCode || '-'
  const addressMain = member?.addressMain || '-'
  const addressDetail = member?.addressDetail || '-'
  const marketingAgree = formatBoolean(Boolean(member?.marketingAgree))
  const signupAt = formatLocalDateTime(createdAt)

  const subject = `[빵빵카] 신규 회원가입 알림 - ${name}`
  const previewText = '홈페이지에서 신규 회원가입이 완료되었습니다.'

  const rows = [
    ['가입시각', signupAt],
    ['이름', name],
    ['휴대폰', phone],
    ['이메일', email],
    ['우편번호', postalCode],
    ['기본주소', addressMain],
    ['상세주소', addressDetail],
    ['마케팅 동의', marketingAgree],
  ]

  const text = [
    '신규 회원가입 알림',
    '',
    '홈페이지에서 신규 회원가입이 완료되었습니다.',
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join('\n')

  const html = `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(previewText)}</div>
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fb;padding:24px;color:#17212b;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e5e7eb;">
        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:700;color:#1d4ed8;background:#eff6ff;display:inline-block;padding:6px 10px;border-radius:999px;">신규 회원</div>
          <h1 style="margin:14px 0 8px;font-size:24px;line-height:1.3;">신규 회원가입 알림</h1>
          <p style="margin:0;color:#475569;line-height:1.6;">홈페이지에서 신규 회원가입이 완료되었습니다.</p>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tbody>
            ${rows.map(([label, value]) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:14px;vertical-align:top;width:140px;">${escapeHtml(label)}</td>
                <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#17212b;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">이 알림은 회원가입 API 성공 후 관리자 수신 메일로 자동 발송됩니다.</p>
      </div>
    </div>
  `

  return {
    subject,
    previewText,
    text,
    html,
  }
}

module.exports = {
  buildSignupNotificationEmail,
}
