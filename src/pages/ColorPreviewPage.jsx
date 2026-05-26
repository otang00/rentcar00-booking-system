import { Footer, Header } from '../components/Layout'
import ContactInfoStrip from '../components/ContactInfoStrip'
import { landingContactItems } from '../data/landing'

function ColorPreviewHero() {
  return (
    <section className="color-preview-hero">
      <div className="color-preview-car-photo" aria-hidden="true">
        <img src="/assets/mock-cars/mock-car-2.jpg" alt="" />
      </div>

      <div className="container color-preview-hero-grid">
        <div className="color-preview-copy">
          <span className="color-preview-eyebrow">서울·수도권 딜리버리 렌터카</span>
          <h1>원하는 위치에서<br />바로 받는 렌터카</h1>
          <p>지역과 시간을 먼저 선택하면 예약 가능한 차량만 보여드립니다. 복잡한 상담 전에 실제 가능 차량과 최종가를 먼저 확인하세요.</p>

          <div className="color-preview-trust">
            <div><strong>실시간 가능차량</strong><span>예약 중복 차량 제외</span></div>
            <div><strong>딜리버리 대응</strong><span>서울·수도권 중심</span></div>
            <div><strong>최종가 표시</strong><span>검색 기준 금액 노출</span></div>
          </div>
        </div>

        <aside className="color-preview-search-card" aria-label="예약 가능 차량 검색 미리보기">
          <div className="color-preview-search-head">
            <strong>예약 가능 차량 검색</strong>
            <span>1분 확인</span>
          </div>

          <label className="color-preview-field">
            <span>딜리버리 위치</span>
            <button type="button" className="color-preview-select-row">
              <b>지역을 선택해 주세요</b>
              <em>선택</em>
            </button>
          </label>

          <div className="color-preview-field">
            <span>대여 / 반납</span>
            <div className="color-preview-date-grid">
              <div><small>대여</small><b>05.27<br />10:00</b></div>
              <div><small>반납</small><b>05.28<br />10:00</b></div>
            </div>
          </div>

          <div className="color-preview-field">
            <span>운전자 연령</span>
            <div className="color-preview-age-grid">
              <button type="button" className="is-active">만 26세 이상</button>
              <button type="button">만 21세 이상</button>
            </div>
          </div>

          <button type="button" className="color-preview-cta">예약 가능 차량 검색</button>
        </aside>
      </div>
    </section>
  )
}


export default function ColorPreviewPage() {
  return (
    <div className="page-shell landing-shell color-preview-shell color-preview-mockup-shell">
      <Header brandName="빵빵카 주식회사" showGuestBookingAction />
      <main className="landing-page">
        <ColorPreviewHero />
        <ContactInfoStrip items={landingContactItems} />
      </main>
      <Footer />
    </div>
  )
}
