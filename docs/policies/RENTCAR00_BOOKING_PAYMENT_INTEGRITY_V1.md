# RENTCAR00 예약·결제 무결성 정책 v1

## 문서 상태
- 상태: policy
- 작성일: 2026-05-15
- 목적: 예약/결제 생성 흐름의 무결성 기준과 단계적 안정화 계획을 잠근다.
- 범위: 예약 생성, 중복 예약 방지, 결제 승인 후 예약 생성, DB 제약, 트랜잭션/락, 멱등성, 이상 데이터 검사.
- 비범위: UI, 관리자 화면 기능 추가, 리팩토링, 대규모 API 교체, 즉시 payment ledger 구현, 즉시 exclusion constraint 적용.

## 기준 파일
현재 판단은 아래 실제 코드와 Supabase migration 기준이다.

- `api/payments/[action].js`
  - `handlePrepare()`
  - `handlePaymentApproval()`
- `api/guest-bookings/[action].js`
  - `handleCreate()`
- `server/booking-core/guestBookingService.js`
  - `createGuestBooking()`
  - `fetchBookingOrderByPaymentReference()`
  - `cancelBookingOrder()`
  - `completeRefundForBookingOrder()`
- `server/booking-core/bookingAvailabilityService.js`
  - `BOOKING_ORDER_BLOCKING_STATUSES`
  - `ensureBookingAvailability()`
  - `fetchBlockingBookingOrders()`
  - `fetchBlockingImsReservations()`
- `server/search-db/repositories/fetchCandidateCars.js`
  - `fetchCandidateCars()`
- `server/search-db/helpers/buildSearchWindow.js`
  - `buildSearchWindow()`
- `supabase/migrations/20260421214000_create_booking_core_tables.sql`
- `supabase/migrations/20260421214500_create_booking_core_support_tables.sql`
- `supabase/migrations/20260414195200_create_ims_sync_tables.sql`
- `supabase/migrations/20260511215500_simplify_booking_order_statuses.sql`

---

## 1. 예약·결제 무결성 정책 v1

### 1-1. 같은 차량 + 기간 겹침 예약 금지
같은 `booking_orders.car_id`에 대해 확정 예약 기간이 겹치는 예약은 허용하지 않는다.

기간 겹침 조건은 아래로 고정한다.

```sql
new_start < existing_end
AND new_end > existing_start
```

시간 범위 기준은 half-open interval이다.

```text
[pickup_at, return_at)
```

따라서 기존 예약의 `return_at`과 새 예약의 `pickup_at`이 같으면 겹치지 않는다.

### 1-2. 홈페이지 예약 blocking status
현재 코드 기준 홈페이지 예약 차단 상태는 아래만 사용한다.

```text
confirmed
```

관련 코드:

- `server/booking-core/bookingAvailabilityService.js`
  - `BOOKING_ORDER_BLOCKING_STATUSES = ['confirmed']`
- `server/search-db/repositories/fetchBlockingBookingOrders.js`

정책상 `booking_orders.booking_status = 'cancelled'`는 차량 점유로 보지 않는다.

### 1-3. IMS 예약 blocking status
현재 예약 생성 경로의 `server/booking-core/bookingAvailabilityService.js::fetchBlockingImsReservations()`는 `ims_sync_reservations.status` 또는 `status_raw` 필터 없이 기간 겹침만 검사한다.

```text
현재 구현: status 필터 없음
```

정책 v1에서는 IMS blocking status를 아직 임의 확정하지 않는다. 운영 데이터의 실제 `ims_sync_reservations.status`, `status_raw` 값을 먼저 조회한 뒤 확정한다.

확정 전 임시 원칙:

- `confirmed / active / in_use` 계열은 blocking 후보
- `cancelled / refunded / closed` 계열은 non-blocking 후보
- 실제 값 목록 확인 전까지 코드에 status 값을 추가하지 않는다.

### 1-4. 결제 거래번호 멱등성
같은 조합은 예약 1건만 허용한다.

```text
payment_provider + payment_reference_id
```

대상 컬럼:

- `booking_orders.payment_provider`
- `booking_orders.payment_reference_id`

현재 migration 기준 두 컬럼은 `not null`이지만 unique 제약은 없다.

정책상 동일 PG 거래번호로 중복 예약이 생성되면 안 된다.

### 1-5. 결제 성공 후 예약 생성 실패 복구 정책
KCP 승인 성공 후 `createGuestBooking()` 실패 가능성을 복구 가능한 상태로 남겨야 한다.

현재 별도 `payment_transactions`, `payment_events`, `refund_transactions` 테이블은 없다. 따라서 현재 구현 기준으로는 PG 승인 성공 후 예약 생성 실패가 DB 원장에 남지 않을 수 있다.

v1 복구 정책 목표:

1. PG 승인 성공 결과를 복구 가능한 원장에 남긴다.
2. 예약 생성 실패 사유를 남긴다.
3. 운영자가 결제건 기준으로 예약 재생성/환불 판단을 할 수 있어야 한다.
4. 동일 `payment_provider + payment_reference_id` 재처리 시 기존 결과를 반환해야 한다.

단, payment ledger 구현은 PR 5 설계 범위이며 PR 1에서는 구현하지 않는다.

### 1-6. 예약 생성 완료 기준
예약 생성은 아래 3개 저장이 모두 성공해야 완료로 본다.

1. `booking_orders` insert
2. `booking_lookup_keys` insert
3. `reservation_status_events` insert

현재 `server/booking-core/guestBookingService.js::createGuestBooking()`은 위 insert들을 별도 Supabase 요청으로 수행한다. 하나라도 실패하면 예약 생성 완료로 보면 안 된다.

향후 목표는 transaction/RPC 내부에서 atomic 처리하는 것이다.

---

## 2. 현재 코드/DB 기준 리포트

### 2-1. 예약 가능 여부 확인과 `booking_orders` insert transaction 여부
- 관련 파일: `server/booking-core/guestBookingService.js`, `server/booking-core/bookingAvailabilityService.js`
- 관련 함수: `createGuestBooking()`, `ensureBookingAvailability()`
- 관련 테이블/컬럼: `booking_orders.car_id`, `pickup_at`, `return_at`, `booking_status`
- 현재 구현: `ensureBookingAvailability()`로 겹침 조회 후 `booking_orders.insert()`를 별도 요청으로 수행한다.
- 위험 시나리오: A/B 사용자가 같은 차량/같은 기간으로 동시에 결제 승인 완료 시 둘 다 availability를 통과하고 둘 다 insert될 수 있다.
- 수정 필요 여부: 필요
- 수정 우선순위: A급
- 코드 수정 전 확인할 것: 기존 중복 예약 데이터 존재 여부, 모든 예약 생성 경로가 `createGuestBooking()`으로 모이는지, 운영 중 직접 DB insert 경로가 있는지.

### 2-2. `booking_orders`, `booking_lookup_keys`, `reservation_status_events` transaction 여부
- 관련 파일: `server/booking-core/guestBookingService.js`
- 관련 함수: `createGuestBooking()`
- 관련 테이블: `booking_orders`, `booking_lookup_keys`, `reservation_status_events`
- 현재 구현: 3개 insert가 각각 별도 Supabase 요청이다.
- 위험 시나리오: `booking_orders`는 생성됐지만 lookup key 또는 event insert 실패로 비회원 조회/감사 로그가 깨질 수 있다.
- 수정 필요 여부: 필요
- 수정 우선순위: A급
- 코드 수정 전 확인할 것: `booking_lookup_keys` 누락 데이터, `booking_created` 이벤트 누락 데이터.

### 2-3. 같은 차량/기간 중복 예약 DB 제약 여부
- 관련 migration: `20260421214000_create_booking_core_tables.sql`
- 관련 테이블/컬럼: `booking_orders.car_id`, `pickup_at`, `return_at`, `booking_status`
- 현재 구현: `(car_id, pickup_at, return_at)` index는 있으나 overlap 금지 constraint는 없다.
- 위험 시나리오: 애플리케이션 체크를 우회하거나 동시 요청이 발생하면 DB가 중복 예약을 차단하지 못한다.
- 수정 필요 여부: 필요
- 수정 우선순위: A급
- 코드 수정 전 확인할 것: 기존 overlap 데이터, advisory lock 우선 적용 가능성.

### 2-4. `payment_provider + payment_reference_id` unique 제약 여부
- 관련 migration: `20260421214000_create_booking_core_tables.sql`
- 관련 테이블/컬럼: `booking_orders.payment_provider`, `booking_orders.payment_reference_id`
- 현재 구현: 두 컬럼은 `not null`이나 unique index가 없다.
- 위험 시나리오: KCP return/approve 중복 호출이 동시에 들어오면 같은 거래번호로 예약 2건이 생길 수 있다.
- 수정 필요 여부: 필요
- 수정 우선순위: A급
- 코드 수정 전 확인할 것: 기존 중복 거래번호, 빈 문자열 데이터, unique violation 처리 방식.

### 2-5. 결제 승인 후 예약 생성 실패 기록 여부
- 관련 파일: `api/payments/[action].js`, `server/booking-core/guestBookingService.js`
- 관련 함수: `handlePaymentApproval()`, `createGuestBooking()`
- 관련 테이블/컬럼: `booking_orders.payment_provider`, `payment_reference_id`, `payment_status`
- 현재 구현: 별도 payment ledger가 없고, 예약 생성 성공 후 `reservation_status_events`에 `kcp_payment_approved` 이벤트를 남긴다.
- 위험 시나리오: KCP 승인 성공 후 예약 생성 실패 시 DB에 승인 성공 이력이 남지 않을 수 있다.
- 수정 필요 여부: 필요. 단 PR 1에서는 구현하지 않는다.
- 수정 우선순위: A급
- 코드 수정 전 확인할 것: PG 승인 로그 접근 가능성, 운영 환불/복구 절차.

### 2-6. KCP 콜백/결제 승인 중복 호출 멱등성
- 관련 파일: `api/payments/[action].js`, `server/booking-core/guestBookingService.js`
- 관련 함수: `handlePaymentApproval()`, `fetchBookingOrderByPaymentReference()`
- 관련 테이블/컬럼: `booking_orders.payment_provider`, `payment_reference_id`
- 현재 구현: 기존 예약 조회 후 있으면 기존 예약을 반환한다. DB unique가 없어 동시 호출 멱등성은 보장되지 않는다.
- 위험 시나리오: 중복 콜백 2개가 동시에 기존 예약 없음으로 판단하고 모두 insert한다.
- 수정 필요 여부: 필요
- 수정 우선순위: A급
- 코드 수정 전 확인할 것: unique index 준비, unique violation 시 기존 예약 반환 처리.

### 2-7. IMS 예약 status 필터 포함 여부
- 관련 파일: `server/booking-core/bookingAvailabilityService.js`
- 관련 함수: `fetchBlockingImsReservations()`
- 관련 테이블/컬럼: `ims_sync_reservations.car_id`, `start_at`, `end_at`, `status`, `status_raw`
- 현재 구현: `status`, `status_raw` 필터 없이 기간 겹침만 검사한다.
- 위험 시나리오: 취소/종료된 IMS 예약 projection이 남아 있으면 홈페이지 예약이 불필요하게 차단될 수 있다.
- 수정 필요 여부: 실제 IMS status 값 확인 후 판단
- 수정 우선순위: B급
- 코드 수정 전 확인할 것: `ims_sync_reservations.status`, `status_raw` distinct 값과 현재 운영상 blocking 의미.

### 2-8. 검색 시 차량 조건과 최종 예약 시 차량 조건 일치 여부
- 관련 파일: `server/search-db/repositories/fetchCandidateCars.js`, `server/booking-core/guestBookingService.js`
- 관련 함수: `fetchCandidateCars()`, `fetchCarBySourceCarId()`
- 관련 테이블/컬럼: `cars.active`, `cars.ims_can_general_rental`, `cars.source_car_id`
- 현재 구현: 검색은 `active = true`와 `ims_can_general_rental = true`를 검사한다. 최종 예약 차량 조회는 `active = true`만 검사한다.
- 위험 시나리오: 검색 후 결제 사이에 `ims_can_general_rental`이 false가 되면 최종 예약에서 막지 못할 수 있다.
- 수정 필요 여부: 필요 가능
- 수정 우선순위: B급
- 코드 수정 전 확인할 것: `ims_can_general_rental`이 예약 가능 조건으로 정책상 확정인지.

### 2-9. 빈 문자열 고객정보 DB 차단 여부
- 관련 migration: `20260421214000_create_booking_core_tables.sql`
- 관련 테이블/컬럼: `booking_orders.customer_name`, `customer_phone`, `customer_phone_last4`
- 현재 구현: `not null`과 `customer_phone_last4` 길이 check는 있으나 빈 문자열 차단 check는 없다.
- 위험 시나리오: 서버 정상 경로 외 DB 직접 입력/미래 관리자 수동 생성 경로에서 빈 문자열 예약이 생길 수 있다.
- 수정 필요 여부: 선택적 권장
- 수정 우선순위: B급
- 코드 수정 전 확인할 것: 기존 빈 문자열 데이터 존재 여부.

### 2-10. 알림 발송 중복 방지 장치 여부
- 관련 파일: `api/payments/[action].js`, `server/email/sendBookingConfirmationEmail.js`, `server/notifications/sendAdminBookingAlert.js`
- 관련 함수: `dispatchBookingCreatedNotifications()`
- 관련 테이블: `reservation_status_events`
- 현재 구현: 알림 발송 전용 idempotency key 또는 unique event 제약은 확인되지 않는다.
- 위험 시나리오: 결제 승인 중복 처리로 예약 row가 중복 생성되면 이메일/관리자 알림도 중복 발송될 수 있다.
- 수정 필요 여부: 결제 멱등성 해결 후 검토
- 수정 우선순위: B급
- 코드 수정 전 확인할 것: 알림 발송 로그/이벤트 중복 여부.

---

## 3. A/B/C 위험도 리포트

### A급: 출시 전 반드시 수정 검토

#### A1. 같은 차량/겹치는 기간 중복 예약 가능
- 문제 설명: availability 조회와 `booking_orders` insert가 transaction/lock으로 묶여 있지 않다.
- 관련 파일/함수: `guestBookingService.js::createGuestBooking()`, `bookingAvailabilityService.js::ensureBookingAvailability()`
- 관련 테이블/컬럼: `booking_orders.car_id`, `pickup_at`, `return_at`, `booking_status`
- 재현 시나리오: 동일 차량/시간으로 두 결제 승인 요청이 동시에 완료된다.
- 현재 위험도: A급
- 수정 방향: advisory lock + transaction 내부 overlap 재검사 우선 검토.
- DB 변경 필요 여부: RPC/advisory lock 설계 시 필요 가능. exclusion constraint는 후순위.
- 예상 영향 범위: 예약 생성, 결제 승인, 비회원 조회 키 생성, 이벤트 기록.

#### A2. 결제 거래번호 중복 처리 가능
- 문제 설명: `payment_provider + payment_reference_id` unique 제약이 없다.
- 관련 파일/함수: `api/payments/[action].js::handlePaymentApproval()`, `guestBookingService.js::fetchBookingOrderByPaymentReference()`
- 관련 테이블/컬럼: `booking_orders.payment_provider`, `payment_reference_id`
- 재현 시나리오: KCP 콜백/승인 요청이 동시에 중복 들어온다.
- 현재 위험도: A급
- 수정 방향: 기존 중복 검사 후 unique index 준비, unique violation 시 기존 예약 반환.
- DB 변경 필요 여부: 필요
- 예상 영향 범위: 결제 승인 멱등성, 기존 중복 데이터 정리 필요성.

#### A3. 결제 성공 후 예약 미확정 가능
- 문제 설명: KCP 승인 성공 결과를 예약 생성 전 별도 원장에 보존하지 않는다.
- 관련 파일/함수: `api/payments/[action].js::handlePaymentApproval()`, `guestBookingService.js::createGuestBooking()`
- 관련 테이블/컬럼: 현재 별도 payment 테이블 구현 없음. `booking_orders.payment_*`만 존재.
- 재현 시나리오: PG 승인 성공 후 DB insert 또는 lookup/event insert 실패.
- 현재 위험도: A급
- 수정 방향: payment ledger 설계 후 도입. 1차 범위에서는 설계만.
- DB 변경 필요 여부: 향후 필요
- 예상 영향 범위: 결제 복구, 환불 판단, 운영 대응.

#### A4. 예약 생성 중 반쪽 저장 가능
- 문제 설명: `booking_orders`, `booking_lookup_keys`, `reservation_status_events` insert가 atomic하지 않다.
- 관련 파일/함수: `guestBookingService.js::createGuestBooking()`
- 관련 테이블: `booking_orders`, `booking_lookup_keys`, `reservation_status_events`
- 재현 시나리오: 예약 row 생성 후 lookup key insert 실패.
- 현재 위험도: A급
- 수정 방향: transaction/RPC 내부에서 3개 insert를 묶는다.
- DB 변경 필요 여부: 필요 가능
- 예상 영향 범위: 비회원 조회, 예약 완료 화면, 감사 로그.

### B급: 운영 중 높은 확률로 문제 가능

#### B1. IMS status 필터 없음
- 문제 설명: `ims_sync_reservations` 기간 겹침 조회에 status 필터가 없다.
- 관련 파일/함수: `bookingAvailabilityService.js::fetchBlockingImsReservations()`
- 관련 테이블/컬럼: `ims_sync_reservations.status`, `status_raw`, `start_at`, `end_at`
- 재현 시나리오: 취소된 IMS 예약 projection이 기간 겹침으로 남아 예약을 차단한다.
- 현재 위험도: B급
- 수정 방향: 실제 IMS status 값 조회 후 blocking status 확정.
- DB 변경 필요 여부: 없음
- 예상 영향 범위: 검색/예약 가능 여부.

#### B2. 검색/최종 예약 차량 조건 불일치
- 문제 설명: 검색은 `ims_can_general_rental = true`를 보지만 최종 예약은 `active = true`만 본다.
- 관련 파일/함수: `fetchCandidateCars()`, `fetchCarBySourceCarId()`
- 관련 테이블/컬럼: `cars.active`, `cars.ims_can_general_rental`
- 재현 시나리오: 결제 사이에 `ims_can_general_rental`이 false로 바뀐다.
- 현재 위험도: B급
- 수정 방향: 최종 예약 조건에 같은 정책을 적용할지 확정.
- DB 변경 필요 여부: 없음
- 예상 영향 범위: 예약 생성 가능 차량 판정.

#### B3. 고객정보 빈 문자열 DB 차단 없음
- 문제 설명: `not null`은 있지만 `btrim(...) <> ''` check는 없다.
- 관련 migration/table: `booking_orders.customer_name`, `customer_phone`, `customer_phone_last4`
- 재현 시나리오: 서버 정상 경로 외 수동 입력에서 빈 문자열 저장.
- 현재 위험도: B급
- 수정 방향: 기존 데이터 검사 후 check constraint 검토.
- DB 변경 필요 여부: 선택적
- 예상 영향 범위: 예약 조회, 고객 식별.

#### B4. 알림 중복 방지 장치 부족
- 문제 설명: 알림 발송 전용 idempotency key가 확인되지 않는다.
- 관련 파일/함수: `api/payments/[action].js::dispatchBookingCreatedNotifications()`
- 관련 테이블: `reservation_status_events`
- 재현 시나리오: 중복 예약 생성 후 이메일/관리자 알림 중복 발송.
- 현재 위험도: B급
- 수정 방향: 먼저 결제/예약 멱등성을 해결하고, 필요 시 알림 event unique 설계.
- DB 변경 필요 여부: 선택적
- 예상 영향 범위: 고객/운영자 알림.

### C급: 후순위 개선

#### C1. 관리자 감사 로그 강화
- 문제 설명: `reservation_status_events`는 있으나 full audit log는 아니다.
- 관련 테이블: `reservation_status_events`
- 현재 위험도: C급
- 수정 방향: 관리자 수정 기능 확대 시 `admin_audit_logs` 별도 검토.
- DB 변경 필요 여부: 선택적
- 예상 영향 범위: 운영 추적성.

#### C2. payment ledger 상세 설계
- 문제 설명: 현재 payment ledger 구현 없음.
- 현재 위험도: C급. 단 결제 성공 후 예약 실패 복구 관점에서는 A급 이슈의 장기 해결책이다.
- 수정 방향: PR 5에서 설계 초안 작성, 즉시 구현하지 않음.
- DB 변경 필요 여부: 향후 필요
- 예상 영향 범위: 결제 복구, 환불 추적, PG 감사.

---

## 4. PR 2~5 진행 계획

### PR 2. `payment_reference` unique 준비
목표:

- `payment_provider + payment_reference_id` 중복 예약 방지 준비

포함:

1. 기존 중복 데이터 검사 결과 정리
2. `payment_provider`, `payment_reference_id` nullable/빈 문자열 가능성 확인
3. unique index migration 초안 작성
4. unique violation 발생 시 기존 예약 반환 처리 방안 작성
5. 영향 파일/함수 정리
6. rollback 방법 정리

영향 파일/함수:

- `api/payments/[action].js::handlePaymentApproval()`
- `server/booking-core/guestBookingService.js::fetchBookingOrderByPaymentReference()`
- `server/booking-core/guestBookingService.js::createGuestBooking()`

rollback:

- unique index 생성 전이면 문서/초안 revert
- unique index 적용 후면 `drop index` migration + 코드 revert

### PR 3. 예약 생성 transaction/RPC 설계
목표:

- 아래 4개를 하나의 transaction으로 묶는 설계
  1. availability 검사
  2. `booking_orders` insert
  3. `booking_lookup_keys` insert
  4. `reservation_status_events` insert

설계 항목:

- RPC 함수명
- 입력값
- 반환값
- 내부 처리 순서
- 실패 시 에러 코드
- 기존 `createGuestBooking()`과 연결 방식
- 알림 발송 타이밍
- 테스트 시나리오
- rollback 방법

초안 함수명:

```text
create_booking_order_after_payment_v1
```

rollback:

- RPC 사용 전이면 설계 문서 revert
- RPC 사용 후면 기존 `createGuestBooking()` 코드 경로로 revert

### PR 4. 차량 기간 overlap 보호 설계
목표:

- 두 방식을 비교만 한다.

A안: advisory lock + transaction 내부 overlap 재검사

- 장점: 기존 데이터 충돌 영향 적음, 단계적 적용 가능, 선호 방향과 일치
- 단점: 모든 예약 생성 경로가 RPC/transaction을 타야 함
- rollback: RPC 내부 advisory lock 제거 또는 RPC 호출 revert
- 추천: 우선 적용 후보

B안: PostgreSQL `EXCLUDE USING gist` constraint

- 장점: DB 레벨 강제력이 가장 강함
- 단점: 기존 중복 데이터 있으면 migration 실패, 운영 DB lock/extension 영향 검토 필요
- rollback: constraint drop migration
- 추천: advisory lock 안정화 후 후순위 검토

### PR 5. payment ledger 설계 초안
목표:

- 이번 1차 수정 범위에서는 즉시 구현하지 않고 설계만 한다.

설계 대상:

1. `payment_transactions`
2. `payment_events`
3. `refund_transactions`

최소 검토 항목:

- 필요한 이유
- 최소 컬럼
- `booking_orders` 연결 방식
- 결제 성공 후 예약 실패 복구 방식
- 환불 금액 검증 방식
- rollback 방법

rollback:

- 설계 문서 revert
- 구현 전까지 DB 영향 없음

---

## 5. PR별 rollback 방법

| PR | rollback 방법 |
|---|---|
| PR 1 | 문서 변경 commit revert 또는 파일 삭제 revert |
| PR 2 | unique index 적용 전: 초안 revert / 적용 후: drop index migration + 코드 revert |
| PR 3 | RPC 사용 전: 설계 revert / 사용 후: `createGuestBooking()` 기존 경로 revert |
| PR 4 | advisory lock 제거 또는 constraint drop migration |
| PR 5 | 설계 문서 revert. 구현 전 DB 영향 없음 |

---

## 6. 승인 없이는 진행하지 않는 수정 목록

아래 작업은 사장님 명시 승인 전에는 진행하지 않는다.

1. 예약/결제 코드 수정
2. migration 파일 생성
3. migration 적용
4. RPC 함수 구현
5. DB constraint 추가
6. `payment_provider + payment_reference_id` unique index 추가
7. advisory lock 적용
8. exclusion constraint 적용
9. payment ledger 테이블 생성
10. refund ledger 테이블 생성
11. 기존 API 응답 구조 변경
12. UI/UX 수정
13. 리팩토링
14. status 값 임의 추가
15. 배포

---

## 7. PR 1 산출물

PR 1은 문서와 읽기 전용 SQL만 포함한다.

- 정책문서: `docs/policies/RENTCAR00_BOOKING_PAYMENT_INTEGRITY_V1.md`
- 읽기 전용 SQL: `docs/references/BOOKING_PAYMENT_INTEGRITY_CHECKS.sql`
- 코드 변경: 없음
- migration 변경: 없음
- DB 변경: 없음
- 기능 동작 변경: 없음
