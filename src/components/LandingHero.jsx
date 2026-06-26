import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DeliveryLocationModal from './DeliveryLocationModal'
import { DateRangeModal, DriverAgeModal, addMonths, startOfMonth } from './SearchFlowModals'
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

function formatDisplay(dateText) {
  const parsed = parseDateTimeString(dateText)
  if (!parsed) return '-'
  const week = ['일', '월', '화', '수', '목', '금', '토'][parsed.getDay()] || ''
  return `${parsed.getFullYear()}.${String(parsed.getMonth() + 1).padStart(2, '0')}.${String(parsed.getDate()).padStart(2, '0')}(${week})`
}

export function LandingHero() {
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
  const [isScheduleConfirmed, setIsScheduleConfirmed] = useState(false)

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
    setIsScheduleConfirmed(false)
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
    if (dateKey === draftPickupDate) {
      setDraftPickupDate('')
      setDraftReturnDate('')
      setDraftPickupTime('')
      setDraftReturnTime('')
      return
    }
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
    setIsScheduleConfirmed(true)
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
    navigate(`/search?${buildSearchQuery(finalState)}`)
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
    navigate(`/search?${nextQuery}`)
  }

  return (
    <section className="landing-hero">
      <div className="landing-car-photo" aria-hidden="true"><img src="/assets/fallback-cars/fallback-car-2.jpg" alt="" /></div>
      <div className="container landing-hero-grid">
        <div className="landing-copy">
          <span className="landing-eyebrow">서울·수도권 딜리버리 렌터카</span>
          <h1>원하는 위치에서<br />바로 받는 렌터카</h1>
          <p>지역과 시간을 먼저 선택하면 예약 가능한 차량만 보여드립니다. 복잡한 상담 없이 간편 결제하고 예약하세요.</p>
          <div className="landing-trust">
            <div><strong>실시간 예약 가능</strong><span>예약 가능한 차량만 확인</span></div>
            <div><strong>딜리버리 대응</strong><span>서울.수도권.경기도</span></div>
            <div><strong>결제시 예약 확정</strong><span>카드 및 간편결제 지원</span></div>
          </div>
        </div>

        <div className="landing-action-column">
          <aside className="landing-search-card" aria-label="예약 가능 차량 검색">
            <button type="button" className={`landing-cta landing-cta-top ${searchState.dongId && isScheduleConfirmed ? 'is-flow-active' : ''}`} onClick={goSearch}>예약 가능 차량 검색</button>
            <label className={`landing-field ${!searchState.dongId ? 'is-flow-active' : ''}`}>
              <span>딜리버리 위치</span>
              <button type="button" className="landing-select-row" onClick={() => setIsLocationOpen(true)}>
                <b>{searchState.deliveryAddress || '지역을 선택해 주세요'}</b><em>선택</em>
              </button>
              {searchError && <p className="landing-error-note">{searchError}</p>}
            </label>
            <div className={`landing-field landing-schedule-field ${searchState.dongId && !isScheduleConfirmed ? 'is-flow-active' : ''}`} ref={scheduleRef}>
              <span>대여 / 반납</span>
              <button type="button" className="landing-date-trigger" onClick={openDateModal}>
                <div className="landing-date-grid landing-date-picker-grid">
                  <div className="landing-date-picker-card"><small><CalendarIcon /> 대여</small><strong>{formatDisplay(searchState.deliveryDateTime)}</strong><em>{deliverySchedule.time}</em></div>
                  <div className="landing-date-picker-card"><small><CalendarIcon /> 반납</small><strong>{formatDisplay(searchState.returnDateTime)}</strong><em>{returnSchedule.time}</em></div>
                </div>
              </button>
            </div>
            <div className="landing-field">
              <span>운전자 연령</span>
              <div className="landing-age-grid">
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
