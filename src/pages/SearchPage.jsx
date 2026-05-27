import { Footer, Header } from '../components/Layout'
import ContactInfoStrip from '../components/ContactInfoStrip'
import SearchResultsSection from '../components/SearchResultsSection'
import { landingContactItems } from '../data/landing'

export default function SearchPage() {
  return (
    <div className="page-shell landing-shell color-preview-shell color-preview-mockup-shell search-page-shell">
      <Header brandName="빵빵카 주식회사" showGuestBookingAction />
      <main className="landing-page search-page-main">
        <SearchResultsSection />
        <ContactInfoStrip items={landingContactItems} />
      </main>
      <Footer />
    </div>
  )
}
