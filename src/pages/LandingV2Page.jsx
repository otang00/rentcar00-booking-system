import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Footer } from '../components/Layout'
import SearchBox from '../components/SearchBox'
import SearchResultsSection from '../components/SearchResultsSection'

export default function LandingV2Page() {
  const location = useLocation()
  const hasSearchQuery = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.has('deliveryDateTime') && params.has('returnDateTime')
  }, [location.search])

  return (
    <div className="mv2-page">
      <header className="mv2-top">
        <div className="mv2-top-inner">
          <Link className="mv2-logo" to="/" aria-label="빵빵카">
            <img src="/bbang-wordmark.png" alt="빵빵카" />
          </Link>
          <div className="mv2-top-actions">
            <Link className="mv2-pill" to="/login">로그인</Link>
            <Link className="mv2-pill" to="/guest-bookings">예약조회</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mv2-hero" id="mv2-top">
          <picture className="mv2-hero-media">
            <source media="(max-width:760px)" srcSet="/assets/hero/hero-1-mobile.png" />
            <img src="/assets/hero/hero-1-pc.png" alt="렌터카" />
          </picture>
          <div className="mv2-hero-shade" />
          <div className="mv2-hero-inner">
            <div className="mv2-hero-copy">
              <span className="mv2-eyebrow">서울·수도권 딜리버리 렌터카</span>
              <h1>원하는 시간,<br />원하는 장소에서<br />간편하게 예약하세요.</h1>
              <p>예약 가능한 차량과 금액을 바로 확인하고 결제까지 진행합니다.</p>
              <section className="mv2-hero-flow" aria-label="예약 흐름">
                <a href="#mv2-functional-search"><b>01</b><span>위치 선택</span></a>
                <a href="#mv2-functional-search"><b>02</b><span>일정 선택</span></a>
                <a href="#mv2-functional-search"><b>03</b><span>차량 선택·결제</span></a>
              </section>
            </div>
          </div>
        </section>

        <section className="mv2-functional-search" id="mv2-functional-search" aria-label="빠른 예약 검색">
          <div className="mv2-search-head">
            <strong>빠른 예약</strong>
            <span>실시간 검색</span>
          </div>
          <SearchBox />
        </section>

        {hasSearchQuery && <SearchResultsSection />}

        <section className="mv2-section">
          <div className="mv2-section-head"><h2>추천 차량</h2><p>24시간 기준가</p></div>
          <div className="mv2-cars-row">
            <article className="mv2-car"><div className="mv2-car-img"><img src="/assets/mock-cars/mock-car-1.jpg" alt="아반떼" /></div><div className="mv2-car-body"><span className="mv2-tag">만26세</span><h3>아반떼 (CN7)</h3><p>5인승 · LPG · 딜리버리 가능</p><div className="mv2-price"><div><small>24시간 기준가</small><b>56,000원</b></div><a href="#mv2-functional-search">검색</a></div></div></article>
            <article className="mv2-car"><div className="mv2-car-img"><img src="/assets/mock-cars/mock-car-2.jpg" alt="셀토스" /></div><div className="mv2-car-body"><span className="mv2-tag">만26세</span><h3>더 뉴 셀토스</h3><p>5인승 · 가솔린 · 딜리버리 가능</p><div className="mv2-price"><div><small>24시간 기준가</small><b>72,000원</b></div><a href="#mv2-functional-search">검색</a></div></div></article>
            <article className="mv2-car"><div className="mv2-car-img"><img src="/assets/mock-cars/mock-car-3.jpg" alt="카니발" /></div><div className="mv2-car-body"><span className="mv2-tag">만26세</span><h3>카니발 4세대</h3><p>9인승 · 디젤 · 딜리버리 가능</p><div className="mv2-price"><div><small>24시간 기준가</small><b>104,000원</b></div><a href="#mv2-functional-search">검색</a></div></div></article>
          </div>
        </section>

        <section className="mv2-section">
          <div className="mv2-section-head"><h2>상담 안내</h2><p>바로 연결</p></div>
          <div className="mv2-contact-grid">
            <a className="mv2-contact" href="tel:010-2416-7114"><span>전화상담</span><strong>010-2416-7114</strong><p>운영시간 내 빠른 상담</p></a>
            <a className="mv2-contact" href="https://pf.kakao.com/_SZcVn/chat"><span>카카오톡</span><strong>00RENTCAR</strong><p>1:1 채팅 문의</p></a>
            <article className="mv2-contact"><span>방문 주소</span><strong>서울 서초구</strong><p>신반포로23길 78-9</p></article>
            <article className="mv2-contact"><span>운영시간</span><strong>09:00 - 18:00</strong><p>토요일 09:00 - 15:00</p></article>
          </div>
        </section>
      </main>

      <Footer />
      <nav className="mv2-bottom-cta"><a href="#mv2-functional-search">예약 가능 차량 검색</a></nav>
    </div>
  )
}
