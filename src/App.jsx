import { Suspense, lazy } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import CarsPage from './pages/CarsPage'
import PlaceholderPage from './pages/PlaceholderPage'
import LegalPage from './pages/LegalPage'
import GuestBookingsPage from './pages/GuestBookingsPage'
import ReservationCompletePage from './pages/ReservationCompletePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import MemberReservationsPage from './pages/MemberReservationsPage'
import PostcodeTestPage from './pages/PostcodeTestPage'
import MemberReservationDetailPage from './pages/MemberReservationDetailPage'
const AdminBookingConfirmPage = lazy(() => import('./pages/AdminBookingConfirmPage'))
const AdminBookingsPage = lazy(() => import('./pages/AdminBookingsPage'))
const AdminPricingHubPage = lazy(() => import('./pages/AdminPricingHubPage'))

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
      <Route path="/cars" element={<CarsPage />} />
      <Route path="/cars/:carId" element={<LandingPage />} />
      <Route path="/reservations" element={<MemberReservationsPage />} />
      <Route path="/reservations/:reservationCode" element={<MemberReservationDetailPage />} />
      <Route path="/guest-bookings" element={<GuestBookingsPage />} />
      <Route path="/reservation-complete" element={<ReservationCompletePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/postcode-test" element={<PostcodeTestPage />} />
      <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/admin/booking-confirm" element={<LazyRoute><AdminBookingConfirmPage /></LazyRoute>} />
      <Route path="/admin/bookings" element={<LazyRoute><AdminBookingsPage /></LazyRoute>} />
      <Route path="/admin/pricing-hub" element={<LazyRoute><AdminPricingHubPage /></LazyRoute>} />
      <Route path="/faq" element={<PlaceholderPage title="FAQ" />} />
      <Route path="/terms" element={<LegalPage kind="terms" />} />
      <Route path="/privacy" element={<LegalPage kind="privacy" />} />
      <Route path="/special-terms" element={<LegalPage kind="special" />} />
    </Routes>
  )
}
