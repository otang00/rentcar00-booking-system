# LOGIN SYSTEM 현재 문서

## 문서 상태
- 상태: active current
- 용도: 로그인/회원가입/OTP 현재 운영 기준 요약
- 기준 브랜치: `feat/db-preview-home`
- 상위 기준 문서:
  - `docs/present/2026-04-28_RENTCAR00_PHONE_AUTH_MASTER_CURRENT.md`
  - `docs/present/2026-04-28_RENTCAR00_PHONE_AUTH_EXECUTION_CURRENT.md`

---

## 0. 현재 운영 기준

현재 기준은 아래로 잠근다.

- 사용자 로그인 UX: **전화번호 + 비밀번호**
- 연락처 검증: **Solapi OTP**
- Supabase Auth 실제 경로: **email/password**
- auth 내부 식별자: **전화번호 기반 internal email alias**
- Supabase phone provider: **사용하지 않음**
- 이메일 인증 메일: **필수 아님**

예시
- `01026107114@bbangbbangcar.local`

---

## 1. 구조 요약

### 회원
- 회원은 하나다.
- 전화번호가 앱 레벨 canonical identifier 다.
- 로그인 수단은 현재 `internal email alias + password` 한 가지로 잠근다.

### OTP
- member signup: OTP 필수
- guest reservation: 기존 guest OTP 흐름 유지
- OTP는 연락처 검증이지 법적 본인확인이 아니다.

### 세션
- 세션/토큰/비밀번호 관리는 Supabase Auth 사용
- 서버 API는 bearer token 기반 검증 유지

---

## 2. 회원가입 기준

필수
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

선택
- 실제 연락용 이메일
- 마케팅 동의

---

## 3. 로그인 기준

1. 사용자는 전화번호 입력
2. 프론트는 숫자만 정규화
3. 정규화 번호로 alias 생성
4. `signInWithPassword({ email: alias, password })` 호출
5. 로그인 후 기존 member 화면 진입

---

## 4. 프로필/상태 기준

- `profiles.phone` 은 unique 축
- `phone_verified = true` 가 active 판단 핵심
- `email_confirmed_at` 는 active 판단 기준 아님
- `pending_email_verification` 는 신규 기준에서 사용하지 않음

권장 `profile_status`
- `incomplete`
- `phone_unverified`
- `active`
- `blocked`
- `withdrawn`

---

## 5. 이번 current에서 제외

- Supabase phone auth/provider 경로
- custom provider / 자체 OIDC
- phone-only password reset
- 카카오 로그인 재설계

---

## 6. 구현 참조

실행 순서와 종료 조건은 아래 문서를 따른다.
- `docs/present/2026-04-28_RENTCAR00_PHONE_AUTH_EXECUTION_CURRENT.md`
