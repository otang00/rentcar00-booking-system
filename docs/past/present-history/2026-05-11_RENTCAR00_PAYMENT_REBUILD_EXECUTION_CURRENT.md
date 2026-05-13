# RENTCAR00 PAYMENT REBUILD EXECUTION CURRENT

## 문서 상태
- 상태: execution current
- 목적: 홈페이지 결제/예약 원장 리빌드의 실제 실행 범위를 phase 단위로 잠근다.

## 1. 목적
- 접수형 예약 흐름을 제거한다.
- 결제 성공 직후 `booking_orders` 생성 구조로 바꾼다.
- 홈페이지 원장 상태를 `confirmed/cancelled` 와 `paid/refund_pending/refunded` 로 단순화한다.
- 관리자 예약관리에서 취소와 환불 처리를 끝낼 수 있게 한다.
- 원장 생성 직후 운영 이메일, 관리자 알림톡, 고객 알림톡 기준까지 정리한다.

## 2. 기준점
- 정책 기준: `docs/policies/RENTCAR00_POLICY.md`
- 상태 기준: `docs/present/2026-05-11_RENTCAR00_PAYMENT_REBUILD_CURRENT.md`
- 현재 핵심 코드:
  - `src/components/CarDetailSection.jsx`
  - `src/pages/ReservationCompletePage.jsx`
  - `api/guest-bookings/[action].js`
  - `src/services/guestBookingApi.js`
  - `server/booking-core/guestBookingService.js`
  - `server/booking-core/guestBookingUtils.js`
  - `server/booking-core/bookingAvailabilityService.js`
  - `api/admin/bookings.js`
  - `src/pages/AdminBookingsPage.jsx`
  - `src/pages/AdminBookingConfirmPage.jsx`
  - `src/services/adminBookingConfirmApi.js`

## 3. Phase 계획
### Phase 1. 상태/문구 기준 교체
목적
- 접수형 상태와 문구를 제거한다.

수정 대상
- `docs/policies/RENTCAR00_POLICY.md`
- `src/services/bookingViewModel.js`
- `src/pages/ReservationCompletePage.jsx`
- `src/pages/AdminBookingConfirmPage.jsx`
- `api/admin/bookings.js`

종료 조건
- `confirmation_pending`, `confirmed_pending_sync`, `예약 접수`, `확정 대기`, `관리자 확인 후 확정` 의존이 제거된다.
- 화면/탭/상태 라벨이 `confirmed/cancelled/refund_pending/refunded` 기준으로 정리된다.

### Phase 2. 예약 생성 경로 재정의
목적
- 결제 성공 직후에만 로컬 원장을 생성하도록 서버 경로를 정리한다.

수정 대상
- `api/guest-bookings/[action].js`
- `src/services/guestBookingApi.js`
- `server/booking-core/guestBookingService.js`
- `server/booking-core/guestBookingUtils.js`

종료 조건
- 결제 성공 surrogate entry 가 `confirmed + paid` 생성으로 연결된다.
- 재검증 실패 시 예약 미생성 규칙이 유지된다.
- 생성 응답이 완료/조회 화면에 필요한 데이터만 반환한다.
- 원장 생성 후 lookup key, status event, completion token 흐름이 새 상태 기준과 일치한다.

### Phase 3. availability blocking 정리
목적
- 홈페이지 로컬 원장 기준 차단 규칙을 `confirmed` 하나로 단순화한다.

수정 대상
- `server/booking-core/bookingAvailabilityService.js`
- 검색 blocking 관련 사용처
- 관련 테스트

종료 조건
- `confirmed` 만 blocking 이다.
- `cancelled` 는 non-blocking 이다.
- 취소 후 availability 해제가 확인된다.

### Phase 4. 예약 후속 알림 정리
목적
- 원장 생성 직후 운영 이메일과 관리자 알림톡을 새 기준에 맞게 정리하고, 고객 알림톡은 구현 선행조건까지 잠근다.

수정 대상
- `server/email/bookingConfirmationEmail.js`
- `server/email/sendBookingConfirmationEmail.js`
- `api/guest-bookings/[action].js`
- `server/sms/sendSolapiMessage.js`
- 신규 카카오 알림톡 helper 또는 notifier 모듈

종료 조건
- 운영 이메일 문구가 `결제 완료 / 예약 확정` 기준으로 바뀐다.
- 운영 이메일 성공/실패가 이벤트로 남는다.
- 관리자 알림톡 발송이 추가된다.
- 관리자 알림톡 성공/실패도 이벤트로 남는다.
- 고객 알림톡은 서비스 신청/템플릿 승인/채널 준비가 선행조건임이 문서와 코드 TODO 기준으로 잠긴다.

### Phase 5. 관리자 취소/환불 기능 정리
목적
- 관리자 예약관리 상세에서 취소와 환불 완료 처리를 수행할 수 있게 한다.

수정 대상
- `api/admin/bookings.js`
- `src/pages/AdminBookingConfirmPage.jsx`
- `src/services/adminBookingConfirmApi.js`
- `server/booking-core/guestBookingService.js`

종료 조건
- 상세 페이지에서 취소 가능
- 취소 시 `refund_pending`
- 환불 완료 액션으로 `refunded` 전환 가능
- 목록/상세 화면 문구가 새 상태 기준과 일치한다.

### Phase 6. 검증
목적
- 새 기준이 실제로 충돌 없이 동작하는지 확인한다.

검증 항목
1. 결제 성공 시 생성
2. lookup key / status event 적재 확인
3. 완료 화면 문구 확인
4. 운영 이메일 발송 확인
5. 관리자 알림톡 발송 확인
6. 고객 알림톡 blocker 문서화 확인
7. 비회원/관리자 조회 확인
8. confirmed blocking 확인
9. 관리자 취소 후 차단 해제 확인
10. 환불 완료 전환 확인

종료 조건
- 위 10개가 모두 통과하거나 남은 blocker 가 명시된다.

## 4. 영향 범위
- 예약 상태 enum 해석
- 관리자 예약목록 탭 분류
- 완료/조회/취소 화면 문구
- availability 차단 규칙
- 운영 이메일 템플릿/수신 흐름
- 관리자 알림톡 발송 흐름
- 고객 알림톡 선행조건/보류 기준
- 관리자 운영 액션

## 5. 리스크
1. 과거 상태값(`confirmation_pending`, `confirmed_pending_sync`)을 읽는 화면/필터가 남아 있을 수 있다.
2. 관리자 취소와 환불 완료 액션을 분리할 때 API 계약이 어색해질 수 있다.
3. availability 차단을 `confirmed` 하나로 줄일 때 테스트가 같이 정리되지 않으면 회귀가 난다.
4. DB enum/migration 이 실제 코드와 어긋나면 런타임 오류가 날 수 있다.
5. 관리자 알림톡/고객 알림톡은 Solapi 설정, 템플릿, 채널 승인 상태에 따라 실제 발송 가능 여부가 갈린다.
6. 고객 알림톡은 서비스 신청이 끝나기 전까지 구현 완료로 간주하면 안 된다.

## 6. 검증 방법
- 관련 서비스 단위테스트 갱신
- 예약 생성/조회/취소/환불 수동 시나리오 점검
- 검색 재진입 시 blocking 동작 확인
- 관리자 화면 상태 라벨 확인
- 운영 이메일 실제 수신 확인
- 관리자 알림톡 발송/실패 로그 확인
- 고객 알림톡 선행조건 체크리스트 확인

## 7. 되돌릴 기준
- 새 상태 기준 적용 후 관리자 조회/취소가 깨지면 Phase 1 변경부터 역순 점검한다.
- availability 차단이 어긋나면 `bookingAvailabilityService.js` 와 검색 사용처를 먼저 되돌림 검토한다.
- IMS 연동은 이번 범위 밖이므로 rollback 판단에 포함하지 않는다.
