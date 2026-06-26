import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CarCard from './CarCard'
import SearchConditionEditor from './SearchConditionEditor'
import PageStateCard from './PageStateCard'
import { buildSearchQuery, parseSearchQuery, validateSearchState } from '../utils/searchQuery'
import { fetchSearchCars } from '../services/cars'
import { getMockCompany } from '../services/company'
import { parseDateTimeString } from '../utils/reservationSchedule'

function formatDisplay(dateText) {
  const parsed = parseDateTimeString(dateText)
  if (!parsed) return '-'
  const week = ['일', '월', '화', '수', '목', '금', '토'][parsed.getDay()] || ''
  return `${String(parsed.getMonth() + 1).padStart(2, '0')}.${String(parsed.getDate()).padStart(2, '0')}(${week}) ${String(parsed.getHours()).padStart(2, '0')}:00`
}

function EmptyState() {
  return <PageStateCard eyebrow="검색 결과" title="차량이 없습니다" message="현재 조건에 맞는 차량이 없습니다. 검색 조건을 다시 설정해 주세요." />
}

function ErrorState({ message }) {
  return <PageStateCard eyebrow="확인 필요" title="검색 상태 확인 필요" message={message} />
}

function LoadingState() {
  return <PageStateCard eyebrow="차량 조회" title="예약 가능 차량을 확인하고 있습니다" message="선택하신 조건에 맞는 차량과 요금을 불러오는 중입니다." />
}

function SearchConditionSummary({ searchState, totalCount, onReset }) {
  return (
    <section className="search-summary-panel panel search-summary-panel-v2" aria-label="검색 조건 요약">
      <div className="search-summary-head">
        <div>
          <span>예약 가능 차량</span>
          <strong>{totalCount}대</strong>
          <p>선택한 일정과 위치 기준으로 예약 가능한 차량입니다.</p>
        </div>
        <div className="search-summary-actions">
          <button type="button" className="btn btn-dark btn-md" onClick={onReset}>조건 변경</button>
          <button type="button" className="btn btn-outline btn-md search-research-desktop" onClick={onReset}>재검색</button>
        </div>
      </div>
      <div className="search-summary-grid">
        <div>
          <span>딜리버리 위치</span>
          <strong>{searchState.deliveryAddress || '선택 위치'}</strong>
        </div>
        <div>
          <span>대여</span>
          <strong>{formatDisplay(searchState.deliveryDateTime)}</strong>
        </div>
        <div>
          <span>반납</span>
          <strong>{formatDisplay(searchState.returnDateTime)}</strong>
        </div>
        <div className="search-summary-driver-cell">
          <span>운전자</span>
          <strong>{searchState.driverAge === 26 ? '만 26세 이상' : '만 21세 이상'}</strong>
        </div>
      </div>
      <button type="button" className="btn btn-outline btn-md search-research-mobile" onClick={onReset}>재검색</button>
    </section>
  )
}

export default function SearchResultsSection() {
  const location = useLocation()
  const navigate = useNavigate()
  const searchState = useMemo(() => parseSearchQuery(location.search), [location.search])
  const validation = useMemo(() => validateSearchState(searchState), [searchState])
  const [, setCompany] = useState(() => getMockCompany())
  const [cars, setCars] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  useEffect(() => {
    let isCancelled = false

    if (!validation.isValid) {
      setCars([])
      setTotalCount(0)
      setFetchError('')
      setIsLoading(false)
      return () => {
        isCancelled = true
      }
    }

    setIsLoading(true)
    setFetchError('')

    fetchSearchCars(searchState)
      .then((payload) => {
        if (isCancelled) return
        setCompany((current) => ({ ...current, ...payload.company, name: payload.company.companyName || current.name }))
        setCars(payload.cars)
        setTotalCount(payload.totalCount)
      })
      .catch((error) => {
        if (isCancelled) return
        setCars([])
        setTotalCount(0)
        setFetchError(error.message || '차량 조회에 실패했습니다.')
      })
      .finally(() => {
        if (isCancelled) return
        setIsLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [searchState, validation])

  const validationErrorMessage = validation.isValid
    ? ''
    : Object.values(validation.errors)[0] || '잘못된 검색 조건입니다.'

  const handleOrderChange = (order) => {
    const nextQuery = buildSearchQuery({ ...searchState, order })
    navigate(`/search?${nextQuery}`)
  }

  const handleReset = () => {
    setIsEditorOpen(true)
  }

  const handleApplySearchCondition = (nextState) => {
    setIsEditorOpen(false)
    navigate(`/search?${buildSearchQuery({ ...nextState, order: searchState.order || 'lower' })}`)
  }

  return (
    <section className="landing-results-section search-results-page section-bg" id="search-results">
      <SearchConditionEditor open={isEditorOpen} initialState={searchState} onClose={() => setIsEditorOpen(false)} onApply={handleApplySearchCondition} />
      <div className="container main-stack search-results-stack">
        <SearchConditionSummary searchState={searchState} totalCount={totalCount} onReset={handleReset} />

        <div className="search-list-toolbar">
          <div className="search-list-copy">
            <span>차량 목록</span>
            <strong>원하는 차량을 선택해 예약 정보를 확인하세요.</strong>
          </div>
          <div className="search-sort-row">
            <button className={`btn btn-tab btn-md ${searchState.order === 'lower' ? 'is-active' : ''}`} onClick={() => handleOrderChange('lower')}>낮은 가격순</button>
            <button className={`btn btn-tab btn-md ${searchState.order === 'higher' ? 'is-active' : ''}`} onClick={() => handleOrderChange('higher')}>높은 가격순</button>
            <button className={`btn btn-tab btn-md ${searchState.order === 'newer' ? 'is-active' : ''}`} onClick={() => handleOrderChange('newer')}>신차순</button>
          </div>
        </div>

        {!validation.isValid && <ErrorState message={validationErrorMessage} />}
        {validation.isValid && isLoading && <LoadingState />}
        {validation.isValid && !isLoading && fetchError && <ErrorState message={fetchError} />}
        {validation.isValid && !isLoading && !fetchError && totalCount === 0 && <EmptyState />}
        {validation.isValid && !isLoading && !fetchError && totalCount > 0 && (
          <div className="car-list search-car-list">
            {cars.map((car) => <CarCard key={car.id} car={car} />)}
          </div>
        )}
      </div>
    </section>
  )
}
