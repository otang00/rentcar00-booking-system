import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Footer } from '../components/Layout'
import ContactInfoStrip from '../components/ContactInfoStrip'
import SearchBox from '../components/SearchBox'
import SearchResultsSection from '../components/SearchResultsSection'
import { landingContactItems } from '../data/landing'
import { getMockCars } from '../services/cars'

function PreviewHeader() {
  return (
    <header className="landing-v2-header">
      <div className="landing-v2-header__inner">
        <Link className="landing-v2-brand" to="/" aria-label="빵빵카 주식회사">
          <img src="/bbang-wordmark.png" alt="빵빵카 주식회사" />
        </Link>
        <nav className="landing-v2-nav" aria-label="주요 메뉴">
          <a href="#landing-v2-reservation">단기렌트</a>
          <a href="#landing-v2-contact">상담안내</a>
          <Link to="/reservations">예약내역</Link>
          <Link className="is-soft" to="/login">로그인</Link>
          <Link className="is-dark" to="/guest-bookings">비회원 예약조회</Link>
        </nav>
      </div>
    </header>
  )
}

function HeroSection() {
  return (
    <section className="landing-v2-hero" id="landing-v2-reservation">
      <picture className="landing-v2-hero__media">
        <source media="(max-width: 860px)" srcSet="/assets/hero/hero-1-mobile.png" />
        <img src="/assets/hero/hero-1-pc.png" alt="빵빵카 렌터카 예약" />
      </picture>
      <div className="landing-v2-hero__shade" />

      <div className="landing-v2-hero__inner">
        <div className="landing-v2-copy">
          <span className="landing-v2-eyebrow">빵빵카 공식 예약센터</span>
          <h1>원하는 시간,<br />원하는 장소로 렌터카 예약</h1>
          <p>서울·수도권 딜리버리 렌터카. 차량 검색부터 결제, 예약확정 문자 안내까지 한 번에 진행합니다.</p>
          <div className="landing-v2-actions">
            <a className="landing-v2-btn landing-v2-btn--primary" href="#landing-v2-reservation">바로 예약하기</a>
            <Link className="landing-v2-btn landing-v2-btn--ghost" to="/guest-bookings">예약 조회하기</Link>
          </div>
          <div className="landing-v2-trust" aria-label="서비스 특징">
            <span>카드결제 가능</span>
            <span>예약확정 SMS</span>
            <span>카카오 상담</span>
          </div>
        </div>

        <aside className="landing-v2-booking-card" aria-label="빠른 예약 검색">
          <div className="landing-v2-booking-card__head">
            <strong>빠른 예약 검색</strong>
          </div>
          <SearchBox compact resultsPath="/landing-v2" />
        </aside>
      </div>
    </section>
  )
}

function StepSection() {
  return (
    <section className="landing-v2-section landing-v2-steps" aria-label="예약 흐름">
      <article>
        <b>01</b>
        <strong>딜리버리 위치</strong>
        <span>지역을 선택하고 배차 가능 차량을 확인합니다.</span>
      </article>
      <article>
        <b>02</b>
        <strong>대여·반납 일정</strong>
        <span>운영 시간과 예약 가능 기준에 맞춰 선택합니다.</span>
      </article>
      <article>
        <b>03</b>
        <strong>차량 선택·결제</strong>
        <span>결제 완료 후 예약확정 문자가 발송됩니다.</span>
      </article>
    </section>
  )
}

function FeaturedCarsSection() {
  const { cars } = getMockCars({ driverAge: 26, order: 'lower' })
  const featuredCars = cars.slice(0, 3)

  return (
    <section className="landing-v2-section landing-v2-featured" aria-label="추천 차량">
      <div className="landing-v2-section__head">
        <span>추천 차량</span>
        <h2>자주 찾는 차량을 빠르게 확인하세요</h2>
      </div>
      <div className="landing-v2-car-grid">
        {featuredCars.map((car) => (
          <article className="landing-v2-car-card" key={car.id}>
            <div className="landing-v2-car-card__image">
              <img src={car.image} alt={car.name} />
            </div>
            <div className="landing-v2-car-card__body">
              <span className="landing-v2-tag">{car.ageLabel || '렌터카'}</span>
              <h3>{car.name}</h3>
              <p>{car.seats || '-'} · {car.fuelType || '연료 확인'} · 딜리버리 가능</p>
              <div className="landing-v2-car-card__bottom">
                <strong>{car.dayPrice || '-'}</strong>
                <Link to="/landing-v2#landing-v2-reservation">검색하기</Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default function LandingV2Page() {
  const location = useLocation()
  const hasSearchQuery = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.has('deliveryDateTime') && params.has('returnDateTime')
  }, [location.search])

  return (
    <div className="landing-v2-shell">
      <PreviewHeader />
      <main>
        <HeroSection />
        <StepSection />
        <FeaturedCarsSection />
        {hasSearchQuery && <SearchResultsSection resultsPath="/landing-v2" />}
        <div id="landing-v2-contact">
          <ContactInfoStrip items={landingContactItems} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
