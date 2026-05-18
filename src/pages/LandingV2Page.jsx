import { Link } from 'react-router-dom'
import { Footer } from '../components/Layout'

export default function LandingV2Page() {
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
        <section className="mv2-hero" id="mv2-search">
          <picture className="mv2-hero-media">
            <img src="/assets/hero/landing-v2-premium-sedan.png" alt="렌터카" />
          </picture>
          <div className="mv2-hero-shade" />
          <div className="mv2-hero-inner">
            <div className="mv2-hero-copy">
              <span className="mv2-eyebrow">서울·수도권 딜리버리 렌터카</span>
              <h1>원하는 시간,<br />원하는 장소에서<br />간편하게 예약하세요.</h1>
              <p>예약 가능한 차량과 금액을 바로 확인하고 결제까지 진행합니다.</p>
              <section className="mv2-trust mv2-hero-trust" aria-label="서비스 특징">
                <div><b>카드결제</b><span>온라인 결제 가능</span></div>
                <div><b>SMS 안내</b><span>예약확정 문자 발송</span></div>
                <div><b>카카오 상담</b><span>빠른 문의 연결</span></div>
              </section>
            </div>
          </div>
        </section>

        <section className="mv2-search-card">
          <div className="mv2-search-head">
            <strong>빠른 예약</strong>
            <span>실시간 검색</span>
          </div>

          <div className="mv2-field">
            <div className="mv2-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
                <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10Z" />
                <circle cx="12" cy="11" r="2" />
              </svg>
              딜리버리 위치
            </div>
            <Link className="mv2-box" to="/#landing-reservation"><b>지역을 선택해 주세요</b><small>선택</small></Link>
          </div>

          <div className="mv2-field">
            <div className="mv2-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="3" />
                <path d="M8 3v4M16 3v4M3 10h18" />
              </svg>
              예약 일정
            </div>
            <Link className="mv2-dates" to="/#landing-reservation">
              <div className="mv2-datebox"><small>대여</small><b>05.20<br />10:00</b></div>
              <div className="mv2-datebox"><small>반납</small><b>05.21<br />10:00</b></div>
            </Link>
          </div>

          <div className="mv2-field">
            <div className="mv2-label">운전자 연령</div>
            <div className="mv2-age">
              <Link to="/#landing-reservation">만 21세~25세</Link>
              <Link to="/#landing-reservation" className="on">만 26세 이상</Link>
            </div>
          </div>

          <Link className="mv2-search-btn" to="/#landing-reservation">예약 가능 차량 검색</Link>
        </section>

        <section className="mv2-section">
          <div className="mv2-section-head"><h2>예약 흐름</h2><p>3단계</p></div>
          <div className="mv2-flow">
            <article className="mv2-flow-step"><div className="mv2-flow-num">01</div><div><strong>위치 선택</strong><span>딜리버리 지역을 먼저 선택합니다.</span></div></article>
            <div className="mv2-flow-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg></div>
            <article className="mv2-flow-step"><div className="mv2-flow-num">02</div><div><strong>일정 선택</strong><span>대여와 반납 시간을 정합니다.</span></div></article>
            <div className="mv2-flow-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg></div>
            <article className="mv2-flow-step"><div className="mv2-flow-num">03</div><div><strong>차량 선택·결제</strong><span>가능 차량 확인 후 예약합니다.</span></div></article>
          </div>
        </section>

        <section className="mv2-section">
          <div className="mv2-section-head"><h2>추천 차량</h2><p>24시간 기준가</p></div>
          <div className="mv2-cars-row">
            <article className="mv2-car"><div className="mv2-car-img"><img src="/assets/mock-cars/mock-car-1.jpg" alt="아반떼" /></div><div className="mv2-car-body"><span className="mv2-tag">만26세</span><h3>아반떼 (CN7)</h3><p>5인승 · LPG · 딜리버리 가능</p><div className="mv2-price"><div><small>24시간 기준가</small><b>56,000원</b></div><Link to="/#landing-reservation">검색</Link></div></div></article>
            <article className="mv2-car"><div className="mv2-car-img"><img src="/assets/mock-cars/mock-car-2.jpg" alt="셀토스" /></div><div className="mv2-car-body"><span className="mv2-tag">만26세</span><h3>더 뉴 셀토스</h3><p>5인승 · 가솔린 · 딜리버리 가능</p><div className="mv2-price"><div><small>24시간 기준가</small><b>72,000원</b></div><Link to="/#landing-reservation">검색</Link></div></div></article>
            <article className="mv2-car"><div className="mv2-car-img"><img src="/assets/mock-cars/mock-car-3.jpg" alt="카니발" /></div><div className="mv2-car-body"><span className="mv2-tag">만26세</span><h3>카니발 4세대</h3><p>9인승 · 디젤 · 딜리버리 가능</p><div className="mv2-price"><div><small>24시간 기준가</small><b>104,000원</b></div><Link to="/#landing-reservation">검색</Link></div></div></article>
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
      <nav className="mv2-bottom-cta"><Link to="/#landing-reservation">예약 가능 차량 검색</Link></nav>
    </div>
  )
}
