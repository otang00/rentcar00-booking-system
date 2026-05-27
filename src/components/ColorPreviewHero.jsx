import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DeliveryLocationModal from './DeliveryLocationModal'
import { getDefaultSearchState } from '../constants/search'
import { fetchSearchCompany, getMockCompany } from '../services/company'
import { buildSearchQuery, normalizeSearchState } from '../utils/searchQuery'
import {
  buildDateTimeValue,
  formatDateKey,
  getEarliestPickupDateTime,
  getEarliestReturnDateTime,
  getLatestPickupDateTime,
  getLatestReturnDateTime,
  getLatestSearchReturnDateTime,
  getPickupTimeOptions,
  getReturnTimeOptions,
  parseDateTimeString,
  splitDateTimeString,
} from '../utils/reservationSchedule'

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17" />
    </svg>
  )
}

function ChevronIcon({ direction = 'left' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  )
}

function addMonths(date, amount) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + amount, 1)
  next.setHours(0, 0, 0, 0)
  return next
}

function startOfMonth(date) {
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

function scrollToSearchResults() {
  if (typeof window === 'undefined') return

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const target = document.getElementById('search-results')
      if (!target) return
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })
}


function DateRangeModal({
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


function DriverAgeModal({ open, selectedAge, onSelectAge, onClose, onConfirm }) {
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

export function ColorPreviewHero() {
  const navigate = useNavigate()
  const scheduleRef = useRef(null)
  const [searchState, setSearchState] = useState(() => getDefaultSearchState())
  const [company, setCompany] = useState(() => getMockCompany())
  const [isLocationOpen, setIsLocationOpen] = useState(false)
  const [isDateModalOpen, setIsDateModalOpen] = useState(false)
  const [isAgeModalOpen, setIsAgeModalOpen] = useState(false)
  const [pendingSearchState, setPendingSearchState] = useState(null)
  const [draftDriverAge, setDraftDriverAge] = useState(26)
  const [dateModalTouchStartX, setDateModalTouchStartX] = useState(null)
  const [searchError, setSearchError] = useState('')
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(getEarliestPickupDateTime()))
  const [draftPickupDate, setDraftPickupDate] = useState('')
  const [draftReturnDate, setDraftReturnDate] = useState('')
  const [draftPickupTime, setDraftPickupTime] = useState('09:00')
  const [draftReturnTime, setDraftReturnTime] = useState('09:00')

  const deliverySchedule = useMemo(() => splitDateTimeString(searchState.deliveryDateTime), [searchState.deliveryDateTime])
  const returnSchedule = useMemo(() => splitDateTimeString(searchState.returnDateTime), [searchState.returnDateTime])
  const earliestPickupDate = useMemo(() => getEarliestPickupDateTime(), [])
  const earliestPickupDateKey = useMemo(() => formatDateKey(earliestPickupDate), [earliestPickupDate])
  const latestPickupDateKey = useMemo(() => formatDateKey(getLatestPickupDateTime()), [])
  const latestSearchReturnDate = useMemo(() => getLatestSearchReturnDateTime(), [])
  const modalPickupDateTime = useMemo(() => buildDateTimeValue(draftPickupDate || deliverySchedule.date, draftPickupTime || '09:00'), [draftPickupDate, deliverySchedule.date, draftPickupTime])
  const modalMinReturnDateKey = useMemo(() => {
    const pickupAt = parseDateTimeString(modalPickupDateTime)
    return pickupAt ? formatDateKey(getEarliestReturnDateTime(pickupAt)) : ''
  }, [modalPickupDateTime])
  const modalMaxReturnDateKey = useMemo(() => {
    const pickupAt = parseDateTimeString(modalPickupDateTime)
    if (!pickupAt) return ''

    const latestRentalReturnAt = getLatestReturnDateTime(pickupAt)
    const effectiveLatestReturnAt = latestRentalReturnAt < latestSearchReturnDate ? latestRentalReturnAt : latestSearchReturnDate
    return formatDateKey(effectiveLatestReturnAt)
  }, [modalPickupDateTime, latestSearchReturnDate])
  const modalPickupTimeOptions = useMemo(() => getPickupTimeOptions(draftPickupDate || deliverySchedule.date), [draftPickupDate, deliverySchedule.date])
  const modalReturnTimeOptions = useMemo(() => getReturnTimeOptions(draftReturnDate || returnSchedule.date, modalPickupDateTime), [draftReturnDate, returnSchedule.date, modalPickupDateTime])


  useEffect(() => {
    let isCancelled = false
    fetchSearchCompany(searchState)
      .then((payload) => {
        if (!isCancelled) setCompany((current) => ({ ...current, ...payload }))
      })
      .catch(() => {
        if (!isCancelled) setCompany(getMockCompany())
      })
    return () => { isCancelled = true }
  }, [searchState.deliveryDateTime, searchState.returnDateTime, searchState.driverAge])

  const updateSearchState = (patch) => {
    setSearchState((current) => normalizeSearchState({ ...current, ...patch, pickupOption: 'delivery' }))
    setSearchError('')
  }

  const openDateModal = () => {
    setDraftPickupDate('')
    setDraftReturnDate('')
    setDraftPickupTime('')
    setDraftReturnTime('')
    setMonthCursor(startOfMonth(parseDateTimeString(searchState.deliveryDateTime) || earliestPickupDate))
    setIsDateModalOpen(true)
  }

  const handleLocationSelect = ({ dongId, deliveryAddress }) => {
    updateSearchState({ dongId, deliveryAddress })
    setIsLocationOpen(false)
    window.requestAnimationFrame(() => {
      scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    openDateModal()
  }

  const handleCalendarDateClick = (dateKey) => {
    if (!draftPickupDate || (draftPickupDate && draftReturnDate)) {
      setDraftPickupDate(dateKey)
      setDraftReturnDate('')
      setDraftPickupTime('')
      setDraftReturnTime('')
      return
    }
    if (dateKey === draftPickupDate) return
    if (dateKey < draftPickupDate) {
      setDraftReturnDate(draftPickupDate)
      setDraftPickupDate(dateKey)
      setDraftPickupTime('')
      setDraftReturnTime('')
      return
    }
    setDraftReturnDate(dateKey)
    setDraftReturnTime('')
  }

  const confirmDateRange = () => {
    if (!draftPickupDate || !draftReturnDate || !draftPickupTime || !draftReturnTime) return
    const nextState = normalizeSearchState({
      ...searchState,
      pickupOption: 'delivery',
      deliveryDateTime: buildDateTimeValue(draftPickupDate, draftPickupTime),
      returnDateTime: buildDateTimeValue(draftReturnDate, draftReturnTime),
    })
    setSearchState(nextState)
    setPendingSearchState(nextState)
    setDraftDriverAge(nextState.driverAge || 26)
    setIsDateModalOpen(false)
    setIsAgeModalOpen(true)
  }

  const confirmDriverAgeSearch = () => {
    const finalState = normalizeSearchState({
      ...(pendingSearchState || searchState),
      pickupOption: 'delivery',
      driverAge: draftDriverAge,
    })
    setSearchState(finalState)
    setPendingSearchState(null)
    setIsAgeModalOpen(false)
    navigate(`/?${buildSearchQuery(finalState)}`)
    scrollToSearchResults()
  }

  const handleDateModalTouchEnd = (event) => {
    if (dateModalTouchStartX == null) return

    const touchEndX = event.changedTouches?.[0]?.clientX
    if (typeof touchEndX !== 'number') return

    const deltaX = touchEndX - dateModalTouchStartX
    setDateModalTouchStartX(null)

    if (Math.abs(deltaX) < 48) return

    const minMonth = startOfMonth(parseDateTimeString(`${earliestPickupDateKey} 00:00`) || monthCursor)
    const activeMaxDateKey = draftPickupDate && !draftReturnDate ? modalMaxReturnDateKey : latestPickupDateKey
    const maxMonth = startOfMonth(parseDateTimeString(`${activeMaxDateKey} 00:00`) || monthCursor)

    if (deltaX < 0 && monthCursor < maxMonth) {
      setMonthCursor((current) => addMonths(current, 1))
    }

    if (deltaX > 0 && monthCursor > minMonth) {
      setMonthCursor((current) => addMonths(current, -1))
    }
  }

  const goSearch = () => {
    if (!searchState.dongId) {
      setSearchError('딜리버리 위치를 먼저 선택해 주세요.')
      setIsLocationOpen(true)
      return
    }
    const nextQuery = buildSearchQuery({ ...searchState, pickupOption: 'delivery' })
    navigate(`/?${nextQuery}`)
    scrollToSearchResults()
  }

  return (
    <section className="color-preview-hero">
      <div className="color-preview-car-photo" aria-hidden="true"><img src="/assets/mock-cars/mock-car-2.jpg" alt="" /></div>
      <div className="container color-preview-hero-grid">
        <div className="color-preview-copy">
          <span className="color-preview-eyebrow">서울·수도권 딜리버리 렌터카</span>
          <h1>원하는 위치에서<br />바로 받는 렌터카</h1>
          <p>지역과 시간을 먼저 선택하면 예약 가능한 차량만 보여드립니다. 복잡한 상담 없이 간편 결제하고 예약하세요.</p>
          <div className="color-preview-trust">
            <div><strong>실시간 예약 가능</strong><span>예약 가능한 차량만 확인</span></div>
            <div><strong>딜리버리 대응</strong><span>서울.수도권.경기도</span></div>
            <div><strong>최종가 표시</strong><span>결제 전 금액 확인</span></div>
          </div>
        </div>

        <div className="color-preview-action-column">
          <aside className="color-preview-search-card" aria-label="예약 가능 차량 검색">
            <button type="button" className="color-preview-cta color-preview-cta-top" onClick={goSearch}>예약 가능 차량 검색</button>
            <label className={`color-preview-field ${!searchState.dongId ? 'is-flow-active' : ''}`}>
              <span>딜리버리 위치</span>
              <button type="button" className="color-preview-select-row" onClick={() => setIsLocationOpen(true)}>
                <b>{searchState.deliveryAddress || '지역을 선택해 주세요'}</b><em>선택</em>
              </button>
              {searchError && <p className="color-preview-error-note">{searchError}</p>}
            </label>
            <div className={`color-preview-field color-preview-schedule-field ${searchState.dongId ? 'is-flow-active' : ''}`} ref={scheduleRef}>
              <span>대여 / 반납</span>
              <button type="button" className="color-preview-date-trigger" onClick={openDateModal}>
                <div className="color-preview-date-grid color-preview-date-picker-grid">
                  <div className="color-preview-date-picker-card"><small><CalendarIcon /> 대여</small><strong>{formatDisplay(searchState.deliveryDateTime)}</strong><em>{deliverySchedule.time}</em></div>
                  <div className="color-preview-date-picker-card"><small><CalendarIcon /> 반납</small><strong>{formatDisplay(searchState.returnDateTime)}</strong><em>{returnSchedule.time}</em></div>
                </div>
              </button>
            </div>
            <div className="color-preview-field">
              <span>운전자 연령</span>
              <div className="color-preview-age-grid">
                <button type="button" className={searchState.driverAge === 26 ? 'is-active' : ''} onClick={() => updateSearchState({ driverAge: 26 })}>만 26세 이상</button>
                <button type="button" className={searchState.driverAge === 21 ? 'is-active' : ''} onClick={() => updateSearchState({ driverAge: 21 })}>만 21세 이상</button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <DeliveryLocationModal open={isLocationOpen} company={company} selectedDongId={searchState.dongId} onClose={() => setIsLocationOpen(false)} onSelect={handleLocationSelect} />
      <DateRangeModal
        open={isDateModalOpen}
        monthCursor={monthCursor}
        pickupDate={draftPickupDate}
        returnDate={draftReturnDate}
        pickupTime={draftPickupTime}
        returnTime={draftReturnTime}
        pickupTimeOptions={modalPickupTimeOptions}
        returnTimeOptions={modalReturnTimeOptions}
        minPickupDateKey={earliestPickupDateKey}
        maxPickupDateKey={latestPickupDateKey}
        minReturnDateKey={modalMinReturnDateKey}
        maxReturnDateKey={modalMaxReturnDateKey}
        onClose={() => setIsDateModalOpen(false)}
        onPrevMonth={() => setMonthCursor((current) => addMonths(current, -1))}
        onNextMonth={() => setMonthCursor((current) => addMonths(current, 1))}
        onDateClick={handleCalendarDateClick}
        onTouchStart={(event) => setDateModalTouchStartX(event.touches?.[0]?.clientX ?? null)}
        onTouchEnd={handleDateModalTouchEnd}
        onPickupTimeChange={setDraftPickupTime}
        onReturnTimeChange={setDraftReturnTime}
        onConfirm={confirmDateRange}
      />
      <DriverAgeModal
        open={isAgeModalOpen}
        selectedAge={draftDriverAge}
        onSelectAge={setDraftDriverAge}
        onClose={() => setIsAgeModalOpen(false)}
        onConfirm={confirmDriverAgeSearch}
      />
    </section>
  )
}
