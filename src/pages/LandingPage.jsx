import { useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { Footer, Header } from '../components/Layout'
import CarDetailSection from '../components/CarDetailSection'
import ContactInfoStrip from '../components/ContactInfoStrip'
import SearchResultsSection from '../components/SearchResultsSection'
import { landingContactItems } from '../data/landing'
import { ColorPreviewHero } from '../components/ColorPreviewHero'

export default function LandingPage() {
  const location = useLocation()
  const { carId } = useParams()
  const hasSearchQuery = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.has('deliveryDateTime') && params.has('returnDateTime')
  }, [location.search])
  const isDetailMode = Boolean(carId)

  return (
    <div className={`page-shell landing-shell ${!isDetailMode ? 'color-preview-shell color-preview-mockup-shell' : ''}`}>
      <Header brandName="빵빵카 주식회사" showGuestBookingAction />

      <main className="landing-page">
        {isDetailMode ? <CarDetailSection /> : <ColorPreviewHero />}
        {!isDetailMode && hasSearchQuery && <SearchResultsSection />}
        <ContactInfoStrip items={landingContactItems} />
      </main>

      <Footer />
    </div>
  )
}
