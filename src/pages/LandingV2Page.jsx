import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Footer, Header } from '../components/Layout'
import ContactInfoStrip from '../components/ContactInfoStrip'
import SearchBox from '../components/SearchBox'
import SearchResultsSection from '../components/SearchResultsSection'
import { landingContactItems } from '../data/landing'

function FixedHero() {
  return (
    <section className="landing-v2-fixed-hero" aria-label="빵빵카 렌터카 안내">
      <picture className="landing-v2-fixed-hero__media">
        <source media="(max-width: 960px)" srcSet="/assets/hero/hero-1-mobile.png" />
        <img src="/assets/hero/hero-1-pc.png" alt="빵빵카 렌터카 예약" />
      </picture>
      <div className="landing-v2-fixed-hero__shade" />
      <div className="landing-v2-fixed-hero__content">
        <span className="landing-v2-fixed-hero__eyebrow">서울·수도권 딜리버리 렌터카</span>
        <h1>원하는 시간,<br />원하는 장소에서 바로 예약</h1>
        <p>위치와 일정을 선택하면 예약 가능한 차량과 금액을 바로 확인할 수 있습니다.</p>
        <div className="landing-v2-fixed-hero__badges" aria-label="서비스 특징">
          <span>카드결제 가능</span>
          <span>예약확정 SMS</span>
          <span>카카오 상담</span>
        </div>
      </div>
    </section>
  )
}

function ReservationFlow() {
  return (
    <section className="landing-v2-flow-section" aria-label="예약 진행 순서">
      <div className="container landing-v2-flow-grid">
        <article>
          <b>01</b>
          <strong>딜리버리 위치</strong>
          <span>원하는 배차 지역을 선택합니다.</span>
        </article>
        <i aria-hidden="true">→</i>
        <article>
          <b>02</b>
          <strong>예약 일정</strong>
          <span>대여와 반납 시간을 선택합니다.</span>
        </article>
        <i aria-hidden="true">→</i>
        <article>
          <b>03</b>
          <strong>차량 검색</strong>
          <span>가능 차량을 확인하고 예약합니다.</span>
        </article>
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
    <div className="page-shell landing-shell landing-v2-simple-shell">
      <Header brandName="빵빵카 주식회사" showGuestBookingAction />

      <main className="landing-page landing-v2-simple-page">
        <FixedHero />
        <section className="landing-v2-search-section" id="landing-v2-reservation">
          <div className="container landing-section-stack">
            <SearchBox compact resultsPath="/landing-v2" />
          </div>
        </section>
        <ReservationFlow />
        {hasSearchQuery && <SearchResultsSection resultsPath="/landing-v2" />}
        <div className="landing-v2-contact-wrap">
          <ContactInfoStrip items={landingContactItems} />
        </div>
      </main>

      <Footer />
    </div>
  )
}
