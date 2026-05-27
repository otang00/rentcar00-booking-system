import { Link, useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/Layout'
import { useEffect, useState } from 'react'
import { fetchCompletedGuestBooking } from '../services/guestBookingApi'


const DEMO_RESERVATION = {
  reservationNumber: 'TEST-20260528-001',
  statusTone: 'confirmed',
  statusLabel: '예약확정',
  pricingSnapshot: {
    carName: '테스트 차량',
  },
  pricing: {
    finalPrice: '100,000원',
  },
  display: {
    pickupAt: '06.07(일) 10:00',
    returnAt: '06.08(월) 10:00',
  },
  schedule: {
    displayPickupLabel: '지점 방문',
  },
  customerName: '테스트예약',
  customerPhone: '01026107114',
  customerBirth: '19900101',
}

function formatDisplay(dateText) {
  const [datePart = '', timePart = ''] = String(dateText || '').split(' ')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour = '00', minute = '00'] = timePart.split(':')
  const d = new Date(year || 0, (month || 1) - 1, day || 1)
  const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] || ''
  return `${String(month || '').padStart(2, '0')}.${String(day || '').padStart(2, '0')}(${week}) ${hour}:${minute}`
}

export default function ReservationCompletePage() {
  const [searchParams] = useSearchParams()
  const completionToken = searchParams.get('token') || ''
  const paymentError = searchParams.get('paymentError') || ''
  const isDemo = searchParams.get('demo') === '1'
  const [reservation, setReservation] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let isCancelled = false

    if (isDemo) {
      setReservation(DEMO_RESERVATION)
      setLoadError('')
      return () => {
        isCancelled = true
      }
    }

    if (!completionToken) {
      setReservation(null)
      setLoadError(paymentError || '예약 정보를 찾지 못했습니다.')
      return () => {
        isCancelled = true
      }
    }

    fetchCompletedGuestBooking(completionToken)
      .then((result) => {
        if (isCancelled) return
        setReservation(result.booking)
        setLoadError('')
      })
      .catch((error) => {
        if (isCancelled) return
        setReservation(null)
        setLoadError(error.message || '예약 정보를 찾지 못했습니다.')
      })

    return () => {
      isCancelled = true
    }
  }, [completionToken, isDemo, paymentError])

  return (
    <PageShell className="color-preview-shell color-preview-mockup-shell account-shell reservation-flow-shell">
      <section className="section-bg account-page-shell">
        <div className="container signup-page-container reservation-flow-container">
          <article className="reservation-flow-card">
            <div className="login-title-block signup-title-block"><h1>{reservation ? '예약 확정' : paymentError ? '결제 실패' : '예약 확정'}</h1><span>{isDemo ? '화면 확인용 샘플' : reservation ? '예약 완료' : loadError || '확인 필요'}</span></div>

            {reservation ? (
              <>
                <div className="reservation-result-card panel-sub">
                  <div className="reservation-result-card__header">
                    <div>
                      <span className="reservation-result-card__eyebrow">예약이 확정되었습니다</span>
                      <strong className="reservation-result-card__title">{reservation.pricingSnapshot?.carName || '-'}</strong>
                    </div>
                    <div className={`reservation-result-card__status ${reservation.statusTone === 'cancelled' ? 'is-cancelled' : reservation.statusTone === 'pending' ? 'is-pending' : 'is-confirmed'}`}>
                      {reservation.statusLabel}
                    </div>
                  </div>

                  <div className="reservation-result-card__price">
                    <span>총 금액</span>
                    <strong>{reservation.pricing.finalPrice}</strong>
                  </div>

                  <div className="reservation-result-list">
                    <div className="reservation-result-row"><span>예약번호</span><strong>{reservation.reservationNumber}</strong></div>
                    <div className="reservation-result-row"><span>대여일시</span><strong>{reservation.display.pickupAt}</strong></div>
                    <div className="reservation-result-row"><span>반납일시</span><strong>{reservation.display.returnAt}</strong></div>
                    <div className="reservation-result-row"><span>배차/수령</span><strong>{reservation.schedule.displayPickupLabel}</strong></div>
                    <div className="reservation-result-row"><span>예약자</span><strong>{reservation.customerName}</strong></div>
                    <div className="reservation-result-row"><span>휴대폰번호</span><strong>{reservation.customerPhone}</strong></div>
                    <div className="reservation-result-row"><span>생년월일</span><strong>{reservation.customerBirth}</strong></div>
                  </div>
                </div>

                <div className="signup-bottom-links">
                  <Link to="/guest-bookings">비회원 예약조회</Link>
                  <Link to="/login">로그인</Link>
                </div>
              </>
            ) : (
              <div className="signup-bottom-links">
                <Link to="/guest-bookings">비회원 예약조회</Link>
                <Link to="/login">로그인</Link>
              </div>
            )}
          </article>
        </div>
      </section>
    </PageShell>
  )
}
