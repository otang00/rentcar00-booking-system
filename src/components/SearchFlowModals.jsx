import { formatDateKey, parseDateTimeString } from '../utils/reservationSchedule'

function ChevronIcon({ direction = 'left' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  )
}

export function addMonths(date, amount) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + amount, 1)
  next.setHours(0, 0, 0, 0)
  return next
}

export function startOfMonth(date) {
  const next = new Date(date)
  next.setDate(1)
  next.setHours(0, 0, 0, 0)
  return next
}

function buildMonthCells(monthDate) {
  const firstDay = startOfMonth(monthDate)
  const firstWeekday = firstDay.getDay()
  const lastDate = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate()
  const cells = []

  for (let index = 0; index < firstWeekday; index += 1) cells.push(null)
  for (let day = 1; day <= lastDate; day += 1) cells.push(new Date(firstDay.getFullYear(), firstDay.getMonth(), day))
  while (cells.length % 7 !== 0) cells.push(null)

  return cells
}

function formatDisplay(dateText) {
  const parsed = parseDateTimeString(dateText)
  if (!parsed) return '-'
  const week = ['일', '월', '화', '수', '목', '금', '토'][parsed.getDay()] || ''
  return `${parsed.getFullYear()}.${String(parsed.getMonth() + 1).padStart(2, '0')}.${String(parsed.getDate()).padStart(2, '0')}(${week})`
}

function formatModalDateLabel(dateKey) {
  if (!dateKey) return '선택 전'
  const parsed = parseDateTimeString(`${dateKey} 00:00`)
  if (!parsed) return dateKey
  const week = ['일', '월', '화', '수', '목', '금', '토'][parsed.getDay()] || ''
  return `${parsed.getFullYear()}.${String(parsed.getMonth() + 1).padStart(2, '0')}.${String(parsed.getDate()).padStart(2, '0')}(${week})`
}

export function DateRangeModal({
  open,
  monthCursor,
  pickupDate,
  returnDate,
  pickupTime,
  returnTime,
  pickupTimeOptions,
  returnTimeOptions,
  minPickupDateKey,
  maxPickupDateKey,
  minReturnDateKey,
  maxReturnDateKey,
  onClose,
  onPrevMonth,
  onNextMonth,
  onDateClick,
  onTouchStart,
  onTouchEnd,
  onPickupTimeChange,
  onReturnTimeChange,
  onConfirm,
}) {
  if (!open) return null

  const leftMonth = startOfMonth(monthCursor)
  const rightMonth = addMonths(leftMonth, 1)
  const monthEntries = [leftMonth, rightMonth]
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const isWaitingReturn = pickupDate && !returnDate
  const activeMaxDateKey = isWaitingReturn ? maxReturnDateKey : maxPickupDateKey
  const minMonth = startOfMonth(parseDateTimeString(`${minPickupDateKey} 00:00`) || leftMonth)
  const maxMonth = startOfMonth(parseDateTimeString(`${activeMaxDateKey} 00:00`) || leftMonth)
  const isPrevDisabled = leftMonth <= minMonth
  const isNextDisabled = leftMonth >= maxMonth

  return (
    <div className="color-preview-modal-backdrop" onClick={onClose}>
      <div className="color-preview-date-modal" onClick={(event) => event.stopPropagation()} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} role="dialog" aria-modal="true" aria-label="대여 반납 날짜 선택">
        <div className="color-preview-date-modal-head color-preview-date-modal-head-v4">
          <div className="color-preview-date-title-cluster">
            <button type="button" className="color-preview-date-nav" onClick={onPrevMonth} disabled={isPrevDisabled} aria-label="이전 달"><ChevronIcon direction="left" /></button>
            <div className="color-preview-date-title-wrap">
              <span>{leftMonth.getFullYear()}년 {leftMonth.getMonth() + 1}월</span>
            </div>
            <button type="button" className="color-preview-date-nav" onClick={onNextMonth} disabled={isNextDisabled} aria-label="다음 달"><ChevronIcon direction="right" /></button>
          </div>
          <button type="button" className="color-preview-date-modal-x" onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="color-preview-calendar-grid">
          {monthEntries.map((monthDate) => {
            const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth()}`
            const cells = buildMonthCells(monthDate)
            return (
              <section key={monthKey} className="color-preview-calendar-panel">
                <header><strong>{monthDate.getFullYear()}년 {monthDate.getMonth() + 1}월</strong></header>
                <div className="color-preview-calendar-weekdays">
                  {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
                </div>
                <div className="color-preview-calendar-cells">
                  {cells.map((cell, index) => {
                    if (!cell) return <span key={`${monthKey}-blank-${index}`} className="is-empty" aria-hidden="true" />
                    const dateKey = formatDateKey(cell)
                    const isWaitingReturn = pickupDate && !returnDate
                    const effectiveMinDateKey = isWaitingReturn ? minReturnDateKey : minPickupDateKey
                    const effectiveMaxDateKey = isWaitingReturn ? maxReturnDateKey : maxPickupDateKey
                    const isDisabled = dateKey < effectiveMinDateKey || dateKey > effectiveMaxDateKey
                    const isPickup = pickupDate === dateKey
                    const isReturn = returnDate === dateKey
                    const isInRange = pickupDate && returnDate && dateKey > pickupDate && dateKey < returnDate
                    return (
                      <button
                        key={dateKey}
                        type="button"
                        className={`color-preview-calendar-day ${isPickup ? 'is-pickup' : ''} ${isReturn ? 'is-return' : ''} ${isInRange ? 'is-in-range' : ''} ${isWaitingReturn && !isDisabled ? 'is-flow-active' : ''} ${!pickupDate && !isDisabled ? 'is-flow-active' : ''}`}
                        disabled={isDisabled}
                        onClick={() => onDateClick(dateKey)}
                      >
                        <span>{cell.getDate()}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        <div className="color-preview-date-range-summary color-preview-date-time-summary">
          <div className={`color-preview-date-summary-card ${!pickupDate ? 'is-flow-active' : ''}`}>
            <span>대여일</span>
            <strong>{formatModalDateLabel(pickupDate)}</strong>
          </div>
          <div className={`color-preview-date-summary-card ${!returnDate ? 'is-waiting' : ''} ${pickupDate && !returnDate ? 'is-flow-active' : ''}`}>
            <span>반납일</span>
            <strong>{formatModalDateLabel(returnDate)}</strong>
          </div>
          <div className={`color-preview-time-card color-preview-time-summary-card ${!returnDate ? 'is-waiting' : ''} ${returnDate && !pickupTime ? 'is-flow-active' : ''}`}>
            <label>대여 시간</label>
            <select value={pickupTime} onChange={(event) => onPickupTimeChange(event.target.value)} disabled={!returnDate}>
              <option value="">시간 선택</option>
              {pickupTimeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className={`color-preview-time-card color-preview-time-summary-card ${!returnDate || !pickupTime ? 'is-waiting' : ''} ${returnDate && pickupTime && !returnTime ? 'is-flow-active' : ''}`}>
            <label>반납 시간</label>
            <select value={returnTime} onChange={(event) => onReturnTimeChange(event.target.value)} disabled={!returnDate || !pickupTime}>
              <option value="">시간 선택</option>
              {returnTimeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        </div>

        <div className="color-preview-date-modal-footer">
          <button type="button" className={`color-preview-date-confirm ${pickupDate && returnDate && pickupTime && returnTime ? 'is-flow-active' : ''}`} onClick={onConfirm} disabled={!pickupDate || !returnDate || !pickupTime || !returnTime}>확인</button>
        </div>
      </div>
    </div>
  )
}


export function DriverAgeModal({ open, selectedAge, onSelectAge, onClose, onConfirm }) {
  if (!open) return null

  return (
    <div className="color-preview-modal-backdrop" onClick={onClose}>
      <div className="color-preview-age-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="운전자 연령 선택">
        <button type="button" className="color-preview-date-modal-x color-preview-age-modal-x" onClick={onClose} aria-label="닫기">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="color-preview-age-modal-head">
          <strong>운전자 연령 선택</strong>
        </div>
        <div className="color-preview-age-modal-options">
          <button type="button" className={selectedAge === 26 ? 'is-active' : ''} onClick={() => onSelectAge(26)}>만 26세 이상</button>
          <button type="button" className={selectedAge === 21 ? 'is-active' : ''} onClick={() => onSelectAge(21)}>만 21세 이상</button>
        </div>
        <button type="button" className={`color-preview-age-confirm ${selectedAge ? 'is-flow-active' : ''}`} onClick={onConfirm} disabled={!selectedAge}>예약 가능 차량 검색</button>
      </div>
    </div>
  )
}

