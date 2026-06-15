import { Link, useLocation } from 'react-router-dom'

function buildDetailSearch(search, detailToken) {
  const params = new URLSearchParams(search || '')

  if (detailToken) {
    params.set('detailToken', detailToken)
  }

  const nextQuery = params.toString()
  return nextQuery ? `?${nextQuery}` : ''
}

export default function CarCard({ car }) {
  const location = useLocation()
  const detailSearch = buildDetailSearch(location.search, car.detailToken)
  const specs = [car.yearLabel, car.ageLabel, car.fuelType, car.seats].filter(Boolean)

  return (
    <Link
      className="car-card panel search-car-card search-car-card-v2"
      to={`/cars/${car.id}${detailSearch}`}
      aria-label={`${car.name} 상세보기`}
    >
      <div className="search-car-thumb search-car-thumb-v2">
        <img src={car.image} alt={car.name} />
      </div>

      <div className="search-car-body search-car-body-v2">
        <div className="search-car-main-copy">
          <div className="search-car-status-spec-row">
            <div className="search-car-specs">
              {specs.map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
          <div className="search-car-title-row">
            <h3>{car.name}</h3>
          </div>
          <div className="search-car-meta-price-row">
            <div className="prices refined-price search-car-price">
              <strong>{car.dayPrice}</strong>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
