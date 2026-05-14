# 2026-05-14 RENTCAR00 ROUTE SPLITTING COMPLETE

## 문서 상태
- 상태: complete
- 목적: route-level lazy loading 1차 작업 완료 내용을 보관한다.

## 완료 범위
- `src/App.jsx` 기준 page route lazy loading 적용
- admin route 분리
- 회원가입 route 분리
- 비회원 예약조회 route 분리
- 회원 예약내역/상세 route 분리

## 분리된 route/page
### Admin
- `/admin/booking-confirm` → `AdminBookingConfirmPage`
- `/admin/bookings` → `AdminBookingsPage`
- `/admin/pricing-hub` → `AdminPricingHubPage`

### Auth / Guest
- `/signup` → `SignupPage`
- `/guest-bookings` → `GuestBookingsPage`

### Member Reservation
- `/reservations` → `MemberReservationsPage`
- `/reservations/:reservationCode` → `MemberReservationDetailPage`

## 유지한 범위
- 메인/검색/차량 상세 흐름은 eager 유지
- 로그인/비밀번호 재설정/예약완료는 eager 유지
- URL 구조 변경 없음
- 기능/권한 구조 변경 없음

## 검증
- `npm run build` 통과
- lazy chunk 생성 확인
- 메인 JS 감소 확인

## 결과
- 메인 JS 기준:
  - 작업 전 약 528 kB
  - admin 분리 후 약 491 kB
  - signup/guest 분리 후 약 466 kB
  - member reservation 분리 후 약 459 kB

## 커밋
- `1f87f58` feat: lazy load admin routes
- `b79dc63` feat: lazy load signup and guest booking routes
- `c8d23df` feat: lazy load member reservation routes

## 보류 판단
- `ReservationCompletePage`, `LoginPage`, `ResetPasswordPage`는 추가 분리하지 않는다.
- 이유: 크기 절감 효과가 작고, 예약완료/인증 흐름은 UX 민감도가 높다.

## 한 줄 결론
route-level code splitting 1차는 완료했고, 현재 기준 추가 분리는 하지 않는 것이 적절하다.
