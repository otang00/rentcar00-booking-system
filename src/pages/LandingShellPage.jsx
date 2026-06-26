import { Header, Footer } from '../components/Layout'
import ContactInfoStrip from '../components/ContactInfoStrip'
import { LandingHero } from '../components/LandingHero'
import LandingSeoSection from '../components/LandingSeoSection'
import SeoHead from '../components/SeoHead'
import { landingContactItems } from '../data/landing'

export default function LandingShellPage() {
  return (
    <div className="site-shell landing-shell-page">
      <SeoHead
        title="서울·수도권 렌터카 딜리버리 예약 | 단기렌트·월렌트·장기렌트 빵빵카"
        description="빵빵카는 서울·수도권 딜리버리 렌터카 예약 서비스입니다. 단기렌트, 1주일렌트, 월렌트, 장기렌트, 사고대차 상담과 서초 렌트카 배차·반차를 지원합니다."
        canonicalPath="/"
        ogTitle="서울·수도권 렌터카 딜리버리 예약 | 빵빵카"
        ogDescription="서울·수도권 단기렌트, 1주일렌트, 월렌트, 장기렌트, 사고대차 상담 및 딜리버리 배차·반차 지원."
      />
      <Header brandName="빵빵카 주식회사" showGuestBookingAction />
      <main className="landing-page">
        <LandingHero />
        <LandingSeoSection />
        <ContactInfoStrip items={landingContactItems} />
      </main>
      <Footer />
    </div>
  )
}
