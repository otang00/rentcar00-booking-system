# RENTCAR00 회원가입/회원프로필 현재 문서

## 문서 상태
- 상태: active current
- 용도: 회원가입 입력/프로필 저장 현재 기준 문서
- 기준 브랜치: `feat/db-preview-home`
- 상위 기준 문서:
  - `docs/present/2026-04-28_RENTCAR00_PHONE_AUTH_MASTER_CURRENT.md`

---

## 0. 현재 결론

회원가입은 **전화번호 OTP 완료 후**, 서버가 **internal email alias 기반 Supabase auth user** 를 생성하는 구조로 잠근다.

즉,
- 사용자는 전화번호로 가입/로그인한다고 느낀다.
- 실제 Supabase Auth 식별자는 내부 alias email 이다.
- 실제 연락용 이메일은 선택 프로필 값이다.

---

## 1. 회원가입 필수 항목

1. 이름
2. 생년월일
3. 비밀번호
4. 비밀번호 확인
5. 휴대폰 번호
6. OTP 인증 완료
7. 우편번호
8. 기본주소
9. 상세주소
10. 필수 약관 동의

선택 항목
- 실제 연락용 이메일
- 마케팅 동의

---

## 2. 저장 기준

### auth.users
- `email`: internal alias
- `password`: 사용자 입력
- `email_confirm`: true 처리
- `user_metadata`: 실제 phone / 선택 email / 주소 / 약관 관련 최소값 유지

### profiles
- `phone`: canonical identifier
- `email`: 실제 연락용 선택값
- `phone_verified`: true
- `phone_verified_at`: OTP 검증 시각
- `profile_status`: `active` 중심

---

## 3. 가입 완료 조건

가입 완료는 아래가 모두 충족될 때만 인정한다.
- 휴대폰 번호 형식 정상
- OTP verification row 재검증 통과
- phone 중복 아님
- 비밀번호 정책 통과
- 주소/생년월일/약관 완료
- auth user 생성 성공
- profile upsert 성공
- verification consume 성공 또는 경고 포함 성공 처리 기준 충족

---

## 4. 화면 구조 기준

Section 1. 기본정보
- 이름
- 생년월일
- 실제 연락용 이메일(선택)

Section 2. 비밀번호
- 비밀번호
- 비밀번호 확인

Section 3. 연락처 인증
- 휴대폰 번호
- 인증번호 받기
- 인증번호 입력
- 인증 확인

Section 4. 주소
- 우편번호
- 기본주소
- 상세주소

Section 5. 약관 동의
- 필수 약관
- 선택 마케팅 동의

Section 6. 회원가입

---

## 5. 정책 메모

- OTP는 연락처 검증이다.
- 실제 auth email alias는 사용자에게 노출하지 않는다.
- 이메일 인증 메일은 현재 정책에서 필수 아님.
- forgot/reset은 1차 전환에서 비노출 권장.

---

## 6. 리스크

1. alias 규칙 변경 시 기존 계정 로그인 불가
2. `profiles.email` 과 `auth.users.email` 의미 혼동 가능
3. reset-password 경로 미정리 시 UX 충돌

---

## 7. 한 줄 기준

**회원가입은 phone-first UX지만, 계정 보안 저장소는 Supabase email/password auth를 사용한다.**
