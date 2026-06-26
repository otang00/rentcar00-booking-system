# 2026-04-28 RENTCAR00 인증 긴급수정 현안

## 문서 상태
- 상태: active current
- 용도: 회원가입/로그인 인증 기준 변경의 초기 긴급수정 기록
- 기준 브랜치: `feat/db-preview-home`
- 우선순위: urgent
- 현재 상위 기준 문서:
  - `docs/present/2026-04-28_RENTCAR00_PHONE_AUTH_MASTER_CURRENT.md`
  - `docs/present/2026-04-28_RENTCAR00_PHONE_AUTH_EXECUTION_CURRENT.md`

---

## 0. 이번 긴급 결정

기존 방향
- 회원가입 후 이메일 인증
- 이메일 미인증 시 로그인 차단

변경 방향
- **이메일 인증 제거**
- 초기 검토안은 **아이디(이메일) + 비밀번호 + 휴대폰 OTP** 기준이었다.
- 이후 최종 current 기준은 **휴대전화번호 + 비밀번호 + 휴대폰 OTP** 로 승격됐다.
- 이메일은 당분간 선택 연락처 또는 부가 정보로 격하한다.
- 계정 신뢰 기준은 `phone_verified=true` 로 고정한다.

이 결정을 내린 이유
- 이메일 오입력 시 계정이 잘못 생성되고 사용자 구제 흐름이 복잡해짐
- 미인증 계정 이메일 수정/재발송까지 넣으면 현재 phase 범위가 커짐
- 현재 서비스 단계에서는 실사용자 검증을 휴대폰 OTP로 확보하는 편이 더 현실적임

---

## 1. 현재 코드 기준 영향 범위

이미 들어간 것
- signup OTP send / verify API
- `phone_verifications` 기반 검증 구조
- 회원가입 폼 내 주소 입력 필드
- 회원가입 시 `phone_verified`, `phone_verified_at` 저장
- 로그인 페이지의 이메일 미인증 에러 문구 처리
- `profile_status = pending_email_verification` 흐름 일부

이번 긴급수정으로 손봐야 하는 것
- 이메일 인증 전제 문구 제거
- 이메일 미인증 로그인 차단 정책 제거
- `pending_email_verification` 중심 profile 상태 해석 재정리
- 회원가입 성공 메시지/리다이렉트 재정리
- 비밀번호 재설정/계정복구의 장기 기준을 휴대폰 중심으로 다시 잡기

---

## 2. 이번 phase 목표

### 목표
현재 인증 체계를 아래 기준으로 다시 잠근다.

1. 회원가입 전 휴대폰 OTP 완료
2. 주소 입력 완료
3. 회원가입 성공
4. 로그인은 최종적으로 휴대전화번호 + 비밀번호
5. 로그인 허용 기준은 이메일 인증이 아니라 phone verified 기준의 정상 계정 상태
6. 프로필 신뢰 기준은 `phone_verified=true`

### 이번 phase에서 하지 않는 것
- 카카오 로그인
- guest OTP 분기
- 이메일 인증 재발송
- 미인증 이메일 수정 플로우
- 휴대폰 기반 비밀번호 재설정 개편

---

## 3. 긴급수정 phase

## Phase A. 정책 전환 잠금
### 목적
이메일 인증 기반 정책을 중단하고 휴대폰 인증 기반 정책으로 기준점을 바꾼다.

### 종료 조건
- current 문서 기준이 명확히 변경됨
- 구현 범위와 제외 범위가 잠김

---

## Phase B. signup/server 흐름 정리
### 목적
회원가입 성공 조건을 OTP + 주소 기준으로만 유지한다.

### 수정 포인트
- signup 응답의 `requiresEmailVerification` 제거 여부 판단
- 성공 메시지에서 이메일 인증 안내 제거
- 서버 프로필 저장 시 `pending_email_verification` 의존 축소

### 종료 조건
- OTP 완료 + 주소 입력 시 signup 성공
- 이메일 인증 여부와 무관하게 signup 흐름이 끝남

---

## Phase C. login/auth 흐름 정리
### 목적
로그인 차단 기준에서 이메일 미인증 조건을 제거한다.

### 수정 포인트
- 로그인 페이지의 `Email not confirmed` 전용 안내 제거 또는 일반화
- auth/me 및 profile status 해석에서 이메일 인증 의존 제거
- `ensureProfileForUser` 상태 계산 재정리

### 종료 조건
- 휴대폰 OTP 완료 후 가입한 사용자는 이메일 인증 없이 로그인 가능
- 로그인 에러는 실제 credential 실패 기준으로만 내려감

---

## Phase D. 검증
### 체크 항목
- OTP 발송
- OTP 확인
- 번호 변경 시 인증 무효화
- 주소 미입력 시 회원가입 차단
- 회원가입 성공 후 즉시 로그인 가능 여부
- 프론트 build 통과
- 기존 예약/회원 API 영향 여부 최소 점검

### 종료 조건
- 현재 운영 기준으로 인증 흐름을 설명 가능
- 이메일 인증 제거에 따른 주요 회귀가 없음

---

## 4. 주요 리스크

1. 비밀번호 재설정
- 지금까지 이메일 기반 복구를 전제로 보면 이후 재정리가 필요함
- 후속 phase에서 휴대폰 OTP 기반 복구 설계 필요

2. 기존 profile_status 해석
- `pending_email_verification` 를 그대로 두면 의미가 어색해짐
- `active` 전환 규칙 또는 상태값 자체를 단순화할 필요가 있음

3. 기존 가입자 호환성
- 이미 이메일 인증 전제를 가진 계정/문구와 충돌 가능성 점검 필요

---

## 5. 권장 실행 순서

1. 정책/문구 제거
2. signup API 응답 단순화
3. login 에러 처리 단순화
4. profile status 계산 단순화
5. build 및 핵심 플로우 검증

---

## 6. 리스크 요약

1. 서비스 role 오남용 위험
- `admin.createUser()` 는 서버 검증 통과 후에만 호출해야 한다.

2. phone 중복 충돌
- `profiles` 뿐 아니라 auth user 기준 충돌도 같이 막아야 한다.

3. profile 상태값 과도기
- `pending_email_verification` 잔재를 빨리 읽기 호환 상태로 밀어내야 한다.

4. 복구 동선 충돌
- 기존 forgot/reset-password 는 후속 phase에서 phone-first 기준으로 재정리 필요하다.

---

## 7. 한 줄 결론

이번 긴급수정 phase의 핵심은
**이메일 인증 기반 회원가입 체계를 버리고, 최종적으로 전화번호 기반 로그인과 휴대폰 OTP 기반 회원 신뢰 모델로 인증 흐름을 다시 잠그는 것**이다.
