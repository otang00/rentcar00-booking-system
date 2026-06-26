# 2026-04-28 RENTCAR00 AUTH 전환 마스터

## 문서 상태
- 상태: active current
- 용도: `phone provider` 없이 `Solapi OTP + Supabase email/password auth` 구조로 전환하는 최종 기준 문서
- 기준 브랜치: `feat/db-preview-home`
- 관련 문서:
  - `docs/present/2026-04-28_RENTCAR00_PHONE_AUTH_EXECUTION_CURRENT.md`
  - `docs/present/LOGIN_SYSTEM_CURRENT.md`
  - `docs/present/RENTCAR00_SIGNUP_PROFILE_CURRENT.md`

---

## 0. 최종 결정

기존 운영 시도
- signup: `admin.createUser({ phone, password, phone_confirm: true })`
- login: `signInWithPassword({ phone, password })`
- 실제 장애: `phone_provider_disabled`

새 current 기준
- 사용자 UX 기준 로그인 값: **전화번호 + 비밀번호**
- 본인확인 기준: **Solapi OTP**
- Supabase Auth 식별자: **internal email alias + password**
- 이메일 인증 메일: **필수 아님**
- `phone provider` / Supabase SMS provider: **사용하지 않음**
- 회원 신뢰 기준: `phone_verified = true`

예시 alias
- `01026107114@bbangbbangcar.local`

---

## 1. 왜 이렇게 가는가

1. 현재 구조는 Supabase phone provider 활성화가 필요하다.
2. 우리는 이미 Solapi OTP를 별도로 운영한다.
3. phone provider까지 중복 운영하면 설정/장애 포인트가 늘어난다.
4. Supabase Auth의 세션/토큰/비밀번호 관리는 계속 쓰는 편이 안전하다.

즉,
- **OTP는 우리가 통제**하고
- **로그인 보안/세션은 Supabase Auth에 맡긴다**.

---

## 2. 아키텍처 결론

### 2.1 인증 축
- 연락처 검증: `phone_verifications`
- 계정 생성: server privileged client의 `auth.admin.createUser`
- 로그인: browser client의 `auth.signInWithPassword({ email, password })`
- 세션 확인: 기존 `auth/me` 유지

### 2.2 식별자 축
- 사용자 입력 canonical 값: `profiles.phone`
- auth 내부 식별자: `auth.users.email = <normalizedPhone>@bbangbbangcar.local`
- 실제 연락용 이메일: `profiles.email` 에 별도 저장, 선택값 허용

### 2.3 상태 축
- `phone_verified=true` 가 계정 활성 판단의 핵심
- `email_confirmed_at` 는 활성 판단 기준에서 제외
- `pending_email_verification` 신규 사용 중단

---

## 3. 데이터 계약

### 3.1 profiles
필수 축
- `id`
- `phone` (unique, 숫자만 저장)
- `name`
- `birth_date`
- `phone_verified`
- `phone_verified_at`
- `postal_code`
- `address_main`
- `address_detail`
- `marketing_agree`
- `profile_status`

선택 축
- `email` (실연락용/보조값)

### 3.2 auth.users
- `email`: internal alias 사용
- `password`: 사용자가 설정
- `email_confirm`: 서버 생성 시 확정 처리
- `phone`: 가입 auth 식별자로 사용하지 않음

### 3.3 alias 규칙
- 입력 전화번호는 숫자만 정규화
- alias 생성 규칙은 단일 함수로 고정
- 예: `01026107114 -> 01026107114@bbangbbangcar.local`
- 이 규칙은 signup/login/dup-check/reset 전 구간에서 동일해야 함

---

## 4. 회원가입 기준

### 4.1 필수 입력
- 이름
- 생년월일
- 비밀번호
- 비밀번호 확인
- 휴대폰 번호
- OTP 인증 완료
- 우편번호
- 기본주소
- 상세주소
- 필수 약관 동의

### 4.2 선택 입력
- 실제 연락용 이메일
- 마케팅 동의

### 4.3 signup 서버 규칙
1. phone 정규화
2. OTP verification row 재검증
3. `profiles.phone` 중복 검사
4. alias 생성
5. `auth.admin.createUser({ email: alias, password, email_confirm: true, user_metadata })`
6. `profiles` upsert
7. `phone_verifications` consume

---

## 5. 로그인 기준

### 5.1 사용자 UX
- 사용자는 전화번호와 비밀번호를 입력한다.
- 브라우저는 입력 전화번호를 정규화한다.
- 정규화 값으로 alias를 만든 뒤 `signInWithPassword({ email: alias, password })` 호출한다.

### 5.2 에러 기준
- 잘못된 번호/비밀번호는 하나의 일반화 문구로 처리
- 이메일 인증 문구 노출 제거
- phone provider 관련 문구 제거

---

## 6. 비밀번호 재설정 기준

현재 권고
- 기존 `resetPasswordForEmail(email)` 화면은 현 current와 충돌한다.
- 이번 전환 phase에서는 아래 둘 중 하나로 고정 필요
  1. 임시 비노출
  2. 전화번호 입력 -> alias 변환 -> reset email 발송

현재 추천
- **1차 구현에서는 forgot/reset UI를 비노출**하고 후속 phase로 분리

이유
- 사용자에게 이메일 개념이 보이지 않는 UX와 충돌한다.
- reset 메일 주소가 internal alias인 경우 UX가 깨진다.

---

## 7. 구현 범위 안/밖

### 이번에 한다
- signup auth 식별자 전환
- login 호출 전환
- 상태 계산에서 email confirmation 제거
- current 문서 전체 동기화

### 이번에 안 한다
- phone-only 비밀번호 재설정
- custom provider / OIDC 서버
- phone provider 재도입
- 카카오 로그인 재설계
- 기존 회원 마이그레이션 도구

---

## 8. 리스크

1. alias 규칙 변경 리스크
- 함수가 한 군데라도 다르면 로그인 불가

2. reset-password 공백 리스크
- 1차 전환 직후 비밀번호 분실 복구 UX가 임시 비어 있을 수 있음

3. 기존 생성 phone auth 유저 혼재 리스크
- 이미 생성된 phone 기반 auth user 처리 정책 필요

4. email 필드 의미 혼동 리스크
- `profiles.email` 과 `auth.users.email` 의미를 명확히 분리해야 함

---

## 9. 즉시 후속 결정

이번 구현 전 기준으로 잠그는 것
1. `auth.users.email` 은 internal alias만 사용
2. `profiles.email` 은 선택값으로 유지
3. forgot/reset 화면은 1차에서 비노출
4. 기존 phone-auth 가입 테스트 계정은 정리 대상 별도 관리

---

## 10. 한 줄 기준

**사용자는 전화번호로 로그인하는 것처럼 보이지만, 실제 보안 세션은 Supabase email/password auth 위에서 돈다.**
