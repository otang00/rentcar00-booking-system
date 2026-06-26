# RENTCAR00_CURRENT

## 문서 상태
- 상태: active current
- 용도: rentcar00 예약/회원/보안/API/운영 현재 기준 단일 문서
- 기준 브랜치: `feat/db-preview-home`
- 운영 alias: `https://rentcar00.com`
- 생성일: 2026-04-28

---

## 0. 이 문서의 역할

이 문서는 현재 기준의 **단일 source of truth** 다.

앞으로는 아래처럼 본다.
- 현재 상태/정책/운영 기준: **이 문서 1개**
- 과거 결정/실행 기록: `docs/past/`
- 오래된 설계/작업 메모: `docs/archive/`
- 외부 참고 문서: `docs/references/`, `docs/legal/`

즉, 더 이상 축별 current 문서를 여러 장 유지하지 않는다.

---

## 1. 현재 제품 기준

### 서비스 범위
- 프론트는 렌터카 검색 → 상세 → 예약 접수 흐름을 제공한다.
- 프론트는 외부 IMS/partner를 직접 호출하지 않는다.
- 프론트는 내부 API만 호출한다.
- 상세 페이지는 검색 결과에서 발급된 `detailToken` 검증 통과 시에만 열린다.

### 현재 핵심 사용자 흐름
1. 검색
2. 차량 상세 진입
3. 운전자 정보 입력
4. 약관 동의
5. 예약 접수
6. 예약 완료 화면 확인
7. 비회원 예약조회 또는 회원 예약내역 조회

### 현재 상세페이지 UX 기준
- 로그인 회원이 상세페이지에 들어오면 운전자 정보는 회원 프로필 기준으로 미리 채운다.
- 단, 운전자를 바꿀 수 있으므로 수정은 가능해야 한다.
- 운전자 입력 placeholder 는 예시형으로 유지한다.
  - 이름: `예: 홍길동`
  - 생년월일: `예: 19900101`
  - 휴대폰번호: `예: 010-1234-5678`
- 약관 동의는 체크와 보기 동작을 분리한다.
  - 체크박스/라벨 클릭: 동의 체크
  - `보기` 버튼: 약관 내용 열람

### 현재 회원가입 UX 기준
- 회원가입 전 휴대폰 OTP 인증이 필요하다.
- 주소는 우편번호 검색 popup 으로 입력한다.
- 약관 동의는 체크와 보기 동작을 분리한다.
  - 체크박스/라벨 클릭: 동의 체크
  - `보기` 버튼: 약관 내용 열람

---

## 2. 인증 / 회원 현재 기준

### 최종 로그인 구조
- 사용자 UX 로그인 값: **전화번호 + 비밀번호**
- 연락처 검증: **Solapi OTP**
- Supabase Auth 실제 경로: **email/password**
- 내부 식별자: **전화번호 기반 internal email alias**
- Supabase phone provider: **사용하지 않음**
- 이메일 인증 메일: **필수 아님**

예시 alias
- `01026107114@bbangbbangcar.local`

### 회원가입 필수값
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

선택값
- 실제 연락용 이메일
- 마케팅 동의

### 프로필 기준
- 앱 레벨 canonical identifier 는 전화번호다.
- 프로필 기준 필드:
  - `name`
  - `birthDate`
  - `phone`
  - `postalCode`
  - `addressMain`
  - `addressDetail`
  - `phoneVerified`
  - `profileStatus`

### 현재 남은 인증 운영 체크
- Solapi 운영 ENV 최종 확인
- OTP 실발송 end-to-end 재확인
- 로그인 상태 상세페이지 프리필 운영 실세션 검증

---

## 3. 보안 / 외부 서비스 연동 기준

### 보안 우선순위
- 예약/결제/고객정보가 연결된 민감 시스템으로 본다.
- 치명적 위험 0개를 목표로 한다.
- PII 직접 노출, 권한 우회, 자동화 악용 가능성은 운영 전 우선 차단 대상이다.

### 외부 서비스 연동 공통 원칙
새 외부 서비스(Toss, Stripe, Kakao, 지도, 인증, 주소검색 등)를 붙일 때는 코드보다 먼저 아래를 잠근다.
1. 로더 도메인 (`script-src`)
2. 실제 API 호출 도메인 (`connect-src`)
3. iframe 문서 도메인 (`frame-src`)
4. 이미지/스타일/폰트 추가 도메인 (`img-src`, `style-src`, `font-src`)
5. redirect/callback 경로
6. popup/iframe/postMessage 사용 여부

### CSP 검증 원칙
- 허용은 서비스 단위가 아니라 **실제 브라우저 동작 단위**로 연다.
- popup 이 뜬다고 완료가 아니다.
- popup 기반 서비스도 내부적으로 iframe 을 쓸 수 있으므로 `frame-src` 검토를 빼면 안 된다.
- 운영 반영 전 최소 검증:
  1. 실제 하위 도메인까지 포함한 CSP 허용 목록 확정
  2. preview + prod 도메인 각각 검증
  3. Safari 포함 실제 브라우저 검증
  4. popup/iframe/redirect/postMessage 성공 여부 확인
  5. 콘솔 CSP violation 0건 확인

### 현재 확정된 Kakao postcode 기준
- 회원가입 주소검색은 popup 방식 유지
- 운영 CSP는 아래를 포함해야 한다.
  - `frame-src 'self' https://postcode.map.kakao.com;`
- 검증은 새 창 생성 여부가 아니라 popup 내부 실제 로드까지 본다.

### 현재 보안 후속 우선순위
1. URL/로그/응답 경로의 PII 최소화 유지
2. guest 예약조회/취소 abuse 방어 강화
3. OTP 운영 보강(rate limit, 로그/응답 정리)
4. 결제/외부 연동 추가 시 CSP 재점검

---

## 4. API 현재 기준

### 현재 API 구조
- `api/search-cars.js`
- `api/car-detail.js`
- `api/auth/[action].js`
- `api/auth/otp/[action].js`
- `api/guest-bookings/[action].js`
- `api/member/bookings.js`
- `api/admin/bookings.js`

### 현재 API 원칙
- member 예약 API는 `api/member/bookings.js` 하나로 통일
- admin 예약 API는 `api/admin/bookings.js` 하나로 통일
- 상세 API는 `detailToken` 검증 기반
- auth/me, signup, OTP send/verify 는 auth 축에서 관리

### 현재 운영 blocker
- Solapi 운영 ENV 및 실발송 확인이 남아 있다.

---

## 5. 관리자 현재 기준

### 이미 완료된 것
- 관리자 목록 보호
- 관리자 상세 조회/확정 보호
- 관리자 취소 보호
- 메일 링크 → 로그인 → 원래 상세 복귀
- 관리자 시작 후 취소 허용

### 현재 남은 후속 개선
- `/admin/booking-confirm?token=...` 중심 구조를 줄이고 보호형 상세 경로로 정리
- 관리자 시스템 URL 구조와 권한 모델 일치화

---

## 6. 현재 문서 운용 원칙

- 현재 기준은 이 문서만 수정한다.
- 실행이 끝난 체크리스트/phase 문서는 `docs/past/present-history/` 로 내린다.
- 오래된 설계/초안/작업 메모는 `docs/archive/` 로 보낸다.
- 외부 법률문서/참고문서는 current 가 아니라 reference 다.
- 루트 `README.md` 와 `docs/README.md` 는 이 문서를 가리키도록 유지한다.

---

## 7. 바로 보면 되는 순서
1. `README.md`
2. `docs/README.md`
3. `docs/present/RENTCAR00_CURRENT.md`
4. 필요 시 `docs/references/IMS_API_CALLS.md`
5. 필요 시 `docs/legal/*`
