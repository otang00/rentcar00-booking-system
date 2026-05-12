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
아래 값은 로컬 `.env` 반영 기준까지 준비되었고, 배포 환경 Secret 반영은 별도 단계로 남아 있다.
- `KCP_MODE=test`
- `KCP_SITE_CD` 반영 준비 완료
- `KCP_SITE_KEY` 반영 준비 완료
- `KCP_CERT_INFO` 인증서 PEM 본문 확보 및 한 줄 직렬화 반영 준비 완료
- `KCP_PAYMENT_SESSION_SECRET` 신규 생성 반영 준비 완료

### 2026-05-12 업데이트
1. KCP 인증서 zip에서 아래 파일을 확인했다.
   - `KCP_AUTH_ALRFN_CERT.pem`
   - `KCP_AUTH_ALRFN_PRIKEY.pem`
2. `KCP_CERT_INFO` 는 인증서 PEM 본문을 `\n` 이스케이프 형식으로 `.env` 에 넣는 방식으로 정리했다.
3. `server/payments/kcpConfig.js` 에서 `KCP_CERT_INFO` 의 `\n` 을 실제 줄바꿈으로 복원하도록 보정했다.
4. `.env` 백업 파일을 생성한 뒤 KCP test 값을 로컬 환경에 반영했다.
5. Vercel preview 환경(`feat/db-preview-home` 브랜치 기준)에도 KCP test 값을 반영했다.
6. preview 배포 URL: `https://rentcar00-booking-system-ggpkkmip7-otang00s-projects.vercel.app`
7. Vercel production 환경에도 동일한 KCP 값을 반영했고, `https://rentcar00.com` 으로 production 배포를 완료했다.
8. 이후 `ALRFN` 상점코드는 test endpoint 비대상임을 확인했고 `KCP_MODE=production` 으로 정정했다.
9. 거래등록 요청 형식을 form-urlencoded 에서 KCP 공식 기준 JSON POST 로 수정했다.
10. 로컬 진단에서 거래등록 `Code=0000`, `Message=Success` 를 확인했다.
11. 배포 직후 `https://rentcar00.com` 의 기본 응답 `HTTP 200` 을 확인했다.
12. 개인키와 비밀번호는 이번 1차 승인 흐름에서 직접 사용하지 않고, 별도 보관 대상으로 유지한다.
13. 작업 중 임시로 풀어본 로컬 인증서/개인키 파일은 반영 후 즉시 삭제했다.

## git / 배포 기준
- `.gitignore` 에 `.env`, `.env.*` 가 이미 포함되어 있어 env 파일은 추적 제외 상태다.
- `.vercelignore` 에 `tmp/`, `.DS_Store` 가 포함되어 있다.
- 실제 배포 전에는 KCP 도메인용 CSP/연동값을 다시 확인한다.

## 남은 작업
1. preview 또는 production에서 실제 결제 왕복 검증
2. KCP 도메인 기준 추가 CSP 점검 필요 여부 확인
3. 실결제/취소 운영 점검
4. 버튼/문구 최종 UX 확인

## 주의
- 구 `guest-bookings/create` 직접 생성 경로는 종료 상태로 본다.
- 실결제 성공 전에는 예약이 생성되면 안 된다.
- 1차에서는 자동 환불 API를 붙이지 않는다.
