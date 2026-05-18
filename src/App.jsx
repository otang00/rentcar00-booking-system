import { Suspense, lazy } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LandingV2Page from './pages/LandingV2Page'
import CarsPage from './pages/CarsPage'
import PlaceholderPage from './pages/PlaceholderPage'
import LegalPage from './pages/LegalPage'
import ReservationCompletePage from './pages/ReservationCompletePage'
import LoginPage from './pages/LoginPage'
import PostcodeTestPage from './pages/PostcodeTestPage'
const MemberReservationsPage = lazy(() => import('./pages/MemberReservationsPage'))
const MemberReservationDetailPage = lazy(() => import('./pages/MemberReservationDetailPage'))
const GuestBookingsPage = lazy(() => import('./pages/GuestBookingsPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const AdminBookingConfirmPage = lazy(() => import('./pages/AdminBookingConfirmPage'))
const AdminBookingsPage = lazy(() => import('./pages/AdminBookingsPage'))
const AdminPricingHubPage = lazy(() => import('./pages/AdminPricingHubPage'))
const AdminDeliveryRegionsPage = lazy(() => import('./pages/AdminDeliveryRegionsPage'))

function RouteLoadingFallback() {
  return <div style={{ padding: 24, color: '#6b7280' }}>페이지를 불러오는 중입니다...</div>
}

function LazyRoute({ children }) {
  return <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/landing" element={<Navigate to="/" replace />} />
      <Route path="/landing-v2" element={<LandingV2Page />} />
      <Route path="/cars" element={<CarsPage />} />
      <Route path="/cars/:carId" element={<LandingPage />} />
      <Route path="/reservations" element={<LazyRoute><MemberReservationsPage /></LazyRoute>} />
      <Route path="/reservations/:reservationCode" element={<LazyRoute><MemberReservationDetailPage /></LazyRoute>} />
      <Route path="/guest-bookings" element={<LazyRoute><GuestBookingsPage /></LazyRoute>} />
      <Route path="/reservation-complete" element={<ReservationCompletePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<LazyRoute><SignupPage /></LazyRoute>} />
      <Route path="/postcode-test" element={<PostcodeTestPage />} />
      <Route path="/forgot-password" element={<LazyRoute><ForgotPasswordPage /></LazyRoute>} />
      <Route path="/admin/booking-confirm" element={<LazyRoute><AdminBookingConfirmPage /></LazyRoute>} />
      <Route path="/admin/bookings" element={<LazyRoute><AdminBookingsPage /></LazyRoute>} />
      <Route path="/admin/pricing-hub" element={<LazyRoute><AdminPricingHubPage /></LazyRoute>} />
      <Route path="/admin/delivery-regions" element={<LazyRoute><AdminDeliveryRegionsPage /></LazyRoute>} />
      <Route path="/faq" element={<PlaceholderPage title="FAQ" />} />
      <Route path="/terms" element={<LegalPage kind="terms" />} />
      <Route path="/privacy" element={<LegalPage kind="privacy" />} />
      <Route path="/special-terms" element={<LegalPage kind="special" />} />
    </Routes>
  )
}
