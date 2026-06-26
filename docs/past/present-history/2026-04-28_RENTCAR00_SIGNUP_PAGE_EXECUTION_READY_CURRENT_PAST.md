# RENTCAR00 회원가입 + OTP 현재 기준

## 문서 상태
- 상태: active current
- 용도: 회원가입 페이지에서 남은 signup OTP 작업만 관리하는 current 문서
- 기준 브랜치: `feat/db-preview-home`
- 관련 past:
  - `docs/past/present-history/2026-04-26_RENTCAR00_RUNTIME_AND_OTP_PROGRESS_PAST.md`

---

## 0. 현재 상태

이미 완료된 것
- 회원가입 폼 확장
- 비밀번호 규칙 문구 위치 조정
- 휴대폰 OTP UI 연결
- `POST /api/auth/otp/send`
- `POST /api/auth/otp/verify`
- `phone_verifications` 기반 저장/검증 구조
- OTP 만료/재발송 대기/시도횟수 제한

아직 남은 것
- Solapi 운영 ENV 설정
- 운영 실발송 확인
- OTP 완료 상태와 signup submit 최종 연결 점검
- `profiles` 추가 필드 저장 마무리

---

## 1. 현재 기준점

### 프론트
- `SignupPage.jsx` 에 이름/생년월일/이메일/비밀번호/연락처/주소/약관 UI 가 있다.
- OTP 발송/확인 버튼이 실제 API 와 연결되어 있다.
- 회원가입 완료 조건은 OTP verified 기준까지 최종 점검이 필요하다.

### 서버
- `api/auth/otp/[action].js` 가 동작한다.
- `purpose='signup'` 기준 send / verify 흐름이 있다.
- hash 저장, 만료 처리, 재시도 제한, verification token 발급이 구현돼 있다.

### 운영 blocker
- `SOLAPI_API_KEY`
- `SOLAPI_API_SECRET`
- `SOLAPI_SENDER`
- `PHONE_OTP_SECRET`

즉 현재 blocker 는 코드보다 운영 ENV 다.

---

## 2. 남은 phase

## Phase 1. 운영 ENV 설정
### 목적
운영에서 OTP 실발송이 가능하도록 한다.

### 종료 조건
- Vercel / local 양쪽에 Solapi 관련 env 반영
- `/api/auth/otp/send` 가 운영에서 503 없이 응답

---

## Phase 2. signup submit 최종 연결 점검
### 목적
OTP 미완료 상태로는 회원가입 완료가 되지 않게 잠근다.

### 해야 할 일
- `otpVerified` 또는 동등한 서버 검증값 없으면 submit 차단 확인
- 번호 변경 시 인증 무효화 흐름 재확인
- 이메일 인증 흐름과 OTP 상태 충돌 없는지 확인

### 종료 조건
- 미인증 번호로 가입 완료 불가
- 인증 완료 번호만 가입 흐름 통과

---

## Phase 3. profiles 저장 마무리
### 목적
회원가입 후 필요한 프로필 필드를 안정적으로 남긴다.

### 남은 후보
- `birth_date`
- `phone_verified`
- `phone_verified_at`
- `postal_code`
- `address_main`
- `address_detail`

### 종료 조건
- signup 완료 후 저장 필드가 current 문서와 코드에서 일치

---

## Phase 4. 검증
### 체크 항목
- OTP 실발송
- OTP 만료
- OTP 재발송 제한
- OTP 오입력 반복
- 번호 변경 후 재인증
- 이메일 미인증 로그인 차단
- 프론트 빌드 통과

### 종료 조건
- signup + OTP 핵심 흐름을 운영 기준으로 설명 가능

---

## 3. 한 줄 결론

현재 signup OTP 는 **구현 준비 단계가 아니라 서버/프론트 기본 연결 완료 상태**다.
남은 핵심은 **운영 env 반영 + signup 제출 최종 연결 점검**이다.
