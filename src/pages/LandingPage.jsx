import { useParams } from 'react-router-dom'
import { Footer, Header } from '../components/Layout'
import CarDetailSection from '../components/CarDetailSection'
import ContactInfoStrip from '../components/ContactInfoStrip'
import { landingContactItems } from '../data/landing'
import { ColorPreviewHero } from '../components/ColorPreviewHero'

export default function LandingPage() {
  const { carId } = useParams()
  const isDetailMode = Boolean(carId)

  return (
    <div className="page-shell landing-shell color-preview-shell color-preview-mockup-shell">
      <Header brandName="빵빵카 주식회사" showGuestBookingAction />

      <main className="landing-page">
        {isDetailMode ? <CarDetailSection /> : <ColorPreviewHero />}
        <ContactInfoStrip items={landingContactItems} />
      </main>

      <Footer />
    </div>
  )
}
