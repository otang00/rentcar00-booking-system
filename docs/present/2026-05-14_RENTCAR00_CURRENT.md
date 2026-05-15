# 2026-05-14 RENTCAR00 CURRENT

## 문서 상태
- 상태: active current
- 목적: 예약 상세/결제 진입 UI 정리, 회원/비회원 예약 식별 경계, 운전자 연령 검증을 현재 작업 기준으로 잠근다.

## 현재 요청 1. 예약 약관 체크박스 색상 정리

### 문제
예약 상세/결제 진입 화면의 약관 동의 체크박스가 과하게 빨간색으로 보인다.

### 기준
- 약관 체크박스는 빨간 강조 UI가 아니다.
- 검정 테두리 박스 + 기본 체크 형태로 정리한다.
- 전역 checkbox 스타일 변경은 피하고, 가능하면 `.terms-list` 영역으로만 한정한다.

### 대상 후보
- `src/components/CarDetailSection.jsx`
- `src/styles.css`

### 종료 조건
- 약관 동의 체크박스가 검정 테두리 기반으로 보인다.
- 오류 문구/검증 상태의 빨간색은 필요한 범위에서만 유지된다.
- 다른 checkbox UI에 불필요한 영향이 없다.

---

## 현재 요청 2. 관리자 pricing hub 가격 미리보기 카드 순서 변경

### 문제
관리자 pricing hub 가격 미리보기 카드의 상단 4개 순서가 실사용 시 직관적이지 않다.

### 기준
상단 4개 카드는 아래 순서로 배치한다.

1행:
- `기준24`
- `주말24`

2행:
- `1시간`
- `주중24`

즉 배열 순서는 아래로 잠근다.
1. `기준24`
2. `주말24`
3. `1시간`
4. `주중24`

### 대상 후보
- `src/pages/AdminPricingHubPage.jsx`
- 필요 시 `src/styles.css`

### 적용 지점 후보
- 현재 적용 금액
- 선택 정책 가격
- 정책 가격 미리보기

### 종료 조건
- 위 3개 MoneyGrid 출력에서 상단 4개 카드 순서가 동일하다.
- 모바일 2열에서도 `기준24 / 주말24`, `1시간 / 주중24` 순서로 보인다.

---

## 현재 이슈 3. 회원 예약 운전자 정보 수정 가능 상태 재검토

### 사용자 우려
로그인한 회원 예약에서 잠겨 있어야 할 운전자 정보를 수정할 수 있는 상태로 보인다.
이 경우 회원 예약인지 비회원 예약인지 판단 경계가 흐려질 수 있다.

### 확인 필요
아래는 아직 코드 확인 전 이슈 잠금이며, 사실 확정이 아니다.

- 회원 예약 상세에서 운전자 정보 수정이 가능한지 확인 필요
- 비회원 예약조회 OTP 흐름이 회원 여부를 먼저 차단하는지 재확인 필요
- 로그인 회원 예약이 비회원 예약조회/lookup token 흐름과 섞이는지 확인 필요
- 회원 예약의 운전자 정보는 회원 identity 기준으로 잠가야 하는지, 또는 수정 금지로 가야 하는지 판단 필요

### 위험
- 회원 예약을 비회원 예약처럼 다루면 소유자 식별과 개인정보 수정 권한이 꼬일 수 있다.
- OTP가 단순 휴대폰 소유 확인만 하고 회원 세션 확인 없이 예약 접근을 열면, 회원 예약/비회원 예약 경계가 약해질 수 있다.
- 운전자 정보 수정 허용 시 예약 원장과 회원 프로필/본인확인 기준이 불일치할 수 있다.

### 1차 기준
- 회원 예약은 로그인 세션 기준으로 확인한다.
- 비회원 예약조회는 회원 전화번호를 차단해야 한다.
- 로그인 회원의 기본 예약자/회원 정보는 프로필 기준으로 잠근다.
- 회원 예약 진입 화면에서는 기존 `운전자 정보 수정` 버튼과 잠금 문구를 제거한다.
- 로그인 회원 화면 제목은 `회원 정보`, 비회원 화면 제목은 `예약자 정보`로 구분한다.
- 본 운전자 정보 수정은 허용하지 않는다.
- 제2운전자 처리는 개인정보 입력이 아니라 별도 `제2운전자가 있습니다` 확인값으로만 준비한다.

### 조사 대상
- `src/pages/MemberReservationDetailPage.jsx`
- `src/services/memberBookingApi.js`
- `api/member/bookings.js`
- `api/guest-bookings/[action].js`
- `server/booking-core/guestBookingService.js`
- `server/auth/memberPhoneLookup.js`

### 권장 phase

#### Phase 1. 사실 확인
- 회원 예약 상세의 운전자 정보 표시/수정 가능 여부 확인
- member API와 guest API가 같은 예약 row를 어떻게 필터링하는지 확인
- guest lookup OTP가 회원 번호를 차단하는지 실제 코드 기준으로 확인

종료 조건:
- 회원/비회원 예약 접근 경계가 코드 기준으로 정리된다.

#### Phase 2. 정책 결정
선택지는 둘 중 하나로 잠근다.

A. 회원 예약 운전자 정보 수정 금지
- 가장 보수적이다.
- 예약 후 운전자 정보는 잠금 표시만 한다.

B. 회원 예약 운전자 정보 수정 허용
- 로그인 세션 + 추가 인증/정책 조건이 필요하다.
- guest lookup token 경로와 절대 섞지 않는다.

종료 조건:
- UI/API 수정 기준이 확정된다.

#### Phase 3. 구현
- 확정된 정책만 반영한다.
- 회원/비회원 흐름을 동시에 건드리지 않는다.

종료 조건:
- build 통과
- 회원 예약 상세 확인
- 비회원 예약조회 회원번호 차단 확인

---

## 현재 이슈 4. 예약자 생년월일 기반 운전자 연령 검증

### 문제
검색 조건에서 `만 21세~25세` 또는 `만 26세 이상`을 선택하더라도, 예약자 생년월일 기준 실제 만 나이 검증이 결제 진입 전에 명확히 잠겨 있지 않다.

### 기준
- 검색 조건의 `driverAge` 값을 예약 가능 최소 연령으로 본다.
  - `driverAge = 21` → 대여 시작일 기준 만 21세 이상 필요
  - `driverAge = 26` → 대여 시작일 기준 만 26세 이상 필요
- 기준일은 예약 생성일이 아니라 `deliveryDateTime` / `pickup_at` 이다.
- 생년월일 `YYYYMMDD` 기준으로 만 나이를 계산한다.
- 프론트 안내와 서버 차단을 둘 다 넣는다.
- 프론트 검증은 UX용이고, 서버 `payments/prepare` 검증이 최종 차단 기준이다.

### 안내 문구 기준
- `선택한 운전자 연령 조건은 만 {requiredAge}세 이상입니다. 대여 시작일 기준 만 {requiredAge}세 이상만 예약할 수 있습니다.`

### 수정 대상 후보
- `src/services/reservationForm.js`
- `src/components/CarDetailSection.jsx`
- `server/booking-core/guestBookingUtils.js` 또는 별도 공통 helper
- `api/payments/[action].js`

### 종료 조건
- `driverAge=21` 조건에서 만 21세 미만 예약자가 결제 준비 단계에서 차단된다.
- `driverAge=26` 조건에서 만 26세 미만 예약자가 결제 준비 단계에서 차단된다.
- 프론트와 서버의 계산 기준일이 모두 대여 시작일로 일치한다.
- `npm run build`, `npm run test:zzimcar-sync` 통과.

---

## 후속 이슈 후보. 딜리버리 비용 관리자 관리 화면

### 배경
현재 딜리버리 배송비는 `public.delivery_regions.round_trip_price` 기준으로 관리되고, 프론트에는 `company.deliveryCostList` 로 변환되어 노출된다.

### 정책 결정
- 딜리버리 배송비는 더 이상 외부 json/sync script 로 갱신하지 않는다.
- 공식 수정 경로는 관리자 페이지 + 관리자 API 로 전환한다.
- `delivery_regions` 테이블과 기존 데이터는 유지한다.
- 폐기 대상은 sync 입력/실행 경로다.
  - `scripts/sync-delivery-regions.js`
  - `supabase/reference/delivery-cost-list.json`

### 현재 관리 지점
- DB 테이블: `delivery_regions`
- 조회: `server/search-db/repositories/fetchDeliveryRegions.js`
- 변환: `server/search-db/transformers/mapDeliveryRegionsToCompany.js`
- 가격 반영: `server/search-db/pricing/buildAppliedGroupPricing.js`

### 다음 구현 기준
- 관리자 페이지는 가격 허브와 분리한다.
  - 신규 route: `/admin/delivery-regions`
  - 신규 page: `src/pages/AdminDeliveryRegionsPage.jsx`
- API 파일은 새로 만들지 않는다.
  - 기존 `api/admin/pricing-hub.js` 에 배송비 action 을 추가한다.
  - 이유: serverless/API 파일 개수 제한을 피한다.
- 프론트 API 호출도 기존 `src/services/adminPricingHubApi.js` 에 함수만 추가한다.
- 관리자 메뉴에 딜리버리 비용 관리 진입점을 추가한다.
- 수정 가능 항목은 우선 `round_trip_price`, `active` 로 제한한다.
- 지역 식별자(`province_id`, `city_id`, `dong_id`)는 관리자 화면에서 수정하지 않는다.
- 금액은 0 이상의 정수로 검증한다.
- 변경 성공 후 검색/상세 가격 계산에 반영되는지 확인한다.

### 종료 조건 후보
- 관리자 권한으로 배송비 목록 조회/검색이 가능하다.
- 지역별 왕복 배송비와 active 상태 수정이 가능하다.
- 수정 후 검색/상세 화면 가격 계산에 반영된다.
- 폐기 대상 sync 파일이 제거된다.
- `npm run build`, 관련 API 테스트 또는 최소 수동 검증 기준이 통과된다.

---

## 완료로 넘긴 항목
- pricing hub admin legacy percent 정리 current 는 past 로 이동했다.
- 최종 완료 내용은 `docs/complete/2026-05-14_RENTCAR00_PRICING_HUB_ADMIN_COMPLETE.md` 에 통합한다.

## 한 줄 결론
현재 active 기준은 **예약 상세 UI 정리, pricing hub 카드 순서, 회원/비회원 예약 경계, 운전자 연령 검증, 후속 딜리버리 비용 관리자 관리 화면**이다.
