# 2026-04-14 19:52 / 300f32d / IMS SYNC PHASE 3 DB SCHEMA

## 결론
Phase 3에서는 IMS 예약 동기화용 DB 스키마를 확정한다.

기준 테이블:
- `ims_reservations_raw`
- `reservations`
- `reservation_sync_runs`
- `reservation_sync_errors`

---

## 1. `ims_reservations_raw`
### 역할
IMS 원본 payload 적재

### 핵심 컬럼
- `id uuid primary key`
- `sync_run_id uuid not null`
- `ims_reservation_id text not null`
- `ims_status text null`
- `ims_updated_at timestamptz null`
- `fetched_at timestamptz not null default now()`
- `payload jsonb not null`
- `payload_hash text not null`
- `parse_status text not null default 'pending'`
- `parse_error text null`
- `created_at timestamptz not null default now()`

### 제약
- unique (`sync_run_id`, `ims_reservation_id`)

### 인덱스
- `ims_reservation_id`
- `fetched_at desc`
- `parse_status`

---

## 2. `reservations`
### 역할
가용성/겹침판정/운영 조회용 정규화 테이블

### 핵심 컬럼
- `id uuid primary key`
- `ims_reservation_id text null`
- `source text not null default 'ims'`
- `source_updated_at timestamptz null`
- `car_id text not null`
- `car_number text null`
- `car_group_id text null`
- `status text not null`
- `status_raw text null`
- `pickup_option text null`
- `delivery_region_id text null`
- `pickup_address text null`
- `dropoff_address text null`
- `delivery_address text null`
- `customer_name text null`
- `customer_phone text null`
- `start_at timestamptz not null`
- `end_at timestamptz not null`
- `cancelled_at timestamptz null`
- `confirmed_at timestamptz null`
- `quoted_price_snapshot jsonb null`
- `confirmed_price_snapshot jsonb null`
- `raw_payload_ref_id uuid null`
- `last_synced_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### 제약
- unique (`ims_reservation_id`) where not null
- check (`end_at > start_at`)

### 인덱스
- (`car_id`, `start_at`, `end_at`)
- `status`
- `last_synced_at desc`

---

## 3. `reservation_sync_runs`
### 역할
동기화 실행 단위 추적

### 핵심 컬럼
- `id uuid primary key`
- `sync_type text not null`
- `started_at timestamptz not null default now()`
- `finished_at timestamptz null`
- `status text not null default 'running'`
- `cursor_from text null`
- `cursor_to text null`
- `fetched_count integer not null default 0`
- `parsed_count integer not null default 0`
- `upserted_count integer not null default 0`
- `failed_count integer not null default 0`
- `error_summary text null`
- `created_at timestamptz not null default now()`

### 인덱스
- `started_at desc`
- `status`

---

## 4. `reservation_sync_errors`
### 역할
개별 실패 로그

### 핵심 컬럼
- `id uuid primary key`
- `sync_run_id uuid not null`
- `ims_reservation_id text null`
- `stage text not null`
- `error_code text null`
- `error_message text not null`
- `payload jsonb null`
- `created_at timestamptz not null default now()`

### 인덱스
- `sync_run_id`
- `ims_reservation_id`
- `stage`

---

## upsert 기준
- unique key: `ims_reservation_id`
- 동일 키 재수집 시 update
- raw 는 sync run 기준 누적 가능

---

## 운영 조회 기준
- active 예약: `end_at > now()`
- blocking 예약: active 예약 중 취소/실패/완료 성격 status 제외
- 즉 조회 기준은 시간 + status 를 함께 본다.

---

## 검증 기준
- raw → normalized → sync log 책임 분리됨
- 같은 예약 재수집 시 idempotent upsert 가능
- 실패 추적 가능
- 앱 조회는 `reservations` 단일 기준으로 설명 가능
