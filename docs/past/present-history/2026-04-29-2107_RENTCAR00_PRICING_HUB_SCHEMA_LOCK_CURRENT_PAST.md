# RENTCAR00 pricing hub schema lock current

Last updated: 2026-04-29

이 문서는 **구현 직전 기준의 신규 PRICING_HUB 스키마 잠금 문서**다.
현재 원칙은 아래다.

- 기존 IMS 중심 본체는 유지한다.
- 기존 검색 가격 계산 경로는 건드리지 않는다.
- 신규 허브는 **추가 테이블만** 만든다.
- 신규 테이블명은 전부 `pricing_hub_*` 로 통일한다.

---

## 1. 결론

### 한 줄 결론
- **이번 1차는 IMS 중심 확장형이다.**
- 기존 본체:
  - `car_groups`
  - `price_policies`
  - `price_policy_groups`
  - `v_active_group_price_policies`
- 신규 허브:
  - `pricing_hub_*` 추가 테이블만 만든다.

### 왜 이렇게 잠그나
1. 현재 검색/가격 구조가 이미 `ims_group_id` 중심이다.
2. `fetchGroupPricePolicies.js` 가 `v_active_group_price_policies` 만 본다.
3. 기존 운영 가격 계산과 정면충돌 없이 새 체계를 병행할 수 있다.
4. 1차 목표가 "기존 것 안 건드리고 새 요금체계 추가 + 패널 수정" 이기 때문이다.

---

## 2. 네이밍 규칙

### 공식 체계명
- **`RENTCAR00_PRICING_HUB`**

### 스키마 규칙
- 레거시 본체는 기존 이름 유지
- 신규 확장 테이블은 전부 `pricing_hub_` prefix 사용
- `PRICE` / `PRICING` 단독 명칭으로 새 체계를 부르지 않는다.

---

## 3. 유지할 레거시 본체

### 3-1. `car_groups`
- IMS 그룹 본체
- 메인 그룹 축은 `car_groups.id` 와 `ims_group_id`

### 3-2. `price_policies`
- 현재 운영 가격정책 본체
- 기존 검색 계산이 참조하는 정책 데이터

### 3-3. `price_policy_groups`
- 그룹과 정책 연결 본체

### 3-4. `v_active_group_price_policies`
- 검색 가격 조회 view
- 이번 단계에서 **변경 금지**

---

## 4. 추가할 신규 허브 테이블

### 4-1. `pricing_hub_periods`
역할:
- 기존 `price_policies` 에 기간/요일 개념 추가

필수 필드:
- `id` uuid pk
- `price_policy_id` fk
- `period_name` text
- `start_at` timestamptz null
- `end_at` timestamptz null
- `apply_mon` boolean default true
- `apply_tue` boolean default true
- `apply_wed` boolean default true
- `apply_thu` boolean default true
- `apply_fri` boolean default true
- `apply_sat` boolean default true
- `apply_sun` boolean default true
- `active` boolean default true
- `metadata` jsonb default `{}`
- `created_at`
- `updated_at`

### 4-2. `pricing_hub_rates`
역할:
- 기간별 요율/시간요금/장기요금 저장

필수 필드:
- `id` uuid pk
- `pricing_hub_period_id` fk
- `rate_scope` text
  - `common`, `weekday`, `weekend`, `extended`
- `fee_6h` integer default 0
- `fee_12h` integer default 0
- `fee_24h` integer default 0
- `fee_1h` integer default 0
- `discount_percent` numeric(5,2) null
- `discount_amount` integer null
- `week_1_price` integer null
- `week_2_price` integer null
- `month_1_price` integer null
- `long_24h_price` integer null
- `long_1h_price` integer null
- `weekend_days` text null
- `metadata` jsonb default `{}`
- `created_at`
- `updated_at`
- unique (`pricing_hub_period_id`, `rate_scope`)

### 4-3. `pricing_hub_overrides`
역할:
- 예외 규칙

필수 필드:
- `id` uuid pk
- `target_type` text
  - `ims_group`, `zzimcar_model`, `vehicle`, `policy`
- `target_id` text
- `field_name` text
- `override_type` text
  - `absolute`, `adjustment`, `percentage`
- `override_value` numeric(12,2)
- `start_at` timestamptz null
- `end_at` timestamptz null
- `priority` integer default 100
- `reason` text null
- `status` text default `active`
- `created_at`
- `updated_at`

### 4-4. `pricing_hub_previews`
역할:
- preview 실행 묶음

필수 필드:
- `id` uuid pk
- `run_label` text
- `status` text
- `summary_json` jsonb
- `created_by` text null
- `created_at`

### 4-5. `pricing_hub_preview_items`
역할:
- preview 결과 상세 행

필수 필드:
- `id` uuid pk
- `pricing_hub_preview_id` fk
- `car_group_id` fk null
- `target_type` text
- `target_id` text
- `before_json` jsonb
- `after_json` jsonb
- `diff_json` jsonb
- `warning_json` jsonb default '[]'::jsonb
- `created_at`

### 4-6. `pricing_hub_publishes`
역할:
- 실제 반영 이력

필수 필드:
- `id` uuid pk
- `run_type` text
  - `dry-run`, `publish`
- `target_channel` text
  - `internal`, `ims`, `zzimcar`
- `status` text
- `success_count` integer default 0
- `failure_count` integer default 0
- `request_snapshot_json` jsonb
- `result_snapshot_json` jsonb
- `created_by` text null
- `started_at` timestamptz
- `finished_at` timestamptz null

### 4-7. `pricing_hub_publish_items`
역할:
- publish 상세 결과

필수 필드:
- `id` uuid pk
- `pricing_hub_publish_id` fk
- `target_type` text
- `target_id` text
- `status` text
- `request_json` jsonb
- `response_json` jsonb
- `error_message` text null
- `created_at`

### 4-8. `pricing_hub_channel_mappings`
역할:
- 찜카 후연결용 채널 매핑

필수 필드:
- `id` uuid pk
- `source_channel` text
- `source_type` text
- `source_id` text
- `source_name` text
- `car_group_id` fk
- `mapping_status` text
- `mapping_confidence` numeric(5,2) null
- `metadata` jsonb default `{}`
- `created_at`
- `updated_at`

---

## 5. 이번 단계 구현 금지

아래는 이번 단계에서 건드리지 않는다.
- `v_active_group_price_policies`
- `server/search-db/repositories/fetchGroupPricePolicies.js`
- `scripts/pricing/apply-group-pricing.js`
- 기존 검색 가격 계산 결과
- 찜카 실제 publish

---

## 6. 구현 직전 체크

1. 신규 허브 테이블은 모두 추가만 한다.
2. 기존 레거시 테이블 컬럼은 1차에서 수정하지 않는다.
3. preview 는 저장 가능 구조로 둔다.
4. publish 테이블은 지금 만들어도 실제 반영 기능은 후순위다.
5. `car_group_id` / `ims_group_id` 기준으로 문서를 통일한다.

---

## 7. 결론

이번 스키마 기준은 아래로 잠근다.
- **기존 IMS 본체 유지**
- **신규 `pricing_hub_*` 추가**
- **기존 검색 가격 계산 경로 미수정**
- **관리자 패널은 신규 허브 테이블만 먼저 만진다**
