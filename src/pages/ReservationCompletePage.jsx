import { Link, useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/Layout'
import { useEffect, useState } from 'react'
import { fetchCompletedGuestBooking } from '../services/guestBookingApi'

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
  const [reservation, setReservation] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let isCancelled = false

    if (!completionToken) {
      setReservation(null)
      setLoadError('예약 정보를 찾지 못했습니다.')
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
  }, [completionToken])

  return (
    <PageShell>
      <section className="section-bg">
        <div className="container detail-layout" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <article className="detail-card panel" style={{ display: 'grid', gap: 16 }}>
            <div>
              <h1 style={{ margin: 0 }}>예약 확정</h1>
              <p className="small-note" style={{ marginTop: 8 }}>
                {reservation ? '결제가 정상적으로 완료되어 예약이 확정되었습니다.' : loadError || '예약 정보를 찾지 못했습니다.'}
              </p>
            </div>

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

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link className="btn btn-dark btn-md" to="/">메인으로</Link>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link className="btn btn-dark btn-md" to="/">메인으로</Link>
              </div>
            )}
          </article>
        </div>
      </section>
    </PageShell>
  )
}
