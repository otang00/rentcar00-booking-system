import { parseDateTimeString } from '../utils/reservationSchedule'

function formatDisplay(dateText) {
  const parsed = parseDateTimeString(dateText)
  if (!parsed) return '-'

  const week = ['일', '월', '화', '수', '목', '금', '토'][parsed.getDay()] || ''
  return `${String(parsed.getMonth() + 1).padStart(2, '0')}.${String(parsed.getDate()).padStart(2, '0')}(${week}) ${String(parsed.getHours()).padStart(2, '0')}:00`
}

function formatDriverAge(driverAge) {
  return Number(driverAge) === 21 ? '만 21세~25세' : '만 26세 이상'
}

export default function DetailSearchBox({
  fixedSearchInfo,
  searchState,
  company,
  deliveryAddressDetail,
  deliveryAddressDetailError,
  onDeliveryAddressDetailChange,
}) {
  const pickupLocation = searchState.pickupOption === 'delivery'
    ? (searchState.deliveryAddress || '딜리버리 위치 확인 필요')
    : (company?.fullGarageAddress || company?.address || '회사 주소 확인 필요')

  return (
    <section className="detail-card panel detail-search-box">
      <div className="info-grid three detail-fixed-grid">
        <div className="detail-info-cell panel-info">
          <span className="field-label">대여 일시</span>
          <strong>{formatDisplay(fixedSearchInfo.deliveryDateTime)}</strong>
        </div>
        <div className="detail-info-cell panel-info">
          <span className="field-label">반납 일시</span>
          <strong>{formatDisplay(fixedSearchInfo.returnDateTime)}</strong>
        </div>
        <div className="detail-info-cell panel-info">
          <span className="field-label">운전자 연령</span>
          <strong>{formatDriverAge(fixedSearchInfo.driverAge)}</strong>
        </div>
      </div>

      <div className="detail-search-grid detail-location-grid">
        <div className="detail-search-section panel-form detail-location-card">
          <span className="field-label">수령위치</span>
          <div className="detail-location-summary">
            <div className="pickup-location-readonly-box">{pickupLocation}</div>
            <p className="schedule-note detail-note">
              {searchState.pickupOption === 'delivery'
                ? '메인에서 확정한 수령 위치입니다.'
                : '회사 방문 수령/반납'}
            </p>
          </div>
        </div>

        <div className="detail-search-section panel-form detail-location-card">
          <span className="field-label">상세위치</span>
          <div className="detail-location-summary">
            <input
              className="field-input detail-location-input"
              placeholder="상세주소를 입력해 주세요."
              value={deliveryAddressDetail}
              onChange={(e) => onDeliveryAddressDetailChange(e.target.value)}
            />
            {deliveryAddressDetailError && (
              <p className="muted small-note">{deliveryAddressDetailError}</p>
            )}
            <p className="schedule-note detail-note">상세주소는 예약 요청 전에 입력해 주세요.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
