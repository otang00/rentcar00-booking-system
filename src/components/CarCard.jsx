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
  const specs = [car.ageLabel, car.fuelType, car.seats].filter(Boolean)

  return (
    <Link
      className="car-card panel search-car-card"
      to={`/cars/${car.id}${detailSearch}`}
    >
      <div className="car-thumb-wrap search-car-thumb">
        <img src={car.image} alt={car.name} />
      </div>
      <div className="car-body search-car-body">
        <div className="search-car-title-row">
          <h3>{car.name}</h3>
          <div className="inline-meta search-car-year">{car.yearLabel}</div>
        </div>
        <div className="search-car-specs">
          {specs.map((item) => <span key={item}>{item}</span>)}
        </div>
        <div className="prices refined-price search-car-price">
          <span>총 예상가</span>
          <strong>{car.dayPrice}</strong>
        </div>
      </div>
    </Link>
  )
}
