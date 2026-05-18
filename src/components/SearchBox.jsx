import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DeliveryLocationModal from './DeliveryLocationModal'
import {
  buildSearchQuery,
  normalizeSearchState,
  parseSearchQuery,
} from '../utils/searchQuery'
import {
  MAX_SEARCH_RETURN_DAYS,
  buildDateTimeValue,
  formatDateKey,
  getEarliestPickupDateTime,
  getEarliestReturnDateTime,
  getLatestPickupDateTime,
  getLatestReturnDateTime,
  getPickupTimeOptions,
  getReturnTimeOptions,
  parseDateTimeString,
  splitDateTimeString,
  toDateTimeString,
} from '../utils/reservationSchedule'
import { fetchSearchCompany, getMockCompany } from '../services/company'

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17" />
    </svg>
  )
}

function UserBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M6 19a6 6 0 0 1 12 0" />
      <path d="M18.5 6.5h2M19.5 5.5v2" />
    </svg>
  )
}

function formatDisplay(dateText) {
  const parsed = parseDateTimeString(dateText)
  if (!parsed) return '-'

  const week = ['일', '월', '화', '수', '목', '금', '토'][parsed.getDay()] || ''
  return `${String(parsed.getMonth() + 1).padStart(2, '0')}.${String(parsed.getDate()).padStart(2, '0')}(${week}) ${String(parsed.getHours()).padStart(2, '0')}:00`
}

function SearchGuardModal({ open, onClose, onOpenLocation }) {
  if (!open) return null

  return (
    <div className="delivery-modal-backdrop" onClick={onClose}>
      <div className="search-guard-modal panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="딜리버리 위치 선택 안내">
        <strong>딜리버리 위치 선택</strong>
        <p className="field-note">검색 전에 딜리버리 지역을 먼저 선택해 주세요.</p>
        <div className="search-guard-actions">
          <button className="btn btn-outline btn-md" onClick={onClose}>닫기</button>
          <button className="btn btn-dark btn-md" onClick={onOpenLocation}>위치 선택</button>
        </div>
      </div>
    </div>
  )
}

function scrollToSearchResults() {
  if (typeof window === 'undefined') return

  window.requestAnimationFrame(() => {
    const target = document.getElementById('search-results')
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

export default function SearchBox({ compact = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const parsedSearchState = useMemo(() => parseSearchQuery(location.search), [location.search])
  const [searchState, setSearchState] = useState(parsedSearchState)
  const [company, setCompany] = useState(() => getMockCompany())
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [isGuardModalOpen, setIsGuardModalOpen] = useState(false)
  const [companyFetchError, setCompanyFetchError] = useState('')
  const [deliveryErrors, setDeliveryErrors] = useState({})

  useEffect(() => {
    setSearchState(parsedSearchState)
    setDeliveryErrors({})
  }, [parsedSearchState])

  useEffect(() => {
    let isCancelled = false

    fetchSearchCompany(searchState)
      .then((payload) => {
        if (isCancelled) return
        setCompany((current) => ({
          ...current,
          ...payload,
          name: payload.companyName || current.name,
          address: payload.fullGarageAddress || current.address,
          phone: payload.companyTel || current.phone,
        }))
        setCompanyFetchError('')
      })
      .catch((error) => {
        if (isCancelled) return
        setCompanyFetchError(error.message || '딜리버리 지역 정보를 불러오지 못했습니다.')
      })

    return () => {
      isCancelled = true
    }
  }, [searchState.deliveryDateTime, searchState.returnDateTime, searchState.driverAge, searchState.order])

  const earliestPickupDate = useMemo(() => getEarliestPickupDateTime(), [])
  const earliestPickupDateKey = useMemo(() => formatDateKey(earliestPickupDate), [earliestPickupDate])
  const latestPickupDate = useMemo(() => getLatestPickupDateTime(), [])
  const latestPickupDateKey = useMemo(() => formatDateKey(latestPickupDate), [latestPickupDate])
  const returnMinDateKey = useMemo(() => {
    const pickupAt = parseDateTimeString(searchState.deliveryDateTime)
    if (!pickupAt) return ''
    return formatDateKey(getEarliestReturnDateTime(pickupAt))
  }, [searchState.deliveryDateTime])
  const returnMaxDateKey = useMemo(() => {
    const pickupAt = parseDateTimeString(searchState.deliveryDateTime)
    if (!pickupAt) return ''

    const latestRentalReturnAt = getLatestReturnDateTime(pickupAt)
    const latestSearchReturnAt = new Date()
    latestSearchReturnAt.setDate(latestSearchReturnAt.getDate() + MAX_SEARCH_RETURN_DAYS)
    latestSearchReturnAt.setHours(21, 0, 0, 0)

    return formatDateKey(latestRentalReturnAt < latestSearchReturnAt ? latestRentalReturnAt : latestSearchReturnAt)
  }, [searchState.deliveryDateTime])

  const deliverySchedule = useMemo(
    () => splitDateTimeString(searchState.deliveryDateTime),
    [searchState.deliveryDateTime],
  )
  const returnSchedule = useMemo(
    () => splitDateTimeString(searchState.returnDateTime),
    [searchState.returnDateTime],
  )

  const pickupTimeOptions = useMemo(
    () => getPickupTimeOptions(deliverySchedule.date),
    [deliverySchedule.date],
  )
  const returnTimeOptions = useMemo(
    () => getReturnTimeOptions(returnSchedule.date, searchState.deliveryDateTime),
    [returnSchedule.date, searchState.deliveryDateTime],
  )

  const updateSearchState = (patch) => {
    setSearchState((current) => normalizeSearchState({ ...current, ...patch, pickupOption: 'delivery' }))
  }

  const updateDeliverySchedule = (patch) => {
    const nextDate = patch.date ?? deliverySchedule.date
    const nextTime = patch.time ?? deliverySchedule.time
    const nextDateTime = buildDateTimeValue(nextDate, nextTime)

    updateSearchState({ deliveryDateTime: nextDateTime || toDateTimeString(earliestPickupDate) })
  }

  const updateReturnSchedule = (patch) => {
    const nextDate = patch.date ?? returnSchedule.date
    const nextTime = patch.time ?? returnSchedule.time
    const nextDateTime = buildDateTimeValue(nextDate, nextTime)

    updateSearchState({ returnDateTime: nextDateTime || searchState.returnDateTime })
  }

  const handleLocationSelect = ({ dongId, deliveryAddress }) => {
    updateSearchState({ dongId, deliveryAddress })
    setDeliveryErrors((current) => ({ ...current, dongId: '' }))
  }

  const goSearch = () => {
    const nextErrors = {}

    if (!searchState.dongId) {
      nextErrors.dongId = '딜리버리 위치를 선택해 주세요.'
    }

    setDeliveryErrors(nextErrors)

    if (nextErrors.dongId) {
      setIsGuardModalOpen(true)
      return
    }

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const nextQuery = buildSearchQuery({ ...searchState, pickupOption: 'delivery' })
    navigate(`/?${nextQuery}`)
    scrollToSearchResults()
  }

  const openLocationModalFromGuard = () => {
    setIsGuardModalOpen(false)
    setIsLocationModalOpen(true)
  }

  return (
    <>
      <section className={`search-box ${compact ? 'compact' : ''}`}>
        <div className="search-panel-grid">
          <article className="search-panel-card location-panel-card">
            <div className="search-panel-header">
              <span className="search-panel-icon"><LocationIcon /></span>
              <span className="search-panel-title">딜리버리 위치</span>
            </div>
            <div className="search-panel-body delivery-summary-box">
              <div className="delivery-readonly-box" role="status" aria-live="polite">
                {searchState.deliveryAddress || '딜리버리 지역을 선택해 주세요.'}
              </div>
              {deliveryErrors.dongId && <p className="muted small-note">{deliveryErrors.dongId}</p>}
              {companyFetchError && <p className="muted small-note">{companyFetchError}</p>}
            </div>
            <div className="search-panel-footer">
              <button className="btn btn-dark btn-lg btn-block" onClick={() => setIsLocationModalOpen(true)}>
                위치 선택
              </button>
            </div>
          </article>

          <article className="search-panel-card schedule-panel-card">
            <div className="search-panel-header">
              <span className="search-panel-icon"><CalendarIcon /></span>
              <span className="search-panel-title">예약 일정</span>
            </div>
            <div className="search-panel-body schedule-panel-body">
              <strong className="search-panel-summary">
                {formatDisplay(searchState.deliveryDateTime)} ~ {formatDisplay(searchState.returnDateTime)}
              </strong>
              <div className="schedule-form-grid">
                <div className="schedule-card">
                  <span className="schedule-card-label">대여 일시</span>
                  <input
                    className="field-input"
                    type="date"
                    value={deliverySchedule.date}
                    min={earliestPickupDateKey}
                    max={latestPickupDateKey}
                    onChange={(e) => updateDeliverySchedule({ date: e.target.value })}
                  />
                  <select
                    className="field-select"
                    value={deliverySchedule.time}
                    onChange={(e) => updateDeliverySchedule({ time: e.target.value })}
                  >
                    {pickupTimeOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="schedule-card">
                  <span className="schedule-card-label">반납 일시</span>
                  <input
                    className="field-input"
                    type="date"
                    value={returnSchedule.date}
                    min={returnMinDateKey || deliverySchedule.date || earliestPickupDateKey}
                    max={returnMaxDateKey}
                    onChange={(e) => updateReturnSchedule({ date: e.target.value })}
                  />
                  <select
                    className="field-select"
                    value={returnSchedule.time}
                    onChange={(e) => updateReturnSchedule({ time: e.target.value })}
                  >
                    {returnTimeOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="search-panel-footer">
              <p className="schedule-note">예약은 현재 시각 기준 3시간 후부터 가능 / 운영 시간은 09:00~21:00 / 대여 기간은 최대 30일 / 반납일은 오늘 기준 60일 이내만 가능합니다.</p>
            </div>
          </article>

          <article className="search-panel-card age-panel-card">
            <div className="search-panel-header">
              <span className="search-panel-icon"><UserBadgeIcon /></span>
              <span className="search-panel-title">운전자 연령</span>
            </div>
            <div className="search-panel-body">
              <div className="action-panel">
                <div className="age-buttons action-age-buttons">
                  <button
                    className={`btn btn-tab btn-md ${searchState.driverAge === 21 ? 'is-active' : ''}`}
                    onClick={() => updateSearchState({ driverAge: 21 })}
                  >
                    만 21세~25세
                  </button>
                  <button
                    className={`btn btn-tab btn-md ${searchState.driverAge === 26 ? 'is-active' : ''}`}
                    onClick={() => updateSearchState({ driverAge: 26 })}
                  >
                    만 26세 이상
                  </button>
                </div>
              </div>
            </div>
            <div className="search-panel-footer">
              <button className="btn btn-dark btn-lg btn-block" onClick={goSearch}>검색</button>
            </div>
          </article>
        </div>
      </section>

      <DeliveryLocationModal
        open={isLocationModalOpen}
        company={company}
        selectedDongId={searchState.dongId}
        onClose={() => setIsLocationModalOpen(false)}
        onSelect={handleLocationSelect}
      />

      <SearchGuardModal
        open={isGuardModalOpen}
        onClose={() => setIsGuardModalOpen(false)}
        onOpenLocation={openLocationModalFromGuard}
      />
    </>
  )
}
