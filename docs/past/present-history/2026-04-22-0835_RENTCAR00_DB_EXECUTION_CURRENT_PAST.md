# RENTCAR00 DB 실행 기준 현재문서

## 문서 상태
- 상태: active current
- 목적: 예약/결제/로컬원장 기준을 단일 문서로 잠근다.
- 이 문서가 booking core 관련 최상위 기준이다.

## 1. 최종 정책
1. `booking_orders` 는 결제 완료 후에만 생성한다.
2. hold 는 두지 않는다.
3. 임시예약은 만들지 않는다.
4. 검색 결과 가용성은 참고값이다.
5. 최종 결제 데이터가 넘어가는 시점에 서버가 availability 를 다시 검증한다.
6. 재검증을 통과한 경우에만 결제를 성공 처리하고 예약을 생성한다.
7. 재검증 실패 시 결제는 실패 처리한다.
8. 재검증 실패 건은 예약을 생성하지 않는다.
9. 결제 성공 후 `booking_orders` 생성, 공개 예약번호 발급, IMS 동기화를 순서대로 수행한다.
10. IMS 동기화 실패는 예약 실패로 되돌리지 않고 `manual_review_required` 로 처리한다.
11. 현재 웹의 `예약 확정하기` 버튼은 실제 PG가 아직 없으므로, 시스템 의미상 `결제 성공 직후 진입점`으로 취급한다.
12. 따라서 현재 `예약 확정하기` 는 테스트 예외 예약이 아니라, 결제 완료 surrogate entry 로 동작해야 한다.
13. 나중에 실제 결제 연동 시에는 결제 성공 콜백이 현재 예약 생성 서버 경로에 연결되어야 한다.

## 2. 핵심 테이블
### 2.1 `booking_orders`
역할:
- 홈페이지 예약의 로컬 source of truth
- 고객 조회 기준 원장
- 결제 완료 예약의 기준 원장

최소 필수 컬럼:
- `id`
- `public_reservation_code`
- `booking_channel`
- `customer_name`
- `customer_phone`
- `customer_phone_last4`
- `car_id`
- `pickup_at`
- `return_at`
- `pickup_method`
- `quoted_total_amount`
- `payment_provider`
- `payment_reference_id`
- `payment_status`
- `booking_status`
- `sync_status`
- `manual_review_required`
- `created_at`
- `updated_at`

조건부 컬럼:
- `pricing_snapshot`
- `pickup_location_snapshot`
- `return_location_snapshot`
- `cancelled_at`
- `completed_at`

제외:
- `hold_started_at`
- `hold_expires_at`
- hold 전용 상태
- 임시예약 전용 컬럼

### 2.2 `reservation_mappings`
역할:
- 로컬 예약과 IMS 예약 연결
- 외부 전송 idempotency 추적
- sync 실패 이력 추적

최소 컬럼:
- `id`
- `booking_order_id`
- `external_system`
- `external_reservation_id`
- `ims_reservation_id`
- `mapping_status`
- `external_request_key`
- `last_sync_attempt_at`
- `last_sync_success_at`
- `last_sync_error_code`
- `last_sync_error_message`
- `created_at`
- `updated_at`

### 2.3 보조 테이블
유지:
- `reservation_status_events`
- `booking_lookup_keys`

## 3. 상태 기준
### 3.1 `booking_orders.booking_status`
- `confirmed_pending_sync`
- `confirmed`
- `in_use`
- `cancelled`
- `completed`
- `manual_review_required`

### 3.2 `booking_orders.payment_status`
- `paid`
- `cancelled`
- `refund_pending`
- `refunded`

### 3.3 `booking_orders.sync_status`
- `not_required`
- `pending`
- `syncing`
- `synced`
- `sync_failed`
- `cancel_sync_pending`
- `cancel_synced`
- `cancel_sync_failed`
- `stale_check_required`

### 3.4 `reservation_mappings.mapping_status`
- `pending`
- `linked`
- `sync_failed`
- `cancel_pending`
- `cancel_failed`
- `manual_review_required`
- `closed`

## 4. blocking 기준
차단 상태:
- `confirmed_pending_sync`
- `confirmed`
- `in_use`
- `manual_review_required`

비차단 상태:
- `cancelled`
- `completed`
- `refunded`

원칙:
- blocking 은 결제 완료 후 `booking_orders` 생성 시점부터 시작한다.
- 결제 전에는 로컬 예약 원장으로 차량을 막지 않는다.

## 5. 결제 및 예약 확정 플로우
1. 사용자가 차량/일정을 선택한다.
2. 검색 결과로 가용 차량을 보여준다.
3. 현재 웹에서는 `예약 확정하기` 가 결제 성공 직후 진입점 역할을 한다.
4. 서버는 예약 생성 직전에 DB availability 를 최종 재검증한다.
5. 재검증 대상은 `ims_sync_reservations` 와 `booking_orders` 둘 다 포함한다.
6. 재검증 실패 시 결제 실패로 간주하고 예약을 생성하지 않는다.
7. 재검증 통과 시 결제 성공으로 간주한다.
8. 결제 성공 직후 `booking_orders` 를 생성한다.
9. 공개 예약번호를 발급한다.
10. `reservation_mappings` 를 만들고 IMS 동기화를 시작한다.
11. IMS 동기화 실패 시 예약은 유지하되 `manual_review_required` 로 올린다.

## 6. 검증 기준
반드시 확인할 것:
1. migration 스키마가 hold 없는 정책과 일치하는지
2. `booking_orders` 가 결제 완료 후 생성 모델과 충돌하지 않는지
3. `public_reservation_code`, `payment_provider`, `payment_reference_id` 가 not null 기준과 맞는지
4. 상태 enum 이 문서와 SQL에서 일치하는지
5. 재검증 실패 시 결제 실패, 예약 미생성 원칙과 모순되는 상태가 없는지
6. IMS sync 실패 시 local 예약이 유지되는지
7. 예약 생성 직전 DB 재검증이 실제로 `ims_sync_reservations` 와 `booking_orders` 둘 다 검사하는지
8. 예약 생성 후 비회원 조회와 취소가 모두 DB 기준으로 동작하는지
9. 취소 후 검색 결과에서 blocking 상태가 정상 해제되는지

## 7. 현재 실행 범위 잠금
이번 실행 범위는 아래로 고정한다.

1. 프론트 `localStorage` 예약 생성/조회/취소 경로를 제거한다.
2. 서버 기준으로 예약 생성 API를 만든다.
3. 예약 생성 API는 `예약 확정하기` 요청을 결제 성공 surrogate entry 로 받아 처리한다.
4. 생성 직전 availability 재검증을 수행한다.
5. 재검증은 `ims_sync_reservations` 와 `booking_orders` blocking 상태를 함께 본다.
6. 생성 성공 후 예약완료 페이지와 비회원 조회는 DB 기준으로 조회한다.
7. 비회원 예약취소는 `booking_orders` 상태 변경과 이벤트 적재까지 포함한다.
8. 검색 가용성은 `booking_orders` blocking 상태를 반영하도록 수정한다.

## 8. 실행 Phase 잠금
### Phase 1. 최종 DB 재검증 경로 구축
- 목적: 예약 생성 직전 마지막 availability 재검증을 서버에서 수행한다.
- 종료 조건: `ims_sync_reservations` + `booking_orders` 기준으로 차단 판정이 가능하다.

### Phase 2. DB 예약 생성 경로 구축
- 목적: `booking_orders` 기준 실예약 생성 API를 만든다.
- 종료 조건: 예약번호 발급, 상태값 저장, snapshot 저장, 생성 응답 반환이 된다.

### Phase 3. DB 조회/취소 경로 정리
- 목적: 완료페이지/비회원조회/비회원취소를 DB 기준으로 통일한다.
- 종료 조건: 생성 후 조회 가능, 취소 가능, 취소 후 상태 재조회 가능.

### Phase 4. 검색 blocking 반영
- 목적: 검색 결과가 local booking 원장을 반영한다.
- 종료 조건: 생성 후 동일 시간대 재검색 시 차량이 차단되고, 취소 후 해제된다.

### Phase 5. 통합 검증
- 목적: 전체 흐름 완료 판정.
- 종료 조건: 생성, 조회, 취소, 재검색 차단/해제가 전부 통과한다.

## 9. migration 재작성 기준
`20260421214000_create_booking_core_tables.sql` 은 아래 기준으로 다시 쓴다.
- hold 컬럼 제거
- hold check 제거
- hold index 제거
- 구 payment 상태 제거
- `booking_orders` 생성 시점이 결제 완료 후라는 전제 반영
- not null / check / index 를 새 기준으로 재정렬

`20260421214500_create_booking_core_support_tables.sql` 은 FK와 보조 역할 기준만 유지하고, 새 메인 스키마와 충돌 없는지만 검증한다.

## 10. 문서 운영 원칙
- booking core 기준은 이 문서 1개만 본다.
- 임시 체크리스트 문서는 유지하지 않는다.
- 구기준 문서는 active 영역에서 제거한다.

## 7. migration 재작성 기준
`20260421214000_create_booking_core_tables.sql` 은 아래 기준으로 다시 쓴다.
- hold 컬럼 제거
- hold check 제거
- hold index 제거
- 구 payment 상태 제거
- `booking_orders` 생성 시점이 결제 완료 후라는 전제 반영
- not null / check / index 를 새 기준으로 재정렬

`20260421214500_create_booking_core_support_tables.sql` 은 FK와 보조 역할 기준만 유지하고, 새 메인 스키마와 충돌 없는지만 검증한다.

## 8. 문서 운영 원칙
- booking core 기준은 이 문서 1개만 본다.
- 임시 체크리스트 문서는 유지하지 않는다.
- 구기준 문서는 active 영역에서 제거한다.
