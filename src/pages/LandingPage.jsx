import { Suspense, lazy } from 'react'
import { useParams } from 'react-router-dom'
import { Footer, Header } from '../components/Layout'
import ContactInfoStrip from '../components/ContactInfoStrip'
import { landingContactItems } from '../data/landing'
import { ColorPreviewHero } from '../components/ColorPreviewHero'

const CarDetailSection = lazy(() => import('../components/CarDetailSection'))

function DetailFallback() {
  return <div className="page-state-card panel">상세정보를 불러옵니다.</div>
}

export default function LandingPage() {
  const { carId } = useParams()
  const isDetailMode = Boolean(carId)

  return (
    <div className="page-shell landing-shell color-preview-shell color-preview-mockup-shell">
      <Header brandName="빵빵카 주식회사" showGuestBookingAction />

      <main className="landing-page">
        {isDetailMode ? (
          <Suspense fallback={<DetailFallback />}>
            <CarDetailSection />
          </Suspense>
        ) : <ColorPreviewHero />}
        <ContactInfoStrip items={landingContactItems} />
      </main>

      <Footer />
    </div>
  )
}
