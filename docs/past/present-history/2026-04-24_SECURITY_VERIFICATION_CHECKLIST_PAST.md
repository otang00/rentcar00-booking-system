# 2026-04-24 Security Verification Checklist

## 목적
실제 결제/고객정보를 다루는 민감 시스템으로 보고, 코드 수정 없이 현재 코드/배포 상태에서 확인된 보안 이슈와 후속 검증 체크리스트를 정리한다.

## 이번 검증 범위
- 소스코드 정적 점검
- API 인증/인가 흐름 점검
- 민감정보 노출 경로 점검
- 라이브 배포 헤더/응답 점검
- 프로덕션 의존성 취약점 점검

## 이번 검증에서 확인한 사실
- 프로덕션 도메인 `https://rentcar00.com` 에 최신 번들 반영 확인
- `vercel.json` 기준 핵심 보안 헤더는 현재 적용됨
- `npm audit --omit=dev` 결과 `nodemailer` 1건 high 취약점 존재
- 코드상 즉시 하드코딩된 비밀키는 직접 확인되지 않았으나, 공개/비공개 구분이 필요한 키와 토큰 설계 이슈가 존재함

---

## 확인된 이슈 체크리스트

### P0 / 운영 전 우선 검토

- [ ] **예약 완료 페이지 URL에 고객 PII가 직접 노출됨**
  - 위험도: 높음
  - 근거:
    - `src/components/CarDetailSection.jsx:305`
    - `src/pages/ReservationCompletePage.jsx:17-19,34`
  - 내용:
    - 예약 생성 직후 `customerName`, `customerPhone`, `customerBirth`를 query string에 실어 `/reservation-complete`로 이동함.
    - URL, 브라우저 히스토리, 캡처, 로그, 리퍼러 전파 경로에서 개인정보가 남을 수 있음.
  - 확인할 것:
    - URL 기반 조회 제거 필요
    - 서버 발급 1회성 completion token 또는 state/cookie 기반 전환 필요

- [ ] **게스트 예약 조회 endpoint에 rate limit / abuse 방어가 없음**
  - 위험도: 높음
  - 근거:
    - `api/guest-bookings/lookup.js:7-49`
    - `server/booking-core/guestBookingService.js:76-125`
  - 내용:
    - 이름 + 휴대폰 + 생년월일 조합으로 예약 조회 가능
    - 코드상 rate limit, CAPTCHA, IP throttling, 실패 누적 차단이 없음
  - 확인할 것:
    - IP/user-agent 기준 rate limit
    - 실패 누적 차단 및 경보
    - lookup/cancel 공통 방어 필요

- [ ] **예약 확정 토큰에 만료가 없음**
  - 위험도: 높음
  - 근거:
    - `server/security/bookingConfirmToken.js:5-75`
  - 내용:
    - booking confirm token payload에는 `exp`가 없음
    - 관리자 인증이 추가로 필요하지만, 링크가 사실상 장기 유효해짐
  - 확인할 것:
    - 만료시간(exp) 도입
    - 1회 사용 또는 상태 기반 무효화 설계

### P1 / 즉시 설계 점검 필요

- [ ] **서버 Supabase 클라이언트가 anon/publishable key까지 fallback 허용**
  - 위험도: 중간~높음
  - 근거:
    - `server/supabase/createServerClient.js:20-35`
  - 내용:
    - 서버가 `SERVICE_ROLE_KEY`가 없어도 `PUBLISHABLE_KEY` / `ANON_KEY`로 동작 가능하게 되어 있음.
    - 운영 환경 오배치 시 권한 부족/오작동/보안 가정 붕괴 가능성 있음.
  - 확인할 것:
    - 민감 API는 service role 강제 여부
    - search/detail/read-only만 anon 허용할지 정책 분리
    - 운영 환경 검증 체크 추가

- [ ] **관리자 메일 링크 origin 생성이 request host/header 신뢰 기반**
  - 위험도: 중간
  - 근거:
    - `server/email/bookingConfirmationEmail.js:30-52`
  - 내용:
    - 메일 confirm URL 생성 시 `x-forwarded-proto`, `host` 값을 그대로 사용
    - 프록시/헤더 신뢰 경계가 잘못되면 잘못된 링크 생성 가능
  - 확인할 것:
    - 고정 `APP_ORIGIN` 사용 여부
    - 허용 host allowlist 적용 여부

- [ ] **보안 헤더 적용 후 CSP 회귀 점검 필요**
  - 위험도: 중간
  - 근거:
    - `vercel.json`
    - 라이브 `curl -I https://rentcar00.com/kakao-map-test.html`
    - 브라우저 콘솔 에러: `Loading the script 'https://t1.daumcdn.net/mapjsapi/js/main/4.4.23/kakao.js' violates the following Content Security Policy directive: "script-src 'self' https://developers.kakao.com https://dapi.kakao.com"`
  - 내용:
    - 현재 `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`는 적용되어 있음
    - 다만 CSP `script-src`가 Kakao Maps 내부 하위 스크립트 로딩 경로 `https://t1.daumcdn.net` 를 허용하지 않아 지도 생성자가 로드되지 않음
    - 최소 테스트 페이지에서도 동일 증상이 재현되어 앱 코드 문제가 아님을 확인함
  - 확인할 것:
    - `script-src`에 `https://t1.daumcdn.net` 또는 검토 후 `https://*.daumcdn.net` 추가
    - 수정 후 최소 테스트 페이지 + 실제 랜딩 지도 모달 재검증
    - 보안 헤더 강화 시 외부 SDK 하위 로딩 경로까지 함께 점검하는 절차 문서화

- [ ] **`nodemailer` 프로덕션 취약점 존재**
  - 위험도: 중간
  - 근거:
    - `package.json:13-18`
    - `npm audit --omit=dev`
  - 내용:
    - 현재 `nodemailer ^6.10.1`
    - advisory 기준 high 포함
  - 확인할 것:
    - 사용 코드 영향도 확인
    - 업그레이드 가능 버전/호환성 검토

### P2 / 정책 정리 및 제거 여부 판단

- [ ] **클라이언트 코드에 카카오 JS key 하드코딩**
  - 위험도: 중간(공개키일 가능성 있음)
  - 근거:
    - `src/data/landing.js:3-6`
  - 내용:
    - 브라우저용 키라면 공개 자체는 가능할 수 있으나, 도메인 제한이 없으면 오용 가능성 존재
  - 확인할 것:
    - Kakao 콘솔 도메인 제한
    - prod/preview/local 허용 origin 정리
    - 키 공개 가능 여부 문서화

- [ ] **레거시 localStorage 예약 저장 유틸에 PII 저장 로직 존재**
  - 위험도: 중간
  - 근거:
    - `src/services/guestReservations.js:1-74`
  - 내용:
    - 현재 실사용 여부는 추가 확인 필요
    - 사용 중이면 고객 이름/휴대폰/생년월일이 브라우저 localStorage에 저장됨
  - 확인할 것:
    - dead code 여부 확인
    - 미사용이면 제거 대상
    - 사용 중이면 즉시 금지

- [ ] **예약/관리 화면에서 생년월일/휴대폰이 평문 표시됨**
  - 위험도: 중간
  - 근거:
    - `server/booking-core/guestBookingUtils.js:113-121`
    - `src/pages/ReservationCompletePage.jsx:56-88`
    - `src/pages/AdminBookingConfirmPage.jsx:159-160`
    - `src/pages/MemberReservationDetailPage.jsx:114-115`
  - 내용:
    - 최소 표시 원칙/마스킹 정책이 없음
  - 확인할 것:
    - 운영자/회원/비회원 화면별 마스킹 정책 수립
    - 로그/메일/응답 단위 최소화

- [ ] **예약 확인 메일 본문에 고객 PII와 상세주소가 포함됨**
  - 위험도: 중간
  - 근거:
    - `server/email/bookingConfirmationEmail.js:62-85,111-120`
  - 내용:
    - 관리자용 메일이라도 평문 메일은 전송/보관/포워딩 리스크가 큼
  - 확인할 것:
    - 메일 본문 최소화
    - 상세조회 링크 중심 구조로 축소 가능 여부 검토

- [ ] **booking confirm token secret fallback 분리 미흡**
  - 위험도: 낮음~중간
  - 근거:
    - `server/security/bookingConfirmToken.js:5-16`
    - `server/security/detailToken.js:8-16`
  - 내용:
    - 여러 토큰이 `DETAIL_TOKEN_SECRET` / `APP_SECRET`를 공유 fallback으로 사용 가능
    - 역할별 secret 분리가 약함
  - 확인할 것:
    - 토큰 종류별 secret 분리
    - env 누락 시 fail-closed 강제

---

## 추가 검증 체크리스트

### Phase 1 — 키/시크릿 검증
- [ ] Vercel prod env 목록 점검
- [ ] Kakao key의 도메인 제한 확인
- [ ] Supabase key 종류별 사용 위치 표 작성
- [ ] 토큰 secret별 분리 여부 확인
- [ ] preview/prod/dev 키 혼용 여부 확인

### Phase 2 — 인증/인가 검증
- [ ] admin API 전체 직접 호출 테스트 설계
- [ ] member API의 user_id 강제 조건 재확인
- [ ] guest lookup / cancel 무차별 대입 시나리오 정리
- [ ] detail token 위변조/재사용 테스트 설계
- [ ] booking confirm token 만료/재사용 정책 정의

### Phase 3 — 개인정보 노출 검증
- [ ] URL/querystring 기반 PII 전달 제거 설계
- [ ] 브라우저 저장소(local/session) PII 저장 금지 확인
- [ ] 화면별 마스킹 기준 정리
- [ ] 메일/로그/이벤트 payload 내 PII 최소화 검토
- [ ] Referrer 전파 차단 헤더 검토

### Phase 4 — 운영 보안 설정 검증
- [ ] CSP 설계 및 외부 SDK 하위 로딩 경로 검증
- [ ] X-Frame-Options 또는 frame-ancestors 설정
- [ ] Referrer-Policy 설정
- [ ] Permissions-Policy 설정
- [ ] API 캐시 정책 재검토
- [ ] 보안 헤더를 Vercel에 적용하는 방식 결정

### Phase 5 — 공급망/의존성 검증
- [ ] `nodemailer` 업그레이드 영향도 확인
- [ ] 외부 SDK(Kakao) 로딩 정책 확인
- [ ] 불필요 의존성 제거 후보 정리
- [ ] prod dependency 주기 점검 프로세스 정의

---

## 이번 단계 결론
현재 코드베이스는 즉시 치명적 비밀키 하드코딩이 확인되지는 않았지만, 민감 시스템 기준으로는 아래 항목이 운영 전 우선 관리 대상이다.

1. URL 기반 PII 전달
2. 게스트 조회/취소 abuse 방어 부재
3. 만료 없는 관리자 확정 토큰
4. 보안 헤더 미구성
5. 메일/화면에서의 PII 최소화 정책 부재
6. `nodemailer` 취약 버전 사용

이 문서는 수정안이 아니라 **검증 및 조치용 체크리스트**다. 다음 단계는 각 항목을 실제 재현/확인하고, 수정 우선순위를 확정하는 것이다.
