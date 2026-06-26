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
    <header className="site-header">
      <div className="site-container site-header__inner">
        <Link className="site-header__brand" to="/" aria-label={resolvedBrandName}>
          <img src="/bbang-wordmark.png" alt={resolvedBrandName} className="site-header__wordmark" />
        </Link>

        <nav className="site-header__nav" aria-label="주요 메뉴">
          <div className="site-header__menu">
          {isAuthenticated ? (
            <>
              <Link className="site-header__button is-soft" to={isAdmin ? '/admin/bookings' : '/reservations'}>
                {isAdmin ? '관리자 메뉴' : '예약목록'}
              </Link>
              <button className="site-header__button" type="button" onClick={handleSignOut}>로그아웃</button>
            </>
          ) : (
            <>
              <Link className="site-header__button is-soft" to="/login">로그인</Link>
              {showGuestBookingAction ? (
                <Link className="site-header__button" to="/guest-bookings">비회원 예약조회</Link>
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
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__block">
          <div className="site-footer__main">
            <div className="site-footer__left">
              <div className="site-footer__logo-wrap">
                <Link to="/" className="site-footer__logo-link" aria-label={company.name}>
                  <img src="/bbang-wordmark.png" alt={company.name} className="site-footer__logo" />
                </Link>
              </div>

              <section className="site-footer__section site-footer__info">
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

            <div className="site-footer__right">
              <section className="site-footer__section">
                <strong className="footer-section-title">고객센터 정보</strong>
                <div className="site-footer__copy-list">
                  <p><strong>상담/주문전화</strong><span className="footer-gap" />{landingNotice.phone}</p>
                  <p><strong>상담/주문 이메일</strong> rentcar00@daum.net</p>
                  <p><strong>카카오톡</strong> {landingNotice.kakaoId}</p>
                  <p><strong>CS운영시간</strong> 평일 오전 9시~오후6시</p>
                  <p>토요일 오전9시~오후3시</p>
                  <p>공휴일 휴무</p>
                </div>
              </section>

              <section className="site-footer__section">
                <strong className="footer-section-title">결제 정보</strong>
                <div className="site-footer__copy-list">
                  <p className="footer-bank-title"><strong>무통장 계좌정보</strong></p>
                  <p>하나은행 <span className="footer-gap" /> 360-890004-02504 <span className="footer-gap" /> 빵빵카(주)</p>
                </div>
              </section>

              <section className="site-footer__section site-footer__sns">
                <strong className="footer-section-title">SNS</strong>
                <a href="https://instagram.com/00rentcar" target="_blank" rel="noreferrer">instagram</a>
                <a href="https://pf.kakao.com/_SZcVn/chat" target="_blank" rel="noreferrer">kakao</a>
              </section>
            </div>
          </div>

          <div className="site-footer__bottom">
            <div>Copyright © 빵빵카(주). All Rights Reserved.</div>
            <div className="site-footer__policy-links">
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

export function PageShell({ children, className = '' }) {
  return (
    <div className={['site-shell', 'page-shell', className].filter(Boolean).join(' ')}>
      <Header />
      {children}
      <Footer />
    </div>
  )
}
