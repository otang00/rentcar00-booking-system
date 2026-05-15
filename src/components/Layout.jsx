import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getMockCompany } from '../services/company'
import { isAdminUser } from '../utils/adminAccess'
import { landingNotice } from '../data/landing'

export function Header({ brandName, showGuestBookingAction = true } = {}) {
  const navigate = useNavigate()
  const company = getMockCompany()
  const { isAuthenticated, signOut, user, profile } = useAuth()
  const resolvedBrandName = brandName || company.name
  const isAdmin = isAuthenticated && (isAdminUser(user) || isAdminUser(profile))

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <header className="header app-header">
      <div className="container app-header__inner">
        <Link className="app-header__brand" to="/" aria-label={resolvedBrandName}>
          <img src="/bbang-wordmark.png" alt={resolvedBrandName} className="app-header__wordmark" />
        </Link>

        <nav className="app-header__nav" aria-label="주요 메뉴">
          <div className="app-header__menu app-header__menu--auth">
          {isAuthenticated ? (
            <>
              <Link className="app-header__button is-soft" to={isAdmin ? '/admin/bookings' : '/reservations'}>
                {isAdmin ? '관리자 메뉴' : '예약목록'}
              </Link>
              <button className="app-header__button" type="button" onClick={handleSignOut}>로그아웃</button>
            </>
          ) : (
            <>
              <Link className="app-header__button is-soft" to="/login">로그인</Link>
              {showGuestBookingAction ? (
                <Link className="app-header__button" to="/guest-bookings">비회원 예약조회</Link>
              ) : null}
            </>
          )}
          </div>
        </nav>
      </div>
    </header>
  )
}

export function Footer() {
  const company = getMockCompany()

  return (
    <footer className="footer minimal-footer">
      <div className="footer-inner footer-cafe24-shell">
        <div className="footer-copy footer-company-block footer-cafe24-block">
          <div className="footer-company-main footer-cafe24-top">
            <div className="footer-cafe24-left">
              <div className="footer-cafe24-logo-wrap">
                <Link to="/" className="footer-cafe24-logo-link" aria-label={company.name}>
                  <img src="/bbang-wordmark.png" alt={company.name} className="brand-logo footer-logo footer-cafe24-logo" />
                </Link>
              </div>

              <section className="footer-text-group footer-info-group footer-cafe24-info">
                <strong className="footer-section-title">쇼핑몰 기본정보</strong>
                <div className="footer-info-list">
                  <p><span className="footer-label">상호명</span><span>{company.name}</span></p>
                  <p><span className="footer-label">대표자명</span><span>{company.representative}</span></p>
                  <p><span className="footer-label">사업장 주소</span><span>{company.address}</span></p>
                  <p><span className="footer-label">대표 전화</span><span>{company.phone}</span></p>
                  <p><span className="footer-label">사업자 등록번호</span><span>{company.businessNumber}</span></p>
                  <p><span className="footer-label">통신판매신고번호</span><span>{company.mailOrderNumber}</span></p>
                </div>
              </section>
            </div>

            <div className="footer-company-bottom footer-cafe24-right">
              <section className="footer-text-group footer-cafe24-section">
                <strong className="footer-section-title">고객센터 정보</strong>
                <div className="footer-cafe24-copy-list">
                  <p><strong>상담/주문전화</strong><span className="footer-gap" />{landingNotice.phone}</p>
                  <p><strong>상담/주문 이메일</strong> rentcar00@daum.net</p>
                  <p><strong>카카오톡</strong> {landingNotice.kakaoId}</p>
                  <p><strong>CS운영시간</strong> 평일 오전 9시~오후6시</p>
                  <p>토요일 오전9시~오후3시</p>
                  <p>공휴일 휴무</p>
                </div>
              </section>

              <section className="footer-text-group footer-cafe24-section">
                <strong className="footer-section-title">결제 정보</strong>
                <div className="footer-cafe24-copy-list">
                  <p className="footer-bank-title"><strong>무통장 계좌정보</strong></p>
                  <p>하나은행 <span className="footer-gap" /> 360-890004-02504 <span className="footer-gap" /> 빵빵카(주)</p>
                </div>
              </section>

              <section className="footer-text-group footer-cafe24-section footer-cafe24-sns">
                <strong className="footer-section-title">SNS</strong>
                <a href="https://instagram.com/00rentcar" target="_blank" rel="noreferrer">instagram</a>
                <a href="https://pf.kakao.com/_SZcVn/chat" target="_blank" rel="noreferrer">kakao</a>
              </section>
            </div>
          </div>

          <div className="footer-copyright footer-cafe24-bottom">
            <div>Copyright © 빵빵카(주). All Rights Reserved.</div>
            <div className="footer-cafe24-policy-links">
              <Link to="/terms">서비스 이용약관</Link>
              <Link to="/privacy">개인정보 처리방침</Link>
              <Link to="/special-terms">렌터카 이용약관</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export function PageShell({ children }) {
  return (
    <div className="page-shell">
      <Header />
      {children}
      <Footer />
    </div>
  )
}
