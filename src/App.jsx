import { Suspense, lazy } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { Navigate, Routes, Route } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'

const AdminBookingConfirmPage = lazy(() => import('./pages/AdminBookingConfirmPage'))
const AdminBookingsPage = lazy(() => import('./pages/AdminBookingsPage'))
const AdminDeliveryRegionsPage = lazy(() => import('./pages/AdminDeliveryRegionsPage'))
const AdminPricingHubPage = lazy(() => import('./pages/AdminPricingHubPage'))
const CarsPage = lazy(() => import('./pages/CarsPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const GuestBookingsPage = lazy(() => import('./pages/GuestBookingsPage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const LandingShellPage = lazy(() => import('./pages/LandingShellPage'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const MemberReservationDetailPage = lazy(() => import('./pages/MemberReservationDetailPage'))
const MemberReservationsPage = lazy(() => import('./pages/MemberReservationsPage'))
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'))
const ReservationCompletePage = lazy(() => import('./pages/ReservationCompletePage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))

function RouteLoadingFallback() {
  return <div style={{ padding: 24, color: '#6b7280' }}>페이지를 불러오는 중입니다...</div>
}

function LazyRoute({ children }) {
  return <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Analytics />
      <Routes>
      <Route path="/" element={<LazyRoute><LandingShellPage /></LazyRoute>} />
      <Route path="/landing" element={<Navigate to="/" replace />} />
      <Route path="/landing-shell" element={<Navigate to="/" replace />} />
      <Route path="/search" element={<LazyRoute><SearchPage /></LazyRoute>} />
      <Route path="/cars" element={<LazyRoute><CarsPage /></LazyRoute>} />
      <Route path="/cars/:carId" element={<LazyRoute><LandingPage /></LazyRoute>} />
      <Route path="/reservations" element={<LazyRoute><MemberReservationsPage /></LazyRoute>} />
      <Route path="/reservations/:reservationCode" element={<LazyRoute><MemberReservationDetailPage /></LazyRoute>} />
      <Route path="/guest-bookings" element={<LazyRoute><GuestBookingsPage /></LazyRoute>} />
      <Route path="/reservation-complete" element={<LazyRoute><ReservationCompletePage /></LazyRoute>} />
      <Route path="/login" element={<LazyRoute><LoginPage /></LazyRoute>} />
      <Route path="/signup" element={<LazyRoute><SignupPage /></LazyRoute>} />
      <Route path="/forgot-password" element={<LazyRoute><ForgotPasswordPage /></LazyRoute>} />
      <Route path="/admin/booking-confirm" element={<LazyRoute><AdminBookingConfirmPage /></LazyRoute>} />
      <Route path="/admin/bookings" element={<LazyRoute><AdminBookingsPage /></LazyRoute>} />
      <Route path="/admin/pricing-hub" element={<LazyRoute><AdminPricingHubPage /></LazyRoute>} />
      <Route path="/admin/delivery-regions" element={<LazyRoute><AdminDeliveryRegionsPage /></LazyRoute>} />
      <Route path="/faq" element={<LazyRoute><PlaceholderPage title="FAQ" /></LazyRoute>} />
      <Route path="/terms" element={<LazyRoute><LegalPage kind="terms" /></LazyRoute>} />
      <Route path="/privacy" element={<LazyRoute><LegalPage kind="privacy" /></LazyRoute>} />
      <Route path="/special-terms" element={<LazyRoute><LegalPage kind="special" /></LazyRoute>} />
      </Routes>
    </>
  )
}
