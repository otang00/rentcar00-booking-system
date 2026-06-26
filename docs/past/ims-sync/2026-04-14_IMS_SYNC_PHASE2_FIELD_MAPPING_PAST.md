# 2026-04-14 19:36 / 05bdd61 / IMS SYNC PHASE 2 FIELD MAPPING

## 결론
Phase 2에서는 IMS 예약 목록 응답을 우리 DB 컬럼으로 옮기는 기준 매핑표를 고정한다.

기준 테이블:
- raw 적재: `ims_reservations_raw`
- 정규화 적재: `reservations`

---

## 1. raw 적재 기준
IMS 응답의 각 예약 row는 원본 그대로 `ims_reservations_raw.payload` 에 저장한다.

추가 메타:
- `ims_reservation_id` ← `id`
- `ims_status` ← `status`
- `ims_updated_at` ← 미확인, 응답 내 수정시각 필드 발견 시 연결
- `payload_hash` ← payload 해시

---

## 2. reservations 정규화 매핑

| IMS 응답 필드 | reservations 컬럼 | 필수 | 메모 |
|---|---|---:|---|
| `id` | `ims_reservation_id` | Y | upsert 기준 키 |
| `status` | `status_raw` | Y | IMS 원본 상태 보관 |
| `status` | `status` | Y | 내부 표준 status 로 매핑 필요 |
| `start_at` | `start_at` | Y | 예약 시작 시각 |
| `end_at` | `end_at` | Y | 예약 종료 시각 |
| `car.id` | `car_id` | Y | 실차 기준 키 |
| `car.car_identity` | `car_number` | N | 차량번호 보관 |
| `car.car_group_id` | `car_group_id` | N | 가격/차종 규칙 연결용 |
| `detail.customer_name` | `customer_name` | N | 가능 시 저장 |
| `detail.customer_contact` | `customer_phone` | N | 가능 시 저장 |
| `detail.pickup_address` | `pickup_address` | N | 입력 원본 보관 |
| `detail.dropoff_address` | `dropoff_address` | N | 입력 원본 보관 |
| `detail.pickup_address / dropoff_address` | `delivery_address` | N | 운영상 단일 주소 필요 시 파생 저장 |
| `id` 기반 raw row id | `raw_payload_ref_id` | N | raw 추적용 |
| 응답 내 수정시각 필드 | `source_updated_at` | N | 아직 확인 필요 |

---

## 3. 현재 확인된 IMS 응답 원천 필드
상위 예약 필드:
- `id`
- `status`
- `self_contract_status`
- `title`
- `start_at`
- `end_at`

차량 필드:
- `car.id` → 실차키
- `car.car_identity` → 차량번호
- `car.car_name`
- `car.car_group_id` → 차종/가격 규칙 연결용 그룹키
- `car.car_age`
- `car.oil_type`
- `car.use_connect`

상세 필드:
- `detail.id`
- `detail.type`
- `detail.rental_type`
- `detail.customer_name`
- `detail.customer_contact`
- `detail.customer_car_number`
- `detail.pickup_address`
- `detail.dropoff_address`
- `detail.delivery_user_name`
- `detail.recommender_name`
- `detail.status`
- `detail.license_verification`

---

## 4. 내부 표준 status 초안
IMS `status` 는 원본 그대로 `status_raw` 에 저장하고,
앱 운영용 `status` 는 아래 내부 표준으로 매핑한다.

내부 표준 후보:
- `pending`
- `confirmed`
- `paid`
- `cancelled`
- `completed`
- `failed`

주의:
- 실제 IMS status 값 목록은 아직 전수 확인 전이다.
- 따라서 지금 Phase에서는 **status_raw 보관 필수**까지만 잠근다.

---

## 5. car_id 기준
현재 Phase 기준:
- `reservations.car_id` 는 `car.id` 를 사용한다.
- `car.car_identity` 는 별도 `car_number` 로 저장한다.
- `car.car_group_id` 는 별도 `car_group_id` 로 저장한다.

이유:
- 가용성 차단은 실차 단위여야 한다.
- `car_group_id` 는 차종/가격 규칙 연결용이지, 예약 blocking 기준으로 쓰면 안 된다.

주의:
- 우리 차량 DB의 실제 실차키와 `car.id` 연결 방식은 후속 검증 필요
- 필요 시 `ims_car_mappings` 보조 테이블 추가

---

## 6. 필수/선택 구분
### 필수
- `id`
- `status`
- `start_at`
- `end_at`
- `car.id`

### 선택
- `car.car_identity`
- `car.car_group_id`
- `detail.customer_name`
- `detail.customer_contact`
- `detail.pickup_address`
- `detail.dropoff_address`
- 수정시각 계열 필드

---

## 7. 미확정 항목
- IMS 응답 내 최종 수정시각 필드명
- IMS status 실제 enum 전체
- `delivery_address` 파생 규칙을 `pickup` 우선으로 할지 `dropoff` 우선으로 할지
- `car.id` 와 우리 DB 실차키 연결 방식

---

## Phase 2 종료 조건 점검
- IMS → DB 매핑표 완료: 완료
- 필수/선택 필드 분리: 완료
- car 식별자 1차 기준 고정: 완료
- 미확정 항목 분리: 완료
