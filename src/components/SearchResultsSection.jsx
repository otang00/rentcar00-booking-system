import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CarCard from './CarCard'
import { buildSearchQuery, parseSearchQuery, validateSearchState } from '../utils/searchQuery'
import { fetchSearchCars } from '../services/cars'
import { getMockCompany } from '../services/company'

function EmptyState() {
  return (
    <div className="detail-card panel">
      <h2>차량이 없습니다</h2>
      <p className="muted small-note">현재 조건에 맞는 차량이 없습니다. 검색 조건을 다시 확인해 주세요.</p>
    </div>
  )
}

function ErrorState({ message }) {
  return (
    <div className="detail-card panel">
      <h2>검색 상태 확인 필요</h2>
      <p className="muted small-note">{message}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="detail-card panel">
      <h2>차량 조회 중</h2>
      <p className="muted small-note">차량 데이터를 불러오는 중입니다.</p>
    </div>
  )
}

export default function SearchResultsSection() {
  const location = useLocation()
  const navigate = useNavigate()
  const searchState = useMemo(() => parseSearchQuery(location.search), [location.search])
  const validation = useMemo(() => validateSearchState(searchState), [searchState])
  const [company, setCompany] = useState(() => getMockCompany())
  const [cars, setCars] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')

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
    navigate(`/?${nextQuery}`)
  }

  return (
    <section className="landing-results-section section-bg" id="search-results">
      <div className="main-top-band">
        <div className="container top-band-inner">
          <p><span>믿고 타는 {company.name},</span> <strong>지금 바로 예약해 보세요!</strong></p>
        </div>
      </div>

      <div className="container main-stack">
        <div className="list-head-row">
          <strong>총 {totalCount}대</strong>
          <div className="sort-buttons simple">
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
          <div className="car-list">
            {cars.map((car) => <CarCard key={car.id} car={car} />)}
          </div>
        )}
      </div>
    </section>
  )
}
