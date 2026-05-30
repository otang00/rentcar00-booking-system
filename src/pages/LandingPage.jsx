import { Suspense, lazy } from 'react'
import { Footer, Header } from '../components/Layout'
import ContactInfoStrip from '../components/ContactInfoStrip'
import { landingContactItems } from '../data/landing'

const CarDetailSection = lazy(() => import('../components/CarDetailSection'))

function DetailFallback() {
  return <div className="page-state-card panel">상세정보를 불러옵니다.</div>
}

export default function LandingPage() {
  return (
    <div className="page-shell landing-shell">
      <Header brandName="빵빵카 주식회사" showGuestBookingAction />

      <main className="landing-page">
        <Suspense fallback={<DetailFallback />}>
          <CarDetailSection />
        </Suspense>
        <ContactInfoStrip items={landingContactItems} />
      </main>

      <Footer />
    </div>
  )
}
