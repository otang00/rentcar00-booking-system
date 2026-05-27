import { Footer, Header } from '../components/Layout'
import ContactInfoStrip from '../components/ContactInfoStrip'
import { ColorPreviewHero } from '../components/ColorPreviewHero'
import { landingContactItems } from '../data/landing'

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
