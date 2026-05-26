import { useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { Footer, Header } from '../components/Layout'
import CarDetailSection from '../components/CarDetailSection'
import ContactInfoStrip from '../components/ContactInfoStrip'
import HeroShowcase from '../components/HeroShowcase'
import ReservationEntrySection from '../components/ReservationEntrySection'
import SearchResultsSection from '../components/SearchResultsSection'
import { landingContactItems, landingHero } from '../data/landing'

export default function ColorPreviewPage() {
  const location = useLocation()
  const { carId } = useParams()
  const hasSearchQuery = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.has('deliveryDateTime') && params.has('returnDateTime')
  }, [location.search])
  const isDetailMode = Boolean(carId)

  return (
    <div className="page-shell landing-shell color-preview-shell">
      <Header brandName="빵빵카 주식회사" showGuestBookingAction />

      <main className="landing-page">
        <HeroShowcase {...landingHero} />
        {isDetailMode ? <CarDetailSection /> : <ReservationEntrySection />}
        {!isDetailMode && hasSearchQuery && <SearchResultsSection />}
        <ContactInfoStrip items={landingContactItems} />
      </main>

      <Footer />
    </div>
  )
}
