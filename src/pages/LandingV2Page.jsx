import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Footer, Header } from '../components/Layout'
import ContactInfoStrip from '../components/ContactInfoStrip'
import SearchBox from '../components/SearchBox'
import SearchResultsSection from '../components/SearchResultsSection'
import { landingContactItems } from '../data/landing'

function BookingGuideModal({ open, onClose }) {
  if (!open) return null

  return (
    <div className="landing-v2-guide-backdrop" onClick={onClose}>
      <div className="landing-v2-guide-dialog" role="dialog" aria-modal="true" aria-label="예약하는 방법" onClick={(event) => event.stopPropagation()}>
        <div className="landing-v2-guide-dialog__head">
          <div>
            <span>예약 안내</span>
            <strong>예약하는 방법</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div className="landing-v2-guide-steps">
          <article><b>01</b><div><strong>딜리버리 위치 선택</strong><p>차량을 받을 지역을 먼저 선택합니다.</p></div></article>
          <article><b>02</b><div><strong>대여·반납 일정 선택</strong><p>예약 가능한 시간 기준에 맞춰 일정을 선택합니다.</p></div></article>
          <article><b>03</b><div><strong>차량 검색 후 결제</strong><p>예약 가능한 차량과 금액을 확인한 뒤 결제를 진행합니다.</p></div></article>
          <article><b>04</b><div><strong>예약 확정 안내</strong><p>예약 완료 후 문자로 예약 정보를 안내합니다.</p></div></article>
        </div>
        <button className="landing-v2-guide-dialog__confirm" type="button" onClick={onClose}>확인했습니다</button>
      </div>
    </div>
  )
}

function FixedHero({ onOpenGuide }) {
  return (
    <section className="landing-v2-fixed-hero" aria-label="빵빵카 렌터카 안내">
      <picture className="landing-v2-fixed-hero__media">
        <img src="/assets/hero/landing-v2-premium-sedan.png" alt="빵빵카 렌터카 예약" />
      </picture>
      <div className="landing-v2-fixed-hero__shade" />
      <div className="landing-v2-fixed-hero__content">
        <span className="landing-v2-fixed-hero__eyebrow">서울·수도권 딜리버리 렌터카</span>
        <h1>서울·수도권 어디든<br />빠르게 딜리버리 렌터카 예약</h1>
        <p>원하는 시간, 원하는 장소에서 간편하게 예약하세요.</p>
        <button className="landing-v2-fixed-hero__guide-button" type="button" onClick={onOpenGuide}>예약하는 방법</button>
      </div>
    </section>
  )
}

function FloatingSearchButton() {
  return (
    <a className="landing-v2-floating-search" href="#landing-v2-reservation">예약 가능 차량 검색</a>
  )
}

export default function LandingV2Page() {
  const location = useLocation()
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const hasSearchQuery = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.has('deliveryDateTime') && params.has('returnDateTime')
  }, [location.search])

  return (
    <div className="page-shell landing-shell landing-v2-simple-shell">
      <Header brandName="빵빵카 주식회사" showGuestBookingAction />
      <main className="landing-page landing-v2-simple-page">
        <FixedHero onOpenGuide={() => setIsGuideOpen(true)} />
        <section className="landing-v2-search-section" id="landing-v2-reservation">
          <div className="container landing-section-stack">
            <SearchBox compact />
          </div>
        </section>
        {hasSearchQuery && <SearchResultsSection />}
        <div className="landing-v2-contact-wrap">
          <ContactInfoStrip items={landingContactItems} />
        </div>
      </main>
      <Footer />
      <BookingGuideModal open={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <FloatingSearchButton />
    </div>
  )
}
