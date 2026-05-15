# 2026-05-15 RENTCAR00 SAVE CONTRACT CURRENT

## 문서 상태
- 상태: current
- 목적: RENTCAR00 저장/수정/동기화 경로의 공식 저장 계약을 잠근다.
- 범위: 예약, 회원, OTP, 차량, IMS sync, 찜카 sync, 가격 허브, 배송비, 관리자 저장 API.
- 기준: 실제 코드, Supabase migration, 현재 active runtime 해석을 우선한다.

이 문서는 기능 기획 문서가 아니라 **저장 계약서**다.
새 저장/수정 코드는 이 문서의 truth, projection, snapshot, nullable, status 계약을 먼저 확인해야 한다.

---

## 0. 전체 원칙

### 0-1. 저장 계층 구분
RENTCAR00 데이터는 아래 계층을 반드시 구분한다.

1. **원장 truth**
   - 고객/예약/운영 판단의 최종 기준이 되는 로컬 데이터.
2. **snapshot**
   - 특정 시점의 가격/고객 입력/차량 표시값을 보존하는 데이터.
   - 이후 정책 변경으로 덮어쓰지 않는다.
3. **projection / read model**
   - 외부 시스템 또는 계산 결과를 읽기 좋게 적재한 캐시성 데이터.
   - 원장처럼 수정하거나 덮어쓰면 안 된다.
4. **sync log**
   - 실행 이력, 실패, 재시도 판단용 데이터.
5. **derived values**
   - 입력 truth에서 계산된 값.
   - DB 제약상 저장하더라도 입력 원장으로 해석하지 않는다.

### 0-2. DB 제약과 API payload는 항상 같이 본다
아래 중 하나라도 바뀌면 나머지도 같이 확인한다.

- migration의 `not null`, `check`, `unique`, FK
- API request payload
- 서버 normalize/compute 함수
- 프론트 저장 버튼 payload
- view fallback / search 반영 경로

### 0-3. raw DB 오류를 운영자에게 그대로 노출하지 않는다
DB constraint 오류는 사용자/운영자에게 그대로 보여주지 않는다.
서버는 내부 error code와 운영자용 메시지를 분리해야 한다.

예:
- 금지: `null value in column "fee_1h" violates not-null constraint`
- 권장: `정책 저장 실패: 1시간 요금 계산값이 누락되었습니다.`

---

## 1. 예약 원장 계약

### 1-1. 원장 테이블
예약 원장은 `booking_orders` 다.

`ims_sync_reservations` 는 예약 원장이 아니다.
`reservation_mappings` 도 예약 원장이 아니다.

### 1-2. 주요 저장 경로
- 생성: `server/booking-core/guestBookingService.js`
  - `createGuestBooking()`
  - 저장 대상:
    - `booking_orders`
    - `booking_lookup_keys`
    - `reservation_status_events`
- 수정:
  - 예약 취소
  - 환불 완료
  - 회원 가입 후 비회원 예약 귀속

### 1-3. `booking_orders` 필수 계약
DB 기준 필수 컬럼:

- `public_reservation_code`: not null, unique
- `booking_channel`: not null, enum
- `customer_name`: not null
- `customer_phone`: not null
- `customer_phone_last4`: not null, length 4
- `car_id`: not null, `cars.id` UUID FK
- `pickup_at`: not null
- `return_at`: not null, `return_at > pickup_at`
- `pickup_method`: not null, enum
- `quoted_total_amount`: not null, `>= 0`
- `payment_provider`: not null
- `payment_reference_id`: not null
- `booking_status`: not null, enum
- `payment_status`: not null, enum
- `sync_status`: not null, enum
- `manual_review_required`: not null default false

### 1-4. 예약 상태 계약
현재 단순화 후 홈페이지 원장 기준:

- `booking_status`
  - `confirmed`
  - `cancelled`
- `payment_status`
  - `paid`
  - `refund_pending`
  - `refunded`

과거 상태(`confirmed_pending_sync`, `in_use`, `completed`, `manual_review_required`)는 현재 active 원장 상태로 재도입하지 않는다.
재도입이 필요하면 DB check, availability blocking, 관리자 UI, 문서를 함께 변경해야 한다.

### 1-5. 예약 금액 truth
예약 확정 금액의 truth는 아래다.

- `booking_orders.quoted_total_amount`
- `booking_orders.pricing_snapshot`

검색 가격, 가격 허브 정책, 배송비 정책이 나중에 바뀌어도 기존 예약 금액을 자동 덮어쓰지 않는다.
예약 시점 금액은 snapshot으로 보존한다.

### 1-6. 예약 snapshot 계약
`pricing_snapshot` 은 예약 당시 표시/계산 근거 보존용이다.
현재 저장 후보:

- `carName`
- `carNumber`
- `quotedTotalAmount`
- `rentalAmount`
- `insuranceAmount`
- `deliveryAmount`
- `finalAmount`
- `paymentMethod`
- `customerBirth`

snapshot은 검색 계산용 truth가 아니다.
단, 고객/관리자에게 예약 당시 금액을 설명하는 기준이다.

### 1-7. 예약 lookup 계약
`booking_lookup_keys` 는 비회원 예약조회와 회원 귀속을 위한 보조 인덱스다.

- `booking_order_id`: not null FK
- `lookup_type`: not null
- `lookup_value_hash`: not null
- `lookup_value_last4`: nullable, 있으면 length 4
- unique: `(booking_order_id, lookup_type)`

전화번호/생년월일 원문을 lookup key에 평문으로 추가 저장하지 않는다.

---

## 2. 차량 식별자 계약

### 2-1. 핵심 원칙
차량 식별자는 절대 혼용하지 않는다.

| 위치 | 의미 |
|---|---|
| `cars.id` | 로컬 DB UUID |
| `cars.source_car_id` | 외부/IMS 차량 id |
| `booking_orders.car_id` | `cars.id` UUID |
| `ims_sync_reservations.car_id` | IMS/source 차량 id 성격의 text |
| `zzimcar_disable_time_sync_mappings.zzimcar_vehicle_pid` | 찜카 vehicle pid |

### 2-2. 예약 저장 시 차량 기준
예약 생성은 `bookingInput.carId` 로 `cars.source_car_id` 기준 차량을 찾고,
저장 시 `booking_orders.car_id = cars.id` 로 저장한다.

### 2-3. availability 차단 시 차량 기준
가용성 차단은 두 기준을 모두 사용한다.

- 로컬 예약 차단:
  - `booking_orders.car_id = cars.id`
- IMS sync 차단:
  - `ims_sync_reservations.car_id = cars.source_car_id`

둘 중 하나만 보면 안 된다.

---

## 3. 가용성 차단 계약

### 3-1. 차단 데이터 소스
검색/예약 차단은 두 축이다.

1. `booking_orders`
   - 자사 플랫폼 예약 원장
2. `ims_sync_reservations`
   - IMS 외부 예약 projection

### 3-2. local booking blocking status
현재 코드 기준:

```js
BOOKING_ORDER_BLOCKING_STATUSES = ['confirmed']
```

즉 `cancelled` 는 차단하지 않는다.
상태 enum을 늘리거나 차단 상태를 바꾸려면 아래를 함께 변경해야 한다.

- `bookingAvailabilityService.js`
- `fetchBlockingBookingOrders.js`
- `booking_orders` DB check
- 관리자 예약 상태 UI
- 이 문서

### 3-3. IMS reservation blocking status
`ims_sync_reservations` 는 `server/search-db/helpers/statusRules.js` 의 blocking 규칙을 따른다.
문서/코드가 충돌하면 현재 runtime 코드를 우선 확인한다.

### 3-4. 기간 겹침 기준
공통 겹침 조건:

```sql
existing.start_at < requested_end
and existing.end_at > requested_start
```

로컬 예약은 `pickup_at`, `return_at` 을 사용한다.
IMS projection은 `start_at`, `end_at` 을 사용한다.

---

## 4. 회원/프로필 저장 계약

### 4-1. 원장 테이블
회원 프로필 원장은 `profiles` 다.
Supabase Auth의 `auth.users` 는 인증 원장이고, 서비스 프로필 원장은 `profiles` 로 본다.

### 4-2. 주요 저장 경로
- `api/auth/[action].js`
  - 회원가입 시 `profiles.upsert`
- `server/auth/ensureProfileForUser.js`
  - 로그인/세션 확인 시 `profiles.upsert`

### 4-3. `profiles` 필수 계약
- `id`: `auth.users.id`, PK/FK
- `phone`: canonical phone, unique where not null
- `phone_verified`: boolean not null default false
- `profile_status`: enum
  - `incomplete`
  - `phone_unverified`
  - `active`
  - `blocked`
  - `withdrawn`

### 4-4. 전화번호 canonical 계약
아래 모든 위치는 같은 정규화 규칙을 써야 한다.

- `profiles.phone`
- `phone_verifications.phone`
- `booking_orders.customer_phone`
- `booking_lookup_keys` hash 입력값

정규화 함수 기준:

- `server/auth/phoneOtp.js::normalizePhoneNumber()`
- 숫자만 남김
- `82` 로 시작하면 국내형 `0...` 으로 변환
- 모바일 검증은 `^01\d{8,9}$`

전화번호 정규화 로직을 새로 만들지 않는다.
공통 함수를 사용하거나 같은 규칙임을 테스트로 보장한다.

### 4-5. 회원 귀속 계약
비회원 예약을 회원에게 붙일 때는 전화번호 평문 비교만으로 판단하지 않는다.
`booking_lookup_keys` hash와 canonical phone 기준을 함께 본다.

---

## 5. OTP / 전화 인증 저장 계약

### 5-1. 원장 테이블
전화 인증 원장은 `phone_verifications` 다.

### 5-2. 주요 저장 경로
- `api/auth/otp/[action].js`
  - OTP 발송 시 insert
  - OTP 검증/시도/만료/차단/소비 시 update
- `api/auth/[action].js`
  - 회원가입/비밀번호 재설정 등에서 verified token 소비
- `api/guest-bookings/[action].js`
  - 비회원 예약조회/취소 인증 context에서 token 소비
- `api/payments/[action].js`
  - 결제 준비 전 전화 인증 확인/소비

### 5-3. 필수 컬럼 계약
- `phone`: canonical phone, not null
- `phone_last4`: not null
- `purpose`: not null
- `otp_code_hash`: not null
- `verification_token_hash`: nullable unique where not null
- `context_hash`: nullable, 목적별 추가 검증 키
- `status`: not null enum
- `attempt_count`: not null default 0
- `max_attempts`: not null default 5
- `cooldown_until`: not null
- `expires_at`: not null

### 5-4. 상태 전이 계약
허용 상태:

- `pending`
- `verified`
- `consumed`
- `expired`
- `blocked`

기본 전이:

```text
pending -> verified
pending -> expired
pending -> blocked
verified -> consumed
```

`consumed` token은 재사용하지 않는다.
`context_hash` 가 있는 인증은 같은 context에서만 소비한다.

### 5-5. 보안 계약
OTP 원문과 verification token 원문은 DB에 저장하지 않는다.
해시는 `PHONE_OTP_SECRET` 기반 HMAC 규칙을 따른다.

---

## 6. IMS sync projection 계약

### 6-1. 역할
`ims_sync_reservations` 는 IMS 예약 원장이 아니라 **sync-owned projection / read model** 이다.

역할:
- 외부 예약 가용성 차단
- 운영 상태 참고
- 찜카 후속 휴차 동기화 source

금지:
- 고객 예약 원장으로 사용
- 홈페이지 예약 정보를 직접 덮어쓰기
- 고객 정보/결제 상태 truth로 사용

### 6-2. 주요 테이블
- `reservation_sync_runs`: IMS sync 실행 이력
- `ims_reservations_raw`: 원본 payload 적재
- `ims_sync_reservations`: 정규화 projection
- `reservation_sync_errors`: sync 오류 이력

### 6-3. `ims_sync_reservations` 필수 계약
- `car_id`: not null, source/IMS 차량 id 성격의 text
- `status`: not null
- `start_at`: not null
- `end_at`: not null, `end_at > start_at`
- `last_synced_at`: not null
- `ims_reservation_id`: 있으면 unique

### 6-4. local 원장과의 관계
local 예약 원장(`booking_orders`)이 IMS sync projection에 의해 고객정보/결제상태/예약상태를 덮어쓰면 안 된다.
매핑이 필요하면 `reservation_mappings` 를 통해 연결한다.

---

## 7. 찜카 sync 저장 계약

### 7-1. 역할
찜카 sync는 IMS sync projection을 읽어 찜카 `disable_time` 에 판매 차단을 반영하는 후속 동기화다.

찜카 sync는 예약 원장이 아니다.
찜카 sync mapping은 외부 반영 추적 테이블이다.

### 7-2. 주요 테이블
- `zzimcar_sync_runs`
- `zzimcar_disable_time_sync_mappings`

### 7-3. `zzimcar_disable_time_sync_mappings` 계약
- `ims_reservation_id`: not null, unique
- `car_number`: not null
- `zzimcar_vehicle_pid`: not null
- `zzimcar_disable_time_pid`: nullable
- `start_at`: not null
- `end_at`: not null, `end_at > start_at`
- `sync_status`: enum
  - `active`
  - `deleted`
  - `sync_failed`
  - `delete_failed`
- `last_error`: nullable

### 7-4. 찜카 차량 pid 계약
`zzimcar_vehicle_pid` 는 찜카 관리자 차량 pid다.
`cars.id`, `cars.source_car_id`, `ims_sync_reservations.car_id` 와 혼용하지 않는다.

### 7-5. 실패 처리 계약
차량 미존재, disable_time 생성 실패 등은 mapping/run에 실패로 기록한다.
단일 실패가 전체 sync 프로세스 사망과 같은 뜻은 아니다.
`failed_count`, `error_summary` 로 운영자가 확인할 수 있어야 한다.

---

## 8. 가격 허브 저장 계약

### 8-1. 역할 구분
가격 관련 저장 구조는 legacy와 hub가 공존한다.

- `price_policies`: legacy baseline / 정책 원본 성격
- `price_policy_groups`: 차량그룹 ↔ 가격정책 연결 truth
- `pricing_hub_periods`: 정책별 적용 기간
- `pricing_hub_rates`: 계산 결과 보존 / 검색 view 입력
- `v_search_pricing_hub_policies`: 검색 가격 조회 truth view

### 8-2. admin 입력 truth
관리자가 직접 수정하는 truth는 아래다.

- `base24h`
- `weekdayPercent`
- `weekendPercent`
- `pricingOptionType`
- `active`
- `pricePolicyId` 연결

`pricingOptionType` 의 저장 truth는 `price_policy_groups.pricing_option_type` 이다.
정책 수정 화면의 preview option type은 저장값이 아니라 미리보기용일 수 있다.

### 8-3. editor state truth
가격 편집 상태는 `pricing_hub_rates.metadata` 에 보존한다.

- `metadata.base24h`
- `metadata.weekdayPercent`
- `metadata.weekendPercent`
- `metadata.pricingOptionType` 또는 연결 row의 option type

`price_policies.weekday_rate_percent`, `price_policies.weekend_rate_percent` 는 제거 완료된 legacy percent로 본다.
새 fallback으로 되살리지 않는다.

### 8-4. `pricing_hub_rates` 컬럼 계약
DB 기준 not null:

- `pricing_hub_period_id`
- `rate_scope`
- `fee_6h`
- `fee_12h`
- `fee_24h`
- `fee_1h`
- `metadata`

따라서 저장 API는 `fee_1h` 에 null을 넣으면 안 된다.
정책 단독 저장이어도 `fee_1h` 는 계산값을 저장한다.

nullable 허용:

- `discount_percent`
- `discount_amount`
- `week_1_price`
- `week_2_price`
- `month_1_price`
- `long_24h_price`
- `long_1h_price`
- `weekend_days`

단, nullable이라고 해서 운영 의미가 없는 것은 아니다.
검색 view에서 fallback이 섞일 수 있으므로 어떤 nullable을 허용할지 phase별로 명시해야 한다.

### 8-5. 장기 요금 의미 고정
현재 기준:

- `week_1_price` = 7일
- `week_2_price` = 14일
- `month_1_price` = 30일

`week_2_price` 를 15일 등 다른 의미로 재해석하지 않는다.
의미 변경이 필요하면 컬럼명/문서/계산식/view/UI를 함께 바꾼다.

### 8-6. rate scope 계약
현재 저장 scope:

- `common`
- `weekday`
- `weekend`

`common.fee_24h` 는 `base24h` 기준이다.
`weekday.fee_24h`, `weekend.fee_24h` 는 비율 적용 결과다.

### 8-7. 검색 가격 truth
검색 가격 조회는 `v_search_pricing_hub_policies` 를 기준으로 한다.
단, view 내부에 legacy fallback이 남아 있으면 운영자는 이를 인지해야 한다.

허브 완전 전환 전까지 fallback 허용 범위를 별도 phase에서 잠가야 한다.

### 8-8. 금지 사례
아래는 금지한다.

```js
fee_1h: policyOnlySave ? null : item.values.fee1h
```

`fee_1h` 는 DB not null이므로 항상 계산값 또는 0 이상의 명시값이어야 한다.

---

## 9. 배송비 저장 계약

### 9-1. truth 테이블
배송비 truth는 `delivery_regions.round_trip_price` 다.

### 9-2. 주요 컬럼
- `province_id`: not null
- `province_name`: not null
- `city_id`: not null
- `city_name`: not null
- `dong_id`: not null, unique
- `dong_name`: not null
- `full_label`: not null
- `round_trip_price`: not null default 0
- `active`: not null default true
- `metadata`: not null default `{}`

### 9-3. 운영 계약
배송비 수정의 공식 경로는 관리자 페이지와 관리자 API 다.
외부 json/sync script 기반 갱신은 폐기한다.

관리자 저장 계약:
- 관리자 권한 인증을 통과해야 한다.
- 관리자 UI 는 가격 허브와 별도 페이지(`/admin/delivery-regions`)로 둔다.
- API 파일은 신규 생성하지 않고 기존 `api/admin/pricing-hub.js` 에 action 을 추가한다.
- 프론트 서비스는 기존 `src/services/adminPricingHubApi.js` 에 함수만 추가한다.
- `round_trip_price` 는 0 이상의 정수만 허용한다.
- `active` 는 boolean 으로 저장한다.
- `province_id`, `city_id`, `dong_id` 는 지역 식별자이므로 관리자 화면에서 수정하지 않는다.
- `dong_id` 는 unique 기준이며 지역 row 식별에 사용한다.
- 저장 후 검색/상세 가격 계산은 `delivery_regions.round_trip_price` 를 즉시 참조한다.

폐기 대상:
- `scripts/sync-delivery-regions.js`
- `supabase/reference/delivery-cost-list.json`

보존 대상:
- `delivery_regions` 테이블
- 기존 운영 데이터
- 초기 환경 재구축에 필요한 migration 이력

---

## 10. 관리자 API 저장 계약

### 10-1. admin pricing hub
파일:
- `api/admin/pricing-hub.js`
- `src/services/adminPricingHubApi.js`
- `src/pages/AdminPricingHubPage.jsx`

저장 action:
- `save-group-setting`
- `save-editor`
- `save-period`
- `save-rate`

배송비 action:
- `list-delivery-regions`
- `save-delivery-region`

계약:
- 프론트 payload 이름과 서버 body normalize 이름을 문서 기준에 맞춘다.
- 서버에서 DB not null 컬럼에 null을 넣지 않는다.
- DB raw error를 그대로 UI에 보여주지 않는다.

### 10-2. admin bookings
관리자 예약 API는 조회 중심이다.
상태 변경/확인/취소 기능을 추가할 경우 `booking_orders` 상태 계약을 먼저 업데이트해야 한다.

---

## 11. 코드 변경 전 체크리스트
저장/수정 코드를 바꾸기 전 아래를 확인한다.

1. 이 값은 truth인가, snapshot인가, projection인가?
2. 저장 대상 테이블의 not null/check/unique/FK는 무엇인가?
3. 프론트 payload 이름과 서버 body 이름이 일치하는가?
4. 서버 normalize 결과가 DB 제약을 만족하는가?
5. null 허용 컬럼인가? null이 의미 있는가?
6. enum/status 값이 DB check와 코드 상수에 모두 존재하는가?
7. 저장 실패 시 raw DB error가 사용자에게 노출되지 않는가?
8. 외부 sync projection을 local 원장처럼 수정하지 않는가?
9. 예약 snapshot을 최신 정책값으로 덮어쓰지 않는가?
10. 변경 후 build/test/API 검증 방법이 있는가?

---

## 12. 현재 확인된 불일치 / 점검 후보

### 12-1. 확정 불일치
#### pricing hub `fee_1h` null 저장
- DB: `pricing_hub_rates.fee_1h not null`
- API: 정책 단독 저장 시 `null` 저장 가능
- 영향: 정책 저장 실패
- 수정 방향: `fee_1h` 는 항상 계산값 저장

### 12-2. 점검 후보
#### 가격 hub nullable fallback
- `week_1_price`, `week_2_price`, `month_1_price` 는 nullable
- view fallback이 섞일 수 있음
- 허브 완전 전환 기준을 별도 잠금 필요

#### phone normalize 일관성
- 회원/OTP/예약/lookup hash가 같은 normalize 규칙을 쓰는지 테스트 필요

#### delivery region 운영 수정 경로
- 현재는 seed/script 중심
- admin 수정 기능 도입 전 정책 필요

#### status enum 확장 위험
- `booking_orders` 상태를 늘리면 availability 차단 규칙과 함께 바꿔야 함

---

## 13. 참조 파일

### 정책/완료 문서
- `docs/policies/RENTCAR00_POLICY.md`
- `docs/policies/RENTCAR00_PRICING_HUB.md`
- `docs/complete/2026-05-14_RENTCAR00_PRICING_HUB_ADMIN_COMPLETE.md`
- `docs/complete/2026-05-14_RENTCAR00_AUTH_AND_GUEST_FLOW_COMPLETE.md`

### 핵심 코드
- `server/booking-core/guestBookingService.js`
- `server/booking-core/bookingAvailabilityService.js`
- `server/auth/phoneOtp.js`
- `server/auth/ensureProfileForUser.js`
- `api/auth/[action].js`
- `api/auth/otp/[action].js`
- `api/guest-bookings/[action].js`
- `api/payments/[action].js`
- `api/admin/pricing-hub.js`
- `src/pages/AdminPricingHubPage.jsx`
- `src/services/adminPricingHubApi.js`

### 핵심 migration
- `supabase/migrations/20260414000000_create_cars.sql`
- `supabase/migrations/20260414195200_create_ims_sync_tables.sql`
- `supabase/migrations/20260415160000_create_delivery_regions.sql`
- `supabase/migrations/20260415170000_create_group_based_pricing_tables.sql`
- `supabase/migrations/20260421214000_create_booking_core_tables.sql`
- `supabase/migrations/20260421214500_create_booking_core_support_tables.sql`
- `supabase/migrations/20260425175500_add_signup_phone_verification.sql`
- `supabase/migrations/20260428134000_phone_first_auth_transition.sql`
- `supabase/migrations/20260428170000_add_phone_verification_context_hash.sql`
- `supabase/migrations/20260429195500_create_pricing_hub_tables.sql`
- `supabase/migrations/20260511215500_simplify_booking_order_statuses.sql`
- `supabase/migrations/20260514231500_drop_price_policy_legacy_percents.sql`

---

## 한 줄 결론
RENTCAR00의 저장 기준은 **예약 원장 `booking_orders`, 회원 원장 `profiles`, OTP 원장 `phone_verifications`, 차량 기준 `cars`, 외부 예약 projection `ims_sync_reservations`, 찜카 반영 추적 `zzimcar_disable_time_sync_mappings`, 가격 계산 보존 `pricing_hub_rates`, 배송비 truth `delivery_regions`** 로 분리한다.  
어떤 저장 코드도 이 계층을 섞거나 DB 제약과 다른 payload를 보내면 안 된다.
