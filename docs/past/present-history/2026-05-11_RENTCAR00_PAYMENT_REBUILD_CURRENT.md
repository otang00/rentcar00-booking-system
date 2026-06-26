# RENTCAR00 PAYMENT REBUILD CURRENT

## 문서 상태
- 상태: active current
- 목적: 홈페이지 결제/예약 원장 재정의 기준을 단일 문서로 잠근다.
- 범위: 홈페이지 결제, `booking_orders`, 고객 조회/취소, 관리자 환불
- 제외: IMS 실시간 확인, IMS 예약 생성/취소 자동화, 배차/반차/계약 운영 상태

## 1. 최종 기준
1. `booking_orders` 는 홈페이지 전용 예약/결제 원장이다.
2. 실제 계약/스케줄 운영 원장은 IMS다.
3. 이번 범위에서는 IMS 연동을 붙이지 않는다.
4. 결제 전에는 `booking_orders` row를 만들지 않는다.
5. hold 는 두지 않는다.
6. 임시예약은 만들지 않는다.
7. 사용자가 최종 결제를 시도하면 서버가 마지막 availability 재검증을 수행한다.
8. 재검증은 현재 코드 기준으로 `ims_sync_reservations` 와 `booking_orders` 를 함께 본다.
9. 재검증 실패 시 결제 실패로 처리하고 예약은 생성하지 않는다.
10. 재검증 통과 후 결제 성공이 확인되면 `booking_orders` 를 생성한다.
11. 결제 성공 직후 공개 예약번호를 발급한다.
12. 원장 생성 직후 lookup key 와 status event 를 함께 적재한다.
13. 완료 화면 조회용 completion token 을 발급한다.
14. 운영 이메일 알림은 원장 생성 직후 발송한다.
15. 관리자 알림톡은 이번 리빌드 범위에 포함해 추가한다.
16. 고객 알림톡도 최종 기준에는 포함하되, 발송 서비스 신청/승인 선행이 필요하므로 구현 실행은 후순위로 둔다.
17. 운영 취소는 관리자 예약관리에서 처리한다.
18. 운영 취소 직후 결제 상태는 `refund_pending` 으로 둔다.
19. 실제 환불 처리 완료 후에만 `refunded` 로 바꾼다.

## 2. 서버 상태 기준
### 2.1 booking_status
- `confirmed`
- `cancelled`

### 2.2 payment_status
- `paid`
- `refund_pending`
- `refunded`

### 2.3 보조 필드
- `manual_review_required`: 유지 가능하나 상태 enum으로 확장하지 않는다.
- 이번 범위의 핵심 상태는 아니다.

## 3. 상태 해석
- 결제 전: row 없음
- 결제 성공 직후: `confirmed + paid`
- 운영 취소 직후: `cancelled + refund_pending`
- 환불 완료 후: `cancelled + refunded`

## 4. availability blocking 기준
### booking_orders
- blocking: `confirmed`
- non-blocking: `cancelled`

원칙
- 홈페이지 원장에서는 `confirmed` 가 예약 확정 이후의 살아있는 시간대 차단 상태 전체를 대표한다.
- `in_use`, `completed` 를 쓰지 않아도 홈페이지 재판매 차단에는 문제가 없어야 한다.
- 차단 해제는 `cancelled` 일 때만 일어난다.

## 5. 제거 대상
- `confirmation_pending`
- `confirmed_pending_sync`
- `payment_status = pending`
- 완료 화면의 `예약 접수`
- 완료 화면의 `관리자 확인 후 확정`
- 관리자 `예약 확정` 액션
- 홈페이지 원장에서 `in_use`, `completed` 의존

## 6. 화면 문구 기준
- 결제 완료: `예약 확정`
- 취소 상태: `예약 취소`
- 환불 대기: `환불 처리 중`
- 환불 완료: `환불 완료`

## 7. 원장 생성 후 후속동작 기준
### 현재 코드에서 이미 있는 것
- `booking_orders` row 생성
- `booking_lookup_keys` 생성
- `reservation_status_events` 에 `booking_created` 적재
- completion token 발급
- 전화인증 consume 처리
- 운영 이메일 발송 시도
- 이메일 성공/실패 이벤트 적재

### 현재 코드에서 확인된 이메일 성격
- 현재 `sendBookingConfirmationEmail()` 은 고객 메일이 아니라 운영 수신처(`BOOKING_EMAIL_TO`)로 보내는 예약 알림 메일이다.
- 메일 내용도 현재는 `예약 확정 대기` / `관리자 확인 후 확정` 기준이라 이번 리빌드에서 함께 수정해야 한다.

### 이번 리빌드에서 추가/수정할 것
- 운영 이메일 문구를 `결제 완료 / 예약 확정` 기준으로 교체
- 관리자 알림톡 추가
- 고객 알림톡도 기준에는 포함한다.
- 단, 고객 알림톡은 서비스 신청/템플릿 승인/채널 준비가 선행되어야 하므로 이번 즉시 구현의 blocker 로 명시한다.
- 준비 전까지 운영자용 알림은 이메일을 기본 채널로 유지한다.

## 8. 현재 코드 기준에서 반드시 같이 손볼 축
- `src/components/CarDetailSection.jsx`
- `src/pages/ReservationCompletePage.jsx`
- `src/services/bookingViewModel.js`
- `api/guest-bookings/[action].js`
- `src/services/guestBookingApi.js`
- `server/booking-core/guestBookingService.js`
- `server/booking-core/guestBookingUtils.js`
- `server/booking-core/bookingAvailabilityService.js`
- `api/admin/bookings.js`
- `src/pages/AdminBookingsPage.jsx`
- `src/pages/AdminBookingConfirmPage.jsx`
- `src/services/adminBookingConfirmApi.js`

## 9. 검증 기준
1. 결제 전에는 `booking_orders` row가 생기지 않는다.
2. 결제 성공 후에만 `booking_orders` row가 생성된다.
3. 생성 row 는 `confirmed + paid` 로 저장된다.
4. `booking_lookup_keys` 와 `reservation_status_events` 가 함께 적재된다.
5. completion token 이 발급되고 완료 화면 조회가 된다.
6. 운영 이메일이 발송되거나 실패 이벤트가 남는다.
7. 관리자 알림톡이 발송되거나 실패 이벤트가 남는다.
8. 고객 알림톡은 서비스 신청/승인 준비 전까지 deferred blocker 로 문서화된다.
9. `confirmed` 예약이 있으면 같은 시간대는 재검색/재예약이 차단된다.
10. 관리자 취소 후 `cancelled + refund_pending` 으로 바뀐다.
11. 취소 후에는 같은 시간대 availability 차단이 해제된다.
12. 관리자 환불 완료 후 `cancelled + refunded` 로 바뀐다.
13. 완료/조회/관리자 화면 문구가 `예약 접수/확정 대기` 없이 동작한다.

## 10. 문서 운영 원칙
- 이 범위의 현재 기준은 이 문서와 execution current 문서로 본다.
- IMS 연동 설계는 별도 작업으로 분리한다.
- 과거 접수형/관리자확정형 기준은 active current 에서 제거한다.
