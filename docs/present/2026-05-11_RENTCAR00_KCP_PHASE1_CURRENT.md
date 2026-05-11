# 2026-05-11 RENTCAR00 KCP PHASE1 CURRENT

## 목적
- 홈페이지 예약 결제를 NHN KCP 기준으로 전환한다.
- 결제 승인 성공 후에만 `booking_orders` row를 생성한다.
- 1차 범위는 카드결제만 연결하고 환불은 수동 운영으로 유지한다.

## 현재 잠긴 기준
1. 결제수단 1차 범위는 `card` 만 허용한다.
2. 결제 전에는 `booking_orders` row를 만들지 않는다.
3. KCP 승인 성공 시에만 예약을 생성한다.
4. `payment_provider` 는 `nhn_kcp` 로 기록한다.
5. `payment_reference_id` 는 KCP 거래 reference(`tno` 우선)를 저장한다.
6. 환불은 1차에서 자동 연동하지 않는다.
7. 운영 취소 직후 상태는 `cancelled + refund_pending` 을 유지한다.
8. 운영 환불 완료 후 상태는 `cancelled + refunded` 로 유지한다.

## 현재 구현 범위
### 프런트
- 상세페이지 예약 확정 버튼은 더 이상 직접 예약 생성 API를 호출하지 않는다.
- 먼저 `/api/payments/prepare` 를 호출한다.
- prepare 성공 시 KCP 결제창으로 POST submit 한다.
- 결제 실패 시 `/reservation-complete?paymentError=...` 로 돌아와 실패 메시지를 표시한다.

### 서버
- `POST /api/payments/prepare`
  - 예약 입력 검증
  - detail token 검증
  - OTP/회원 잠금 규칙 검증
  - availability 재검증
  - 결제 세션 토큰 발급
  - KCP 거래등록 호출
- `POST /api/payments/return`
  - KCP 복귀 payload 수신
  - 승인 API 호출
  - 승인 성공 시 예약 생성
  - 완료 토큰 발급 후 완료 페이지로 redirect
- `POST /api/payments/approve`
  - 비브라우저/API 테스트용 승인 엔드포인트

## 변경 파일
### 신규
- `api/payments/[action].js`
- `server/payments/paymentSessionToken.js`
- `server/payments/kcpConfig.js`
- `server/payments/kcpClient.js`

### 수정
- `src/components/CarDetailSection.jsx`
- `src/services/guestBookingApi.js`
- `src/pages/ReservationCompletePage.jsx`
- `server/booking-core/guestBookingService.js`
- `api/guest-bookings/[action].js`

## env / 보호대상
아래 값은 아직 코드에 반영만 준비되어 있고 실제 입력은 별도 승인 후 진행한다.
- `KCP_MODE`
- `KCP_SITE_CD`
- `KCP_SITE_KEY`
- `KCP_CERT_INFO`
- 필요 시 `KCP_PAYMENT_SESSION_SECRET`

## git / 배포 기준
- `.gitignore` 에 `.env`, `.env.*` 가 이미 포함되어 있어 env 파일은 추적 제외 상태다.
- `.vercelignore` 에 `tmp/`, `.DS_Store` 가 포함되어 있다.
- 실제 배포 전에는 KCP 도메인용 CSP/연동값을 다시 확인한다.

## 남은 작업
1. KCP 실제 env/인증서 반영
2. KCP 도메인 기준 CSP 확인/반영
3. 테스트 site_cd 로 결제 왕복 검증
4. production 배포
5. 실결제/취소 운영 점검

## 주의
- 구 `guest-bookings/create` 직접 생성 경로는 종료 상태로 본다.
- 실결제 성공 전에는 예약이 생성되면 안 된다.
- 1차에서는 자동 환불 API를 붙이지 않는다.
