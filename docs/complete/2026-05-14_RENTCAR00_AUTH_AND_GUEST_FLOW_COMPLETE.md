# 2026-05-14 RENTCAR00 AUTH AND GUEST FLOW COMPLETE

## 문서 상태
- 상태: complete
- 목적: 로그인 기본 진입, 이름 검증 완화, 비회원 예약조회 OTP 전환, 회원 전화번호 차단, 비회원 예약 회원 편입까지 완료 기준을 한 문서로 통합한다.

## 이번 완료 범위
1. 로그인 후 기본 진입화면을 `/cars` 로 전환 완료
2. 이름 검증 규칙 완화 완료
3. 비회원 예약조회 OTP + lookup token 구조 전환 완료
4. 회원 전화번호의 비회원 흐름 진입 차단 완료
5. 회원가입 후 진행 중 비회원 예약의 회원 예약 편입 완료

---

## 1. 로그인 기본 진입화면 전환

### 완료 기준
- 로그인 후 기본 이동 경로를 예약내역이 아니라 `/cars` 로 고정했다.
- 회원가입 / 비밀번호 찾기 / 로그인 연계 redirect 기본값도 같은 기준으로 맞췄다.

### 반영 파일
- `src/pages/LoginPage.jsx`
- `src/pages/SignupPage.jsx`
- `src/pages/ForgotPasswordPage.jsx`

---

## 2. 이름 검증 규칙 완화

### 완료 기준
- 허용 문자: 한글 / 영문 / 공백
- 각 단어 5자 제한 제거
- 전체 길이는 느슨하게 유지
- 회원가입 / 결제 진입 / 비회원 예약조회에 같은 규칙 적용

### 의도
- 외국인 이름, 복합 이름, 긴 영문 이름을 막지 않도록 조정했다.
- 대신 특수문자 남용, 공백 장난은 계속 막는다.

### 반영 파일
- `server/auth/identityValidation.js`
- `src/utils/identityValidation.js`

---

## 3. 비회원 예약조회 OTP + lookup token 전환

### 이전 문제
- 이름 + 휴대폰 + 생년월일 direct lookup 기반이라 개인정보 지식형 접근에 가까웠다.
- 조회 후 별도 임시 접근권한이 없어 반복 조회 제어가 약했다.

### 완료 기준
- 비회원 예약조회는 휴대폰 OTP 인증 성공 후에만 가능하다.
- 서버는 짧은 만료시간의 lookup token 을 발급한다.
- 토큰 유효시간 동안만 예약목록 조회/새로고침/취소를 허용한다.
- 만료되면 다시 인증 화면으로 복귀한다.
- 화면 상단에 인증 유효시간을 노출한다.

### UX 기준
1. `/guest-bookings` 진입
2. 휴대폰 번호 입력
3. OTP 인증
4. lookup token 발급
5. 예약목록 화면 진입
6. 상단 유효시간 표시
7. 유효시간 내 새로고침 / 취소 가능
8. 만료 시 재인증

### 저장/보안 기준
- lookup token 은 서버 서명 검증 토큰으로 처리한다.
- 기존 guest lookup protection(rate limit / delay / lock)은 유지한다.
- sessionStorage 로 같은 탭 새로고침은 유지하되, 만료되면 재인증이 필요하다.

### 반영 파일
- `api/guest-bookings/[action].js`
- `server/security/guestLookupToken.js`
- `server/booking-core/guestBookingService.js`
- `src/services/guestBookingApi.js`
- `src/pages/GuestBookingsPage.jsx`

---

## 4. 회원 전화번호의 비회원 흐름 진입 차단

### 완료 기준
모든 OTP 발송 전 아래를 먼저 확인한다.
- 해당 휴대폰 번호로 회원 계정 존재 여부 확인
- 회원 번호면 OTP를 발송하지 않고 로그인 유도 문구로 차단

### 적용 지점
1. 회원가입 OTP 발송 전
2. 비회원 예약 OTP 발송 전
3. 비회원 예약조회 OTP 발송 전
4. 비회원 결제 prepare/진입 시 최종 재확인

### 기본 안내 문구
- 공통: `이미 가입된 휴대폰 번호입니다. 로그인 후 진행해 주세요.`
- 예약조회: `회원 예약은 로그인 후 예약내역에서 확인해 주세요.`

### 반영 파일
- `api/auth/otp/[action].js`
- `api/payments/[action].js`
- `server/auth/memberPhoneLookup.js`

---

## 5. 비회원 예약 → 회원 예약 자동 편입

### 완료 기준
회원가입 완료 직후 아래 조건의 기존 비회원 예약을 회원 예약으로 편입한다.
- `user_id IS NULL`
- 회원가입한 계정의 전화번호와 일치
- `return_at > now()`
- `cancelled`, `completed` 제외
- `cancelled_at`, `completed_at` 있는 예약 제외

### 편입 결과
- 대상 예약의 `booking_orders.user_id` 를 회원 계정으로 연결한다.
- 이후 비회원 예약조회에서는 제외된다.
- 회원 예약내역에서 조회 가능하다.

### 이벤트 기록
- `guest_booking_attached_to_member` 이벤트를 남긴다.

### 회원가입 UX
- 회원가입 화면에 자동 이전 안내 문구를 추가했다.
- 회원가입 완료 시 실제 편입이 있었으면 성공 메시지에 자동 이전 사실을 함께 노출한다.

### 반영 파일
- `api/auth/[action].js`
- `server/booking-core/guestBookingService.js`
- `src/pages/SignupPage.jsx`

---

## 6. 실제 반영 파일
- `api/auth/[action].js`
- `api/auth/otp/[action].js`
- `api/guest-bookings/[action].js`
- `api/payments/[action].js`
- `server/auth/identityValidation.js`
- `server/auth/memberPhoneLookup.js`
- `server/booking-core/guestBookingService.js`
- `server/security/guestLookupToken.js`
- `src/pages/ForgotPasswordPage.jsx`
- `src/pages/GuestBookingsPage.jsx`
- `src/pages/LoginPage.jsx`
- `src/pages/SignupPage.jsx`
- `src/services/guestBookingApi.js`
- `src/utils/identityValidation.js`

---

## 7. 검증 기준
- 서버 문법 확인 통과
- `npm run build` 통과
- production 배포 완료
- `https://rentcar00.com` HTTP 200 확인

### 관련 커밋
- `c8d9007` `feat: improve auth and guest booking entry flows`
- `531a2fc` `feat: block member phones in guest flows`

---

## 8. 남은 후속 후보
1. 비밀번호 재설정 흐름을 휴대폰 OTP 기반으로 재구성
2. 로그인 실패 누적 잠금 구조 설계
3. 로그인 서버 API 래핑 여부 판단
4. CAPTCHA/Turnstile 도입 여부 판단
5. production 에서 실제 회원번호/비회원번호 시나리오 확인
6. 회원 예약 상세의 운전자 정보 수정 가능 여부와 guest lookup token 경계 재검토
   - active current: `docs/present/2026-05-14_RENTCAR00_CURRENT.md`

---

## 한 줄 결론
2026-05-14 기준 인증/비회원 흐름은
**휴대폰 OTP 기준, 회원번호 비회원 흐름 차단, 진행 중 비회원 예약의 회원 예약 편입**까지 운영 반영 완료 상태다.
