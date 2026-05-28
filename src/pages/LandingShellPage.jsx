import { Header, Footer } from '../components/Layout'
import ContactInfoStrip from '../components/ContactInfoStrip'
import { landingContactItems } from '../data/landing'
import { LandingHero } from '../components/LandingHero'

export default function LandingShellPage() {
  return (
    <div className="site-shell landing-shell-page">
      <Header brandName="빵빵카 주식회사" showGuestBookingAction />
      <main className="landing-page">
        <LandingHero />
        <ContactInfoStrip items={landingContactItems} />
      </main>
      <Footer />
    </div>
  )
}
