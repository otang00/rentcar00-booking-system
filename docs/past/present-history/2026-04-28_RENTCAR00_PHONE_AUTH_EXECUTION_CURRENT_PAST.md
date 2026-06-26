# 2026-04-28 RENTCAR00 AUTH 전환 실행 문서

## 문서 상태
- 상태: active current
- 용도: `internal email alias` 전환 작업의 실행 순서/종료 조건/검증 기준
- 기준 브랜치: `feat/db-preview-home`
- 관련 문서:
  - `docs/present/2026-04-28_RENTCAR00_PHONE_AUTH_MASTER_CURRENT.md`

---

## 0. 목표

목표는 아래 3개를 동시에 만족하는 것이다.

1. 사용자 UX는 `전화번호 + 비밀번호` 유지
2. OTP는 Solapi 단일 경로 유지
3. Supabase Auth는 `email/password` 경로로만 사용

---

## 1. 기준점

현재 확인된 사실
- 실제 signup 데이터는 정상 생성된다.
- 현재 login 실패 원인은 `phone_provider_disabled` 다.
- `ensureProfileForUser.js` 는 이미 `phone_verified` 중심 계산에 가깝다.
- 현재 forgot/reset 화면은 email 기반이라 새 구조와 충돌한다.

---

## 2. 구현 파일 범위

### 직접 수정 대상
- `api/auth/[action].js`
- `src/pages/LoginPage.jsx`
- `src/pages/SignupPage.jsx`
- `src/utils/phone.js`
- `src/pages/ForgotPasswordPage.jsx`
- `src/App.jsx`
- 필요 시 `server/auth/ensureProfileForUser.js`

### 검토 대상
- `docs/present/LOGIN_SYSTEM_CURRENT.md`
- `docs/present/RENTCAR00_SIGNUP_PROFILE_CURRENT.md`
- migration files for `profiles.email` / `profile_status`

---

## 3. Phase plan

## Phase 1. alias 유틸 잠금
### 목적
전화번호 -> internal email alias 변환 규칙을 단일 함수로 고정한다.

### 범위
- `buildAuthEmailAlias(normalizedPhone)` 신규 도입
- signup/login 공용 사용
- 도메인 상수 분리 여부 결정

### 종료 조건
- 동일 전화번호는 항상 동일 alias로 변환된다.

### 검증
- 예시 3건 문자열 테스트 가능

---

## Phase 2. signup API 전환
### 목적
auth user 생성을 `phone auth` 에서 `email alias auth` 로 교체한다.

### 범위
- `admin.createUser({ phone ... })` 제거
- `admin.createUser({ email: alias, password, email_confirm: true ... })` 로 변경
- `profiles.phone` 중복 검사 유지
- 가능하면 auth user alias 중복 검사 메시지 보강
- `user_metadata` 에 실제 phone/email/verified 정보 유지

### 종료 조건
- OTP 완료 번호로 가입 시 email alias auth user 생성
- `profiles` 에는 실제 phone 저장

### 검증
- signup 요청 payload/응답 점검
- duplicate phone 차단

---

## Phase 3. login 화면/호출 전환
### 목적
전화번호 입력 UX는 유지하면서 실제 auth 호출만 alias email로 바꾼다.

### 범위
- login input은 그대로 phone 사용
- submit 시 normalizedPhone -> alias 변환
- `signInWithPassword({ email: alias, password })`
- 에러 문구 일반화

### 종료 조건
- 가입한 번호로 로그인 가능
- phone provider 비활성 상태에서도 로그인 성공

### 검증
- 정상 번호 + 정상 비밀번호 성공
- 정상 번호 + 오입력 비밀번호 실패
- 잘못된 번호 형식 차단

---

## Phase 4. signup UI 정책 정리
### 목적
현재 회원가입 UI를 새 auth 구조와 맞춘다.

### 범위
- 이메일 필드를 선택값으로 낮출지 확정
- 안내 문구에서 phone auth/provider 오해 제거
- success 후 `/login?phone=` 흐름 유지

### 종료 조건
- UI 문구와 실제 auth 구조가 충돌하지 않음

### 검증
- 폼 필수값과 서버 계약 일치

---

## Phase 5. reset-password 임시 정리
### 목적
이메일 기반 reset UI가 사용자 정책과 충돌하지 않게 정리한다.

### 범위
- 1차는 forgot/reset 진입 링크 제거 또는 route 비노출
- 후속 TODO 문서화

### 종료 조건
- 사용자에게 내부 alias email 개념이 노출되지 않음

### 검증
- `/login` 화면 정책 일관성 확인

---

## Phase 6. 회귀 검증
### 목적
인증 핵심 플로우가 실제로 복구됐는지 확인한다.

### 체크리스트
- OTP 발송 성공
- OTP 검증 성공
- signup 성공
- login 성공
- `auth/me` 성공
- member 예약 페이지 진입 성공
- build 통과
- production deploy 후 실사용 확인

---

## 4. 구현 세부 메모

### 4.1 alias 함수 예시
```js
function buildAuthEmailAlias(normalizedPhone) {
  return `${normalizedPhone}@bbangbbangcar.local`
}
```

### 4.2 signup payload 원칙
- 브라우저는 실제 연락용 이메일만 optional로 보낸다.
- 서버는 auth 식별용 email alias를 직접 생성한다.
- 브라우저가 auth email alias를 결정하지 않는다.

### 4.3 existing phone auth user 처리
- 방금 생성된 phone auth 테스트 계정은 새 구조 적용 전 정리 또는 재생성 검토
- 혼재 상태로 두면 중복/로그인 혼선 가능

---

## 5. 승인 후 바로 수정할 항목

수정 순서 권장
1. alias 유틸 추가
2. signup API 수정
3. login 호출 수정
4. forgot/reset 임시 비노출
5. build
6. production deploy
7. 실가입/실로그인 재검증

---

## 6. 한 줄 실행 기준

**phone provider를 고치지 말고, auth 식별자만 internal email alias로 바꿔서 로그인 장애를 제거한다.**
