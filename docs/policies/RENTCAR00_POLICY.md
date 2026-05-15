# RENTCAR00_POLICY

## 역할
이 문서는 rentcar00 예약 서비스의 **혼동 방지용 기준서**다.

## 정책 문서 원칙
- 이 문서는 **기준을 잠그는 파일**이다.
- 정책이 바뀌면 이 파일을 **애매하게 덧대지 말고 분명하게 고친다.**
- 과거 기준은 미련 두지 말고 `docs/past/` 로 내리거나 과감히 버린다.
- 이미 끝난 작업 과정, 임시 판단, 중간 메모는 이 파일에 남기지 않는다.
- 다음 세션이 헷갈릴 수 있는 결정사항만 남긴다.

목적은 현상을 길게 설명하는 것이 아니라,
새 세션이 아래를 헷갈리지 않게 만드는 것이다.

- 지금 구조가 왜 이렇게 잠겨 있는지
- 무엇을 함부로 바꾸면 안 되는지
- 다음 수정 전에 어디를 먼저 확인해야 하는지

상태 문서가 아니므로 `current`, `past` 같은 꼬리표를 붙이지 않는다.
완료된 실행 기록은 `docs/past/` 에 둔다.

---

## 1. 먼저 알아야 하는 사실

### 1-1. 이 서비스는 홈페이지 전용 예약/결제 원장이다
- `booking_orders` 는 **홈페이지 예약/결제/취소/환불 관리용 로컬 원장**이다.
- 실제 계약 진행, 배차/반차, 스케줄 운영은 **IMS가 최종 운영 원장**이다.
- 따라서 홈페이지 원장은 운영 상태를 세분화하지 않고 아래만 명확히 관리한다.
  - `booking_status = confirmed | cancelled`
  - `payment_status = paid | refund_pending | refunded`
- 결제 전에는 `booking_orders` row를 만들지 않는다.
- 결제 성공 직후에만 예약을 생성하고 예약번호를 발급한다.

### 1-2. 상세페이지는 아무나 바로 열 수 있는 구조가 아니다
- 검색 결과에서 차량별 `detailToken` 이 발급된다.
- 상세 진입과 상세 API는 이 `detailToken` 검증을 전제로 한다.
- 그래서 상세페이지 링크/라우팅/API를 고칠 때는 아래 3개를 같이 봐야 한다.
  1. `api/search-cars.js`
  2. `api/car-detail.js`
  3. `server/security/detailToken.js`
- **차량 ID만으로 상세를 열리게 되돌리면 안 된다.**

### 1-3. 로그인 UX와 실제 Auth 식별자는 다르다
- 사용자에게 보이는 로그인 값은 **전화번호 + 비밀번호** 다.
- 하지만 Supabase Auth 내부 식별자는 **전화번호 기반 internal email alias** 다.
- 즉 “전화번호 로그인”처럼 보이지만 실제로는 아래 구조다.
  - signup: `auth.admin.createUser({ email: alias, password, ... })`
  - login: `signInWithPassword({ email: alias, password })`
- 새 세션에서 이걸 모르고 `phone/password` 경로로 되돌리면 `phone_provider_disabled` 류 장애를 다시 밟을 수 있다.

### 1-4. 계정 신뢰 기준은 `phone_verified` 다
- 이 프로젝트는 Supabase phone provider를 쓰지 않는다.
- 연락처 검증은 **Solapi OTP** 로 하고,
- 프로필 활성 판단은 결국 `phone_verified = true` 중심이다.
- 회원 관련 로직을 손볼 때는 아래를 같이 본다.
  1. `api/auth/[action].js`
  2. `server/auth/ensureProfileForUser.js`
  3. `server/auth/authEmailAlias.js`

---

## 2. 인증 / 회원 기준

### 로그인 구조
- 사용자 UX: **전화번호 + 비밀번호**
- 실제 Auth 경로: **email/password**
- 내부 식별자: **전화번호 기반 internal email alias**
- 연락처 검증: **Solapi OTP**
- Supabase phone provider: **사용하지 않음**
- 이메일 인증 메일: **필수 아님**

예시 alias
- `01026107114@bbangbbangcar.local`

### 회원가입에서 서버가 확정해야 하는 값
- `phone_verified = true`
- `phone_verified_at = verification.verified_at`
- `profiles.phone`
- `profiles.birth_date`
- `profiles.name`
- 주소 필드

### 회원가입/로그인 수정 시 주의
- 프론트 인증완료 상태만 믿으면 안 된다.
- signup 서버에서 OTP 검증 상태를 다시 확인해야 한다.
- alias 생성 규칙은 프론트/서버에서 따로 놀면 안 된다.
- 로그인 UX를 바꾸더라도 내부 Auth 식별자 구조까지 같이 바꾸는지 먼저 판단해야 한다.

### 상세페이지 회원/예약자 정보 기준
- 로그인 회원 상세 진입 시
  - `profile.name`
  - `profile.birthDate`
  - `profile.phone`
  기준으로 회원 정보를 프리필한다.
- 로그인 회원의 기본 예약자 정보는 회원 프로필 기준으로 잠그며, 일반 예약 폼에서 직접 수정하게 하지 않는다.
- 비회원 상세 진입 시에는 `예약자 정보`로 표시하고 휴대폰 OTP 검증 후 진행한다.
- 본 운전자/예약자 정보를 바꾸는 흐름을 guest OTP 경로와 섞으면 안 된다.
- 제2운전자는 본 예약 소유자 변경이 아니므로 개인정보 입력 없이 별도 확인값/담당자 확인 대상으로 다룬다.

---

## 3. 외부 서비스 / CSP 기준

### 가장 중요한 원칙
외부 SDK, 결제창, 지도, 주소검색, 인증 위젯은
**기능 코드보다 CSP/실제 로딩 경로를 먼저 확인**한다.

### 새 세션이 자주 착각하는 부분
- 1차 로더 도메인만 허용하면 끝나는 경우가 거의 없다.
- popup 이 뜨는 것과 기능이 실제 동작하는 것은 다르다.
- popup 기반 서비스도 내부적으로 iframe 을 쓸 수 있다.
- 그래서 `script-src`, `connect-src`, `frame-src` 를 분리해서 봐야 한다.

### 외부 서비스 추가 전 체크 순서
1. 로더 도메인 (`script-src`)
2. 실제 API 호출 도메인 (`connect-src`)
3. iframe 문서 도메인 (`frame-src`)
4. 이미지/스타일/폰트 도메인
5. redirect/callback 경로
6. popup / iframe / redirect / postMessage 중 실제 동작 방식

### 완료 기준
- 버튼이 보인다 = 완료 아님
- 창이 뜬다 = 완료 아님
- 아래까지 확인해야 완료다.
  1. 외부 문서가 실제 로드됨
  2. 필요한 리소스가 차단되지 않음
  3. 사용자 입력 후 콜백/복귀 흐름이 정상 동작함
  4. 콘솔 CSP violation 이 없음

### Kakao postcode 고정 기준
- 회원가입 주소검색은 popup 방식 유지
- 운영 CSP는 아래를 포함해야 한다.
  - `frame-src 'self' https://postcode.map.kakao.com;`
- 이유:
  - popup 이어도 내부 iframe 이 막히면 “창만 뜨고 내용이 안 뜨는” 상태가 생긴다.
- 그래서 주소검색 관련 수정 시에는 항상 아래를 같이 본다.
  1. `vercel.json`
  2. `src/pages/SignupPage.jsx`
  3. 필요 시 `src/pages/PostcodeTestPage.jsx`

---

## 4. API / 경로 기준

### 현재 API 구조
- `api/search-cars.js`
- `api/car-detail.js`
- `api/auth/[action].js`
- `api/auth/otp/[action].js`
- `api/guest-bookings/[action].js`
- `api/member/bookings.js`
- `api/admin/bookings.js`

### 이 구조에서 헷갈리면 안 되는 점
- member 예약 API는 `api/member/bookings.js` 하나로 통일되어 있다.
- admin 예약 API도 `api/admin/bookings.js` 하나로 통일되어 있다.
- auth 축은 `me`, `signup`, `otp send/verify` 로 나뉜다.
- 상세 API는 `detailToken` 검증 전제다.

### 예약 상태 관련 혼동 방지
- 결제 전: 로컬 예약 원장 row 없음
- 결제 성공 직후: `confirmed + paid`
- 운영 취소 직후: `cancelled + refund_pending`
- 환불 완료 후: `cancelled + refunded`
- `confirmed` 는 홈페이지 원장에서 **시간대 차단을 유지하는 유일한 blocking 상태**다.
- `cancelled` 는 non-blocking 상태다.
- `in_use`, `completed`, `confirmation_pending`, `confirmed_pending_sync` 는 이번 홈페이지 원장 기준에서 제거 대상이다.
- 취소/환불 로직은 `booking_status` 와 `payment_status` 를 같이 봐야 한다.

---

## 5. 약관 / 법무 기준 중 정책에 남겨야 하는 것만

### 계약 구조
- 빵빵카 주식회사가 직접 계약 당사자다.
- 예약 흐름은 예약 요청 → 결제/접수 → 회사 확인 및 후속 처리 구조를 전제로 한다.

### 운전자 연령 검증 기준
- 검색 조건의 `driverAge` 는 예약 가능 최소 연령 기준이다.
  - `21` = 대여 시작일 기준 만 21세 이상
  - `26` = 대여 시작일 기준 만 26세 이상
- 생년월일은 `YYYYMMDD` 기준으로 받고, 만 나이 계산 기준일은 예약 생성일이 아니라 대여 시작일이다.
- 프론트 안내만으로 끝내지 않고 서버 결제 준비 단계에서 최종 차단해야 한다.
- 연령 조건 미충족은 예약 요청 거절 사유다.

### 이용 제한 / 취소 사유
아래 사유가 있으면 예약 요청 거절 또는 예약 취소가 가능하다.
- 면허 또는 연령 조건 미충족
- 예약자 본인 확인 실패
- 결제 이상 또는 승인 실패
- 허위정보 입력
- 차량 부족, 고장, 사고, 정비 필요 등으로 정상 배차가 어려운 경우
- 연락두절
- 과거 이용/사고/약관 위반 이력 또는 회사의 운영상·안전상 판단이 필요한 경우
- 천재지변, 재난, 교통통제, 행정명령 등 불가항력

### 환불 / 취소에서 새 세션이 잊기 쉬운 것
- 본인 확인 실패 / 면허 확인 실패 / 노쇼는 환불 불가 기준이 이미 잠겨 있다.
- 회사 사유 취소는 전액 환불 기준이다.
- 조기반납 환불 없음 기준이 있다.

### 개인정보 범위에서 기억해야 하는 것
- 수집항목은 단순 연락처만이 아니다.
- 주소, 면허 정보, 결제 정보, 차량 이용/반납 정보, 상담 기록까지 이어진다.
- 따라서 PII 최소화 정책과 URL/로그/응답 노출 통제는 계속 우선순위다.

---

## 6. 딜리버리 배송비 관리 기준

### truth
- 딜리버리 배송비 truth 는 `public.delivery_regions.round_trip_price` 다.
- 검색/상세 가격 계산은 이 값을 참조한다.

### 관리 방식
- 배송비는 관리자 페이지와 관리자 API 에서 직접 관리한다.
- 관리자 페이지는 가격 허브와 분리하되, API 파일은 신규 생성하지 않는다.
- 배송비 API action 은 기존 `api/admin/pricing-hub.js` 에 추가한다.
- 프론트 API 함수는 기존 `src/services/adminPricingHubApi.js` 에 추가한다.
- 외부 json 또는 sync script 로 배송비를 갱신하지 않는다.
- 폐기 대상:
  - `scripts/sync-delivery-regions.js`
  - `supabase/reference/delivery-cost-list.json`

### 수정 규칙
- 수정 가능 항목은 우선 `round_trip_price`, `active` 로 제한한다.
- `round_trip_price` 는 0 이상의 정수만 허용한다.
- `province_id`, `city_id`, `dong_id` 는 지역 식별자이므로 관리자 화면에서 수정하지 않는다.
- `delivery_regions` 기존 운영 데이터는 삭제하지 않는다.
- migration seed 이력은 초기 환경 재구축 기준으로 보존한다.

---

## 7. 새 세션에서 먼저 확인할 파일

### 인증/회원 수정
1. `docs/policies/RENTCAR00_POLICY.md`
2. `api/auth/[action].js`
3. `server/auth/ensureProfileForUser.js`
4. `server/auth/authEmailAlias.js`
5. `src/pages/LoginPage.jsx`
6. `src/pages/SignupPage.jsx`

### 상세/예약 수정
1. `docs/policies/RENTCAR00_POLICY.md`
2. `src/components/CarDetailSection.jsx`
3. `api/search-cars.js`
4. `api/car-detail.js`
5. `server/security/detailToken.js`
6. `server/booking-core/*`

### 외부 서비스/CSP 수정
1. `docs/policies/RENTCAR00_POLICY.md`
2. `vercel.json`
3. 실제 연동 페이지
4. 필요 시 `src/pages/PostcodeTestPage.jsx`

### 딜리버리 배송비 관리자 수정
1. `docs/policies/RENTCAR00_POLICY.md`
2. `docs/present/2026-05-15_RENTCAR00_SAVE_CONTRACT_CURRENT.md`
3. `api/admin/pricing-hub.js`
4. `src/services/adminPricingHubApi.js`
5. `src/pages/AdminDeliveryRegionsPage.jsx`
6. `server/search-db/repositories/fetchDeliveryRegions.js`
7. `server/search-db/transformers/mapDeliveryRegionsToCompany.js`
8. `server/search-db/pricing/buildAppliedGroupPricing.js`

---

## 8. 정책 파일에 굳이 안 넣은 것
- 이미 화면만 보면 알 수 있는 현상 설명
- 임시 작업 순서
- 끝난 phase 체크리스트
- 날짜 의존 진행 로그

그런 건 정책이 아니라 기록이므로 `docs/past/` 에 남긴다.
