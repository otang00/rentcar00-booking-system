# 2026-05-16 RENTCAR00 CURRENT

## 문서 상태
- 상태: active current
- 목적: KCP 운영 결제 검증의 현재 blocker와 다음 세션 인수인계 기준을 잠근다.
- 범위: NHN KCP 운영 결제창 진입/복귀, DB 오염 여부, 다음 조치.

## 현재 결론
현재 결제 실패는 홈페이지 서버 로직이나 DB 저장 단계 문제가 아니라, **KCP 상점 ALRFN의 승인 가능 상태값 문제로 보는 것이 맞다.**

KCP 결제창에서 아래 오류가 발생했다.

```text
상점 승인가능 상태값 확인후 결제 바랍니다.
KCP 전화 1544-8660
```

## 확인된 런타임 흐름
Vercel production 로그 기준 결제 시도 흐름은 아래와 같았다.

```text
23:26:25 POST /api/payments/prepare
23:27:10 POST /api/payments/return
```

해석:

```text
1. 홈페이지 서버의 결제 준비 API는 호출됨
2. KCP 결제창 단계로 넘어감
3. KCP가 실패 res_cd/res_msg로 /api/payments/return 호출
4. 서버는 실패 메시지를 /reservation-complete?paymentError=... 로 전달
5. KCP approve API는 호출되지 않음
6. booking_orders 생성 단계까지 가지 않음
```

중요:

```text
KCP_CERT_INFO는 approve API 호출 때 사용된다.
이번 실패는 approve API 이전의 KCP 결제창/상점 상태 단계에서 발생했다.
따라서 현재 오류만 놓고 보면 신규 인증서가 쓰이기도 전에 막힌 상태다.
```

## DB 오염 확인
문제 발생 직후 production DB를 read-only로 확인한 결과, 23:20 이후 아래 생성/소비는 없었다.

```text
booking_orders 생성: 0
booking_lookup_keys 생성: 0
reservation_status_events 생성: 0
phone_verifications consumed: 0
```

결론:

```text
예약 원장 오염 없음
lookup key 오염 없음
status event 오염 없음
OTP consumed 오염 없음
rollback 불필요
```

## 현재 반영/조치 상태
민감값 자체는 문서에 남기지 않는다.

확인된 조치:

```text
KCP_SITE_KEY 운영값 교체 완료
KCP_CERT_INFO 신규 인증서 계열로 교체 완료
KCP_MODE production 기준
production 재배포 완료
DB rollback 불필요
```

주의:

```text
.env, Vercel env, KCP 인증서/키 값은 protected target이다.
새 세션은 값 자체를 문서/로그/채팅에 노출하지 말 것.
```

## KCP에 문의할 내용
KCP에 아래 내용으로 문의한다.

```text
상점코드 ALRFN 운영 결제 테스트 중입니다.

오류 메시지:
“상점 승인가능 상태값 확인후 결제 바랍니다.
KCP 전화 1544-8660”

확인 요청:
1. ALRFN 상점이 카드 승인 가능 상태인지
2. 카드사 심사/오픈이 완료됐는지
3. 운영 결제 승인 가능한 상태인지
4. ALRFN 운영 상점의 승인가능 상태값을 KCP 쪽에서 열어야 하는지
5. 현재 서비스 인증서/상점키 조합이 ALRFN 운영용으로 정상 연결되어 있는지
6. production endpoint로 호출 가능한 상태인지
7. 해당 오류의 정확한 res_cd와 KCP 내부 원인
```

## 다음 세션 작업 순서

### Step 1. KCP 답변 수신
KCP가 상점 상태를 열어주거나, 별도 값/절차를 안내하는지 확인한다.

### Step 2. 필요 시 환경값 점검
KCP가 값 불일치를 말할 때만 아래를 별도 승인 받고 점검한다.

```text
KCP_SITE_CD
KCP_SITE_KEY
KCP_CERT_INFO
KCP_MODE
KCP_PAYMENT_SESSION_SECRET
Vercel production env
```

### Step 3. 재검증
상점 상태 변경 후 production에서 소액 결제를 다시 시도한다.

검증 기준:

```text
/api/payments/prepare 성공
KCP 결제창 결제 가능
/api/payments/return으로 enc_data/enc_info 복귀
approve API res_cd=0000
booking_orders 1건 생성
reservation-complete 정상 표시
중복 승인/중복 예약 방어 유지
```

### Step 4. 실패 시 분기
다시 실패하면 아래 순서로 본다.

```text
1. KCP res_cd/res_msg
2. /api/payments/return payload shape
3. approve API 호출 여부
4. KCP_CERT_INFO 사용 단계 도달 여부
5. booking_orders 생성 여부
```

## 관련 코드

```text
api/payments/[action].js
server/payments/kcpClient.js
server/payments/kcpConfig.js
src/components/CarDetailSection.jsx
src/services/guestBookingApi.js
src/pages/ReservationCompletePage.jsx
```

## 관련 과거 문서

```text
docs/past/present-history/2026-05-11_RENTCAR00_KCP_PHASE1_CURRENT_PAST.md
docs/past/present-history/2026-05-12_RENTCAR00_KCP_PC_MOBILE_SPLIT_CURRENT_PAST.md
```

## 한 줄 결론
현재 active 기준은 **홈페이지 결제 구현이 아니라 KCP ALRFN 상점의 운영 카드 승인 가능 상태 확인**이다.

---

## 2026-05-18 추가 작업: 고객 SMS / 운영자 이메일 / KCP 표시명

### 목적
- KCP 결제창 표시명을 `빵빵카(주)` 기준으로 맞춘다.
- 운영자 전용 예약 이메일에는 전화번호와 생년월일을 전체 표시한다.
- 결제 성공 후 고객에게 Solapi 예약확정 SMS를 발송한다.
- 카카오 알림톡은 채널/pfId/템플릿 승인 후 다음 phase로 분리한다.

### 구현 기준
- Mobile KCP payload: `shop_name = 빵빵카(주)`
- PC KCP payload: `site_name`, `kcp_pay_title = 빵빵카(주)`
- 운영자 이메일은 `BOOKING_EMAIL_TO` 전용으로 보고 고객 전화번호/생년월일 전체를 표시한다.
- 고객 SMS는 결제 승인 및 예약 생성 성공 후 발송한다.
- SMS 실패는 예약/결제 성공을 롤백하지 않고 `reservation_status_events`에 기록한다.
- 회원 예약은 `https://rentcar00.com/reservations`, 비회원 예약은 `https://rentcar00.com/guest-bookings` 링크를 보낸다.
- 문의번호 기본값은 `02-592-0079`이며 필요 시 `BOOKING_CUSTOMER_SMS_CONTACT` env로 덮어쓸 수 있다.

### 고객 SMS 문구
```text
[빵빵카(주)] 예약이 확정되었습니다.
예약번호: {예약번호}
차량: {차량명}
대여: {대여일시}
반납: {반납일시}
금액: {금액}

예약 조회:
{회원/비회원별 링크}

문의: 02-592-0079
```

### 남은 리스크
- 카드 승인 문자에 표시되는 `렌터카_2`가 계속 나오면 코드 파라미터가 아니라 KCP/카드사 가맹점 등록명 수정이 필요하다.
- 카카오 알림톡은 `SOLAPI_KAKAO_PF_ID`, `SOLAPI_KAKAO_BOOKING_TEMPLATE_ID`, 승인 템플릿 확정 후 별도 phase로 구현한다.

---

## 2026-05-19 Landing V2 삭제

사용자 판단에 따라 `/landing-v2` 실험 페이지는 운영 후보에서 제외하고 코드/라우트/전용 CSS/전용 hero 이미지를 제거한다. 기존 운영 메인 `/` 구조는 유지한다.

### Landing V2 재생성 기준
- 사용자 요청에 따라 `/landing-v2`를 다시 생성한다.
- 범위는 최소화한다: 고정 hero 사진 + 처음 제안 문구 + 기존 검색 박스 + 화면 하단 floating 검색 버튼 + 예약 방법 모달만 포함한다.
- 추천차량/흐름도/과한 버튼 실험은 제외한다.
- 버튼 색감은 후보 1번 차분한 스카이 블루를 기준으로 한다.

---

## 2026-05-19 가격 허브 장기요금 정리

사용자 판단에 따라 관리자 가격 허브에서 계산/저장되는 장기 기준 금액 중 `7일 / 14일 / 30일` 금액만 만원 단위 내림으로 정리한다.

### 반영 기준
- `week_1_price` = 7일 금액, 만원 단위 내림
- `week_2_price` = 14일 금액, 만원 단위 내림
- `month_1_price` = 30일 금액, 만원 단위 내림
- 1시간/6시간/12시간/24시간/평일/주말 요금은 기존 천원 단위 올림 기준을 유지한다.

### 2026-05-20 30일 요율 조정
사용자 판단에 따라 30일 금액 배수를 아래로 조정한다.

- 기본: `base24h × 10.5` → `base24h × 9.0`
- 세미프리미엄: `base24h × 12.0` → `base24h × 11.0`
- 프리미엄: `base24h × 14.0` 유지
- 단일 등급으로만 연결된 활성 `pricing_hub_rates.month_1_price` 저장값은 같은 기준으로 갱신한다.
- 하나의 `price_policy_id`가 기본/세미/프리미엄 여러 등급 차량에 공유된 경우, `pricing_hub_rates`가 정책 단위 저장이라 등급별 30일 금액을 동시에 다르게 저장할 수 없다. 이 경우 무리하게 반영하지 않고 기존값을 유지하며, 정책 분리 또는 저장 구조 변경을 별도 phase로 처리한다.

### 관련 코드
- `src/pages/AdminPricingHubPage.jsx`
- `api/admin/pricing-hub.js`
- `supabase/migrations/20260520173000_update_month1_pricing_multipliers.sql`

### 2026-05-20 가격정책 등급 truth 위치 개편 준비

#### 현재 판단
- 현재 구조 문제는 `pricing_option_type` truth가 `price_policy_groups` 쪽에 있어, 같은 `price_policy_id`를 공유하는 차량들에 서로 다른 등급을 동시에 안정적으로 적용할 수 없다는 점이다.
- 최종 가격결정 단위는 차량 자체가 아니라 **차량이 연결한 가격정책**이어야 한다.
- 따라서 등급 truth는 차량/차량그룹이 아니라 **가격정책**이 가져야 한다.

#### 잠그는 목표 구조
- `price_policies`가 `pricing_option_type`을 가진다.
- `price_policy_groups`는 차량그룹 ↔ 가격정책 연결만 담당한다.
- 검색/상세/관리자 가격계산은 연결된 가격정책의 등급만 본다.
- 차량/차량그룹에서는 등급을 직접 판단하거나 저장하지 않는다.

#### 현 구조 기준 blocker
- 공유 정책 4개에 basic / semi_premium / premium 차량이 섞여 있다.
- 영향 차량 항목은 총 10개다.
- `pricing_hub_rates.month_1_price`는 정책 단위 저장이라 혼합 정책에서 등급별 30일 금액을 동시에 다르게 저장할 수 없다.

#### 공유 정책 목록
1. `셀토스`
   - `price_policy_id = aafc7052-0a7c-4845-9e8d-4d970f104b06`
   - 혼합 등급: basic + semi_premium
2. `더뉴그렌져2019`
   - `price_policy_id = 0d9dd4cd-0ce9-499c-a166-e7233b53d6cf`
   - 혼합 등급: semi_premium + premium
3. `디올뉴그렌져2.5`
   - `price_policy_id = 8d94171d-2c07-4045-b090-484cc6258242`
   - 혼합 등급: semi_premium + premium
4. `G80 요금표`
   - `price_policy_id = e88f3fb0-aca6-440a-820d-55524e21aa83`
   - 혼합 등급: semi_premium + premium

#### 실행 작업표
##### Phase 1. 스키마 truth 이동
목적:
- `pricing_option_type` truth를 `price_policy_groups`에서 `price_policies`로 이동한다.

종료 조건:
- `price_policies.pricing_option_type` 추가
- 기존 `price_policy_groups.pricing_option_type`는 호환용으로만 남기거나 미사용 처리
- 정책별 등급 이관 기준 확정

##### Phase 2. 혼합 정책 분리 설계 및 데이터 이관
목적:
- 혼합 정책 4개를 등급별 정책으로 분리한다.

종료 조건:
- 어떤 차량그룹이 어떤 신규 정책으로 이동하는지 매핑표 확정
- 기존 정책/신규 정책/차량 연결 스냅샷 확보
- 가격 허브 active period / common rate 복제 기준 확정

##### Phase 3. 조회 view 교체
목적:
- 가격 조회가 정책 등급 truth만 보게 한다.

종료 조건:
- `v_pricing_hub_policy_editor`가 `price_policies.pricing_option_type` 기준으로 동작
- `v_search_pricing_hub_policies`가 `price_policies.pricing_option_type` 기준으로 동작
- `price_policy_groups.pricing_option_type` 의존 제거

##### Phase 4. 관리자 API 연동 수정
목적:
- 차량 연결 저장과 정책 저장의 책임을 분리한다.

종료 조건:
- `handleSaveGroupSetting()` 에서 `pricingOptionType` 저장 제거
- `handleSaveEditor()` 가 정책 등급만 저장
- `pricePolicyGroupId`는 연결 식별자로만 사용

##### Phase 5. 관리자 UI 연동 수정
목적:
- 운영자가 차량에서 등급을 고르지 못하게 한다.

종료 조건:
- 차량그룹 상세의 옵션타입 표시는 읽기 전용 정책 정보로 변경
- `연결 정책 선택` 영역의 옵션타입 선택 제거
- `정책 수정` 영역에서만 등급 편집 허용

##### Phase 6. 가격 저장값 재계산 및 검증
목적:
- basic 9.0 / semi_premium 11.0 / premium 14.0 기준으로 정책별 저장값을 다시 맞춘다.

종료 조건:
- 혼합 정책 분리 후 `pricing_hub_rates.month_1_price` 재계산
- 검색 결과 / 관리자 preview / HTML 가격표 일치
- 혼합 등급 정책 0건 확인

#### 연동 수정 체크 대상
##### DB / migration / view
- `supabase/migrations/20260415170000_create_group_based_pricing_tables.sql`
- `supabase/migrations/20260514020000_add_pricing_option_type_to_price_policy_groups.sql`
- `supabase/migrations/20260514231500_drop_price_policy_legacy_percents.sql`
- `supabase/migrations/20260520173000_update_month1_pricing_multipliers.sql`
- 신규 migration: `price_policies.pricing_option_type` 추가, 혼합 정책 분리, view 교체

##### 관리자 API
- `api/admin/pricing-hub.js`
  - `handleSaveGroupSetting()`
  - `handleSaveEditor()`
  - `buildCurrentRateSummary()`
  - `fetchEditorBase()` / `fetchPolicyBase()` 응답 shape

##### 관리자 UI
- `src/pages/AdminPricingHubPage.jsx`
  - 차량그룹 카드의 옵션 표시
  - 연결 정책 선택 패널
  - 정책 수정 패널
- `src/services/adminPricingHubApi.js`

##### 검색 가격 경로
- `server/search-db/repositories/fetchGroupPricePolicies.js`
- `server/search-db/pricing/calculateGroupPrice.js`
- 검색/상세 DTO 테스트

##### 스크립트 / 검증 산출물
- `scripts/pricing/apply-group-pricing.js`
- 검토용 HTML 가격표 재생성 산출물

#### 주요 리스크
1. 혼합 정책 분리 중 차량이 잘못된 정책에 연결되면 검색 가격 전체가 달라질 수 있다.
2. active period / pricing_hub_rates 복제 기준이 틀리면 저장값과 fallback 계산이 다시 어긋날 수 있다.
3. UI에서 차량 연결 단계 옵션타입 입력이 남아 있으면 운영자가 다시 잘못 저장할 수 있다.
4. DB만 바꾸고 API / UI / view를 같이 안 바꾸면 저장 기준과 조회 기준이 분리된다.

#### 2026-05-20 실행 결과
- migration 적용 완료: `supabase/migrations/20260520210000_move_pricing_option_type_to_price_policies.sql`
- `price_policies.pricing_option_type` 추가 및 정책 등급 truth 이동 완료
- 혼합 정책 4개는 등급별 가격정책으로 분리 완료
- `v_pricing_hub_policy_editor`, `v_search_pricing_hub_policies`는 `price_policies.pricing_option_type` 기준으로 교체 완료
- `api/admin/pricing-hub.js`는 차량 연결 저장에서 등급 저장을 제거하고, 정책 저장에서만 `pricing_option_type`을 갱신하도록 수정
- `src/pages/AdminPricingHubPage.jsx`는 차량 연결 패널에서 등급 선택을 제거하고, 정책 수정 패널에서만 등급을 바꾸도록 수정
- remote Supabase migration 적용 완료
- 검토용 HTML 가격표: `/Users/otang_server/.openclaw/workspace-rentcar00_reservation_developer/artifacts/pricing-policy-grade-final-table.html`

#### 검증 결과
- `price_policies.pricing_option_type` 조회 성공
- 동일 `price_policy_id` 내 등급 충돌: 0건
- 최종 HTML 가격표 검증 불일치/충돌: 0건
- `npm run build` 통과
- `node --test server/search-db/pricing/__tests__/*.test.js server/search-db/transformers/__tests__/*.test.js server/search-db/__tests__/*.test.js` 통과: 21개

#### 검증 기준
- 혼합 정책 4개가 등급별로 분리되었는지 확인
- `v_search_pricing_hub_policies`에서 동일 정책 내 등급 충돌 0건 확인
- 관리자 가격허브 preview와 검색 결과 7일 / 14일 / 30일 일치
- `npm run build` 통과
- 검색 가격 관련 테스트 통과
- HTML 가격표 재생성 후 운영 검토 가능 상태

#### 되돌릴 준비
- 정책 분리 전 `price_policy_groups`, `pricing_hub_periods`, `pricing_hub_rates` 스냅샷 확보
- 신규 정책 연결표 백업
- migration rollback 또는 복구 SQL 준비

---

## 2026-05-20 관리자 예약 변경 / 카카오 내부알림 준비

### 목적
고객 요청으로 발생하는 `날짜 변경` / `차종 변경` 상황에 대비하고, 예약 완료 후 관리자·직원 내부알림을 카카오 디벨로퍼 무료 API 우선으로 검증한다.

### 기준점
- 홈페이지 예약 원장은 `booking_orders` 기준이며, 상태는 `confirmed / cancelled`만 유지한다.
- 예약 변경 때문에 `booking_status` enum을 늘리지 않는다.
- 살아있는 예약 차단 상태는 기존처럼 `confirmed`만 유지한다.
- 날짜/차종 변경은 관리자 기능으로 처리하고, 변경 이력은 `reservation_status_events`에 남긴다.
- 고객 대상 카카오 알림톡은 이번 범위가 아니다.
- 관리자·직원 내부알림은 1차로 Kakao Developers `나에게 보내기`를 PoC한다.
- Solapi SMS는 카카오 실패 시 fallback 후보로 둔다.

### Phase 1. 예약 변경 정책/서버 기준 잠금
종료 조건:
- 날짜 변경 / 차종 변경의 입력값, 검증 규칙, 차액 처리 기준이 확정된다.
- 새 차량·새 기간 availability 재검증 기준이 기존 `bookingAvailabilityService.js`와 충돌하지 않는다.
- 시작된 예약 강제 변경 허용 여부가 관리자 경고 기준으로 분리된다.

### Phase 2. 관리자 예약 변경 API
종료 조건:
- 관리자만 예약 변경 API를 호출할 수 있다.
- 날짜 변경 시 `pickup_at`, `return_at`, 금액 snapshot이 갱신된다.
- 차종 변경 시 `car_id`, 차량 snapshot, 금액 snapshot이 갱신된다.
- 변경 전후 값과 차액이 `reservation_status_events`에 기록된다.
- 실패해도 기존 예약 row가 훼손되지 않는다.

### Phase 3. 관리자 예약 변경 UI
종료 조건:
- 관리자 예약 상세에서 `날짜 변경`, `차종 변경`을 실행할 수 있다.
- 변경 전 새 조건 검증 결과와 차액을 확인 후 저장한다.
- 금액 증가/감소는 자동 결제·부분환불 처리하지 않고 운영 메모/이력으로 남긴다.

### Phase 4. Kakao Developers 내부알림 PoC
종료 조건:
- Kakao REST API 키와 redirect URI 기준이 잠긴다.
- 관리자·직원이 1회 OAuth 동의로 `talk_message` 권한을 연결할 수 있다.
- refresh token 저장 방식이 확정된다.
- 예약 완료 시 `나에게 보내기` 테스트 발송이 성공하거나, 실패 사유가 기록된다.

### Phase 5. 예약 완료 내부알림 연결
종료 조건:
- 예약 완료 후 카카오 내부알림 발송을 시도한다.
- 성공/실패/스킵 결과가 `reservation_status_events`에 남는다.
- 카카오 실패 시 기존 SMS fallback 여부가 설정으로 분기된다.
- 알림 실패는 예약 생성/결제 성공을 롤백하지 않는다.

### 확인 필요
- Kakao Developers REST API 키
- redirect URI 등록 가능 여부: `https://rentcar00.com/api/kakao/oauth/callback`
- 직원별 카카오 1회 연결을 허용할지 여부
- 토큰 저장 위치: DB 테이블 추가 권장
- 카카오 `나에게 보내기`가 실제 모바일 푸시 알림을 띄우는지 실테스트 필요


### 2026-05-20 Phase 2~3 1차 구현 결과
- 관리자 예약 확인 화면에 `예약 변경` 패널 추가.
- 변경 유형: `날짜 변경`, `차종 변경`, `날짜+차종`.
- 서버 API: `POST /api/admin/bookings?action=change`.
- 변경 가능 상태: `booking_status = confirmed`만 허용.
- 이미 시작된 예약은 기본 차단, 관리자가 체크박스로 강제 변경 시도 가능.
- 변경 저장 시 서버에서 다음을 재검증한다.
  - 변경 기간 유효성
  - 변경 차량 활성 상태 및 일반대여 가능 여부
  - 홈페이지 확정 예약 충돌
  - IMS 예약 충돌
  - 그룹 가격 정책 기반 금액 재계산
- 저장 대상:
  - `booking_orders.car_id`
  - `booking_orders.pickup_at`
  - `booking_orders.return_at`
  - `booking_orders.quoted_total_amount`
  - `booking_orders.pricing_snapshot`
- 변경 이력:
  - `reservation_status_events.event_type = admin_booking_changed`
  - 기존/변경 차량, 일정, 금액, 차액, 사유 기록

### 차액 처리 기준
- 1차 구현은 차액을 자동 결제/환불하지 않는다.
- 차액은 API 응답과 이력에 남기고, 관리자가 별도 안내/정산한다.
- 자동 추가결제/부분환불은 결제사 정책 확인 후 별도 phase로 분리한다.

### 카카오 내부알림 조사 결과
- Kakao Developers `나에게 보내기`는 로그인한 사용자 본인의 `나와의 채팅`으로만 발송 가능.
- 필요 권한: 카카오 로그인, `talk_message` 동의항목, 사용자 access/refresh token.
- 공식 쿼터 기준: 카카오톡 메시지 전송 일 30,000건, 발신자당 100건, 수신자당 100건, 발신자/수신자 pair당 20건.
- 직원 알림은 직원 각자가 1회 카카오 로그인/동의 후 본인 토큰을 저장하면 `나에게 보내기` 방식으로 가능성이 있다.
- 카카오 비즈니스 메시지/알림톡/브랜드 메시지는 채널·템플릿·월렛/딜러사 비용 영역이다.
- Solapi 알림톡은 유료이지만 템플릿/대체문자/운영 UI가 있어 고객 알림 또는 안정 운영 단계에서 재검토한다.

### 남은 blocker
- Kakao REST API 키 확보.
- redirect URI 등록: `https://rentcar00.com/api/kakao/oauth/callback`.
- 직원별 1회 카카오 로그인 동의 범위 확정.
- refresh token 저장 테이블/암호화/갱신 정책 승인.
- 실제 `나와의 채팅` 푸시 알림 발생 여부 PoC.

---

## 2026-05-20 홈페이지 → OPS 앱 예약발생 송신부

### 목적
홈페이지에서 예약이 확정되면 OPS 앱 수신부로 `reservation.created` 이벤트를 송신한다.

### 구현 기준
- 송신 모듈: `server/notifications/sendOpsAppReservationEvent.js`
- outbox 모듈: `server/notifications/opsAppReservationEventOutbox.js`
- outbox 테이블: `ops_app_reservation_event_outbox`
- 호출 위치: `api/payments/[action].js`의 예약 확정 후 알림 흐름
- 결제 승인/금액 검증/예약 DB 생성 후 직접 HTTP 송신하지 않고 outbox에 `pending` 이벤트를 저장한다.
- OPS 업무 처리용 event data payload에는 `customerName`, `customerPhone` 전체, `customerBirth` 전체, `customerPhoneLast4`를 포함한다.
- 잠금화면/푸시 미리보기는 개인정보 노출을 최소화하는 별도 설계를 권장한다.
- 이벤트 ID: `reservation.created:{bookingOrderId}` deterministic 값
- 처리 스크립트: `scripts/process-ops-app-reservation-event-outbox.js`
- 서명: `HMAC-SHA256(secret, "{timestamp}.{rawBody}")`
- HTTP headers:
  - `X-Rentcar00-Event-Type`
  - `X-Rentcar00-Event-Id`
  - `X-Rentcar00-Timestamp`
  - `X-Rentcar00-Signature`
- outbox enqueue 성공 시 `ops_app_reservation_event_queued` 기록
- URL/secret 미설정 또는 timeout/비2xx/네트워크 오류는 outbox 처리 실패로 남기고 재시도 대상에 둔다.
- outbox 저장 실패도 예약/결제 성공은 롤백하지 않고 `ops_app_reservation_event_queue_failed`를 기록한다.

### 필요한 env 이름
값은 문서에 남기지 않는다.

```text
OPS_APP_RESERVATION_EVENT_URL
OPS_APP_RESERVATION_EVENT_SECRET
OPS_APP_RESERVATION_EVENT_TIMEOUT_MS
```

### 1회성 전달 문서
```text
docs/oneoff-agent-handoffs/2026-05-20_WEB_TO_OPS_APP_RESERVATION_EVENT_HANDOFF.md
```

### 검증 기준
- `node --check server/notifications/sendOpsAppReservationEvent.js`
- `node --check server/notifications/opsAppReservationEventOutbox.js`
- `node --check api/payments/[action].js`
- `node --check scripts/process-ops-app-reservation-event-outbox.js`
- `node --test server/notifications/__tests__/sendOpsAppReservationEvent.test.js server/notifications/__tests__/opsAppReservationEventOutbox.test.js`
- OPS 수신부 완료 후 preview/prod URL과 secret을 별도 안전 경로로 설정하고 통합 검증한다.
