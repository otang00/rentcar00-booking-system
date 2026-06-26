# RENTCAR00 카카오 + OTP 현재 기준

## 문서 상태
- 상태: active current draft
- 용도: 카카오 로그인과 OTP 확장에서 아직 남은 일만 잠그는 문서
- 기준 브랜치: `feat/db-preview-home`
- 관련 past:
  - `docs/past/present-history/2026-04-26_RENTCAR00_RUNTIME_AND_OTP_PROGRESS_PAST.md`

---

## 0. 현재 결론

이미 완료된 것
- 이메일 로그인 골격 유지
- signup용 휴대폰 OTP send / verify API 구현
- OTP 저장/검증 기본 구조 구현

아직 안 된 것
- 카카오 OAuth 진입/콜백
- 카카오 첫 로그인 후 OTP 온보딩 연결
- guest 예약용 OTP 분기
- profile/provider identity 확장
- 운영 Solapi env 설정

즉 이 문서의 현재 범위는
**OTP 기본 구현 자체가 아니라 kakao/guest 확장과 운영 연결**이다.

---

## 1. 현재 기준

### 이미 확보된 것
- member / guest 분리 방향
- provider 는 로그인 수단이고 예약 가능 여부 판단 기준은 아니라는 정책
- signup purpose OTP 런타임

### 남은 핵심 결정
1. 카카오 identity 저장 구조
2. 카카오 첫 로그인 사용자의 onboarding 상태
3. guest 예약에서 OTP 를 어느 시점에 강제할지
4. phone_verified 를 profiles 에 어떻게 반영할지

---

## 2. 남은 작업

### A. 카카오 로그인 연결
- OAuth 진입 버튼
- 콜백 처리
- profile / identity 연결
- phone verification 미완료 시 onboarding 분기

### B. profile 확장
- `phone_verified`
- `phone_verified_at`
- `profile_status`
- provider identity 테이블

### C. guest OTP 구조
- guest 예약 전 OTP 강제 시점 결정
- guest verification 저장 위치 결정
- booking draft 와의 연결 기준 확정

### D. 운영 연결
- Solapi env 반영
- signup OTP 실발송 확인
- 이후 kakao / guest 쪽 purpose 확장 여부 판단

---

## 3. 제외 범위
- PASS/NICE 같은 법적 본인확인
- 자동 계정 병합
- 관리자 수동 병합 도구
- 고도화된 리스크 기반 추가 인증

---

## 4. 한 줄 결론

현재 남은 건 **카카오/guest 확장과 운영 연결**이다.
signup OTP 기본 API 자체는 이미 현재 코드에 들어와 있다.
