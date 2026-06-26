# 2026-04-14 19:20 / f5555a8 / IMS RESERVATION DB SYNC SPEC

## 목표
**IMS 예약 정보를 우리 시스템으로 가져와 저장하는 예약 DB 구조를 먼저 확정한다.**

이 문서의 목적은 목록 API나 가격 계산보다 앞서,
검색/가용성 판정의 기준이 될 **IMS 수집용 예약 DB**를 잠그는 것이다.

---

## 이번 문서에서 잠그는 핵심

### 1. 시작점은 IMS 예약 수집 DB다
- 목록 API보다 먼저 만든다.
- 이유: 차량 가용성 판단의 선행 조건이기 때문이다.

### 2. DB는 3층으로 나눈다
1. **원본 적재층**: IMS에서 받은 데이터를 가능한 한 원형 보존
2. **정규화 예약층**: 검색/겹침판정/운영에 쓰는 구조
3. **동기화 로그층**: 성공/실패/재시도 추적

### 3. 우리 시스템의 조회 기준은 정규화 예약층이다
- 검색/목록/상세/예약 검증은 `reservations` 기준으로 본다.
- IMS 원본은 디버깅/재처리/추적용이다.

### 4. IMS는 외부 입력원이지, 앱 조회용 최종 쿼리 대상이 아니다
- 평시 앱 조회는 우리 DB 기준
- IMS는 준실시간 동기화 source 로 본다.

---

## 대상 범위
이 문서는 아래만 다룬다.
- 어떤 테이블이 필요한지
- 각 테이블 컬럼이 무엇인지
- IMS에서 어떤 키를 받아 저장하는지
- 동기화/upsert/취소 반영을 어떻게 할지
- 실패 로그와 재시도 기준을 어떻게 둘지

이 문서는 아직 아래를 확정하지 않는다.
- 가격 계산 세부 규칙
- 목록 API 응답 shape
- 상세 API shape
- 결제 처리 구조

---

## 설계 원칙

### 원칙 1. 원본은 버리지 않는다
IMS에서 받아온 응답은 원본 그대로 저장할 수 있어야 한다.

이유:
- 파서 수정 시 재처리 가능
- 필드 누락/오해석 검증 가능
- 장애 분석 가능

### 원칙 2. 앱 조회는 정규화 테이블만 본다
검색/가용성/중복판정은 원본 JSON 파싱에 의존하지 않는다.

### 원칙 3. upsert 가능해야 한다
같은 IMS 예약이 다시 들어와도 같은 예약으로 병합되어야 한다.

### 원칙 4. 취소/수정 이력 추적이 가능해야 한다
예약 상태가 바뀌면 변경이 반영되어야 하고, 동기화 시점도 남아야 한다.

### 원칙 5. 동기화 실패는 묻히면 안 된다
실패는 반드시 로그에 남고 재시도 가능해야 한다.

---

## 권장 테이블 구조

## 1. `ims_reservations_raw`
### 역할
IMS에서 받아온 예약 원본을 저장하는 적재층.

### 목적
- 원본 보관
- 파서 재실행 근거
- 비교/감사/복구

### 권장 컬럼
- `id` uuid pk
- `sync_run_id` uuid not null
- `ims_reservation_id` text not null
- `ims_status` text null
- `ims_updated_at` timestamptz null
- `fetched_at` timestamptz not null default now()
- `payload` jsonb not null
- `payload_hash` text not null
- `parse_status` text not null default 'pending'
- `parse_error` text null
- `created_at` timestamptz not null default now()

### 제약/인덱스
- unique (`sync_run_id`, `ims_reservation_id`)
- index (`ims_reservation_id`)
- index (`fetched_at` desc)
- index (`parse_status`)

### 메모
- 같은 예약이 여러 번 들어와도 sync run 기준으로 raw 이력은 남길 수 있다.
- `payload_hash` 로 실제 변경 여부 비교 가능.

---

## 2. `reservations`
### 역할
검색/가용성/중복판정/운영 조회에 사용하는 정규화 예약 테이블.

### 목적
- 차량별 예약 기간 저장
- 상태 기반 blocking 판단
- 목록 API 가용 차량 계산
- 최종 예약 생성 시 충돌 검증

### 권장 컬럼
- `id` uuid pk
- `ims_reservation_id` text unique null
- `source` text not null default 'ims'
- `source_updated_at` timestamptz null
- `car_id` text not null
- `status` text not null
- `status_raw` text null
- `pickup_option` text null
- `delivery_region_id` text null
- `delivery_address` text null
- `customer_name` text null
- `customer_phone` text null
- `start_at` timestamptz not null
- `end_at` timestamptz not null
- `cancelled_at` timestamptz null
- `confirmed_at` timestamptz null
- `quoted_price_snapshot` jsonb null
- `confirmed_price_snapshot` jsonb null
- `raw_payload_ref_id` uuid null references `ims_reservations_raw(id)`
- `last_synced_at` timestamptz not null default now()
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

### 제약/인덱스
- unique (`ims_reservation_id`) where `ims_reservation_id` is not null
- index (`car_id`, `start_at`, `end_at`)
- index (`status`)
- index (`last_synced_at` desc)
- check (`end_at` > `start_at`)

### 상태값 권장
내부 표준 status 예시:
- `pending`
- `confirmed`
- `paid`
- `cancelled`
- `completed`
- `failed`

### blocking status 초안
검색/가용성 차단에 쓰는 상태 후보:
- `pending`
- `confirmed`
- `paid`

차단 제외 후보:
- `cancelled`
- `failed`
- `completed`

※ 최종 blocking status 는 다음 문서에서 별도 잠근다. 이 문서에서는 컬럼 구조만 먼저 고정한다.

---

## 3. `reservation_sync_runs`
### 역할
한 번의 동기화 실행 단위를 기록.

### 목적
- 언제 어떤 범위를 동기화했는지 추적
- 성공/실패 여부 확인
- 재실행 기준 확보

### 권장 컬럼
- `id` uuid pk
- `sync_type` text not null
- `started_at` timestamptz not null default now()
- `finished_at` timestamptz null
- `status` text not null default 'running'
- `cursor_from` text null
- `cursor_to` text null
- `fetched_count` integer not null default 0
- `parsed_count` integer not null default 0
- `upserted_count` integer not null default 0
- `failed_count` integer not null default 0
- `error_summary` text null
- `created_at` timestamptz not null default now()

### 상태값 예시
- `running`
- `success`
- `partial_failure`
- `failed`

---

## 4. `reservation_sync_errors`
### 역할
개별 실패 건을 추적.

### 목적
- 어떤 예약에서 실패했는지 남김
- 재파싱/재동기화 대상 관리

### 권장 컬럼
- `id` uuid pk
- `sync_run_id` uuid not null references `reservation_sync_runs(id)`
- `ims_reservation_id` text null
- `stage` text not null
- `error_code` text null
- `error_message` text not null
- `payload` jsonb null
- `created_at` timestamptz not null default now()

### stage 예시
- `fetch`
- `parse`
- `normalize`
- `upsert`

---

## 권장 동기화 흐름

### Step 1. sync run 생성
- `reservation_sync_runs` 에 실행 레코드 생성
- 범위 기준(cursor/time window) 기록

### Step 2. IMS 예약 fetch
- IMS에서 예약 목록/변경분 조회
- 응답 원본을 `ims_reservations_raw` 에 적재

### Step 3. raw → normalized parse
- IMS payload 에서 필요한 필드 추출
- 내부 표준 status 로 매핑
- `car_id`, `start_at`, `end_at` 정규화

### Step 4. `reservations` upsert
- 기준 키: `ims_reservation_id`
- 있으면 update
- 없으면 insert

### Step 5. sync result 마감
- 성공/실패 수 집계
- `reservation_sync_runs.status` 갱신

---

## upsert 기준

### 기준 키
기본값:
- `ims_reservation_id`

### update 대상
동일 `ims_reservation_id` 가 들어오면 아래는 갱신 가능:
- `status`
- `status_raw`
- `car_id`
- `start_at`
- `end_at`
- `pickup_option`
- `delivery_region_id`
- `delivery_address`
- `customer_name`
- `customer_phone`
- `source_updated_at`
- `raw_payload_ref_id`
- `last_synced_at`

### update 금지/주의
- 내부 예약 생성 이후 수동 필드가 붙을 수 있으므로
  추후 `local-only` 필드와 `sync-owned` 필드는 분리 고려 필요

---

## 취소/변경 반영 규칙

### 취소
IMS 원본 status 가 취소 계열이면:
- `status = cancelled`
- `cancelled_at = now()` 또는 IMS 취소시각 사용
- 가용성 blocking 에서는 제외

### 변경
동일 예약번호의 차량/기간/상태가 바뀌면:
- 기존 row update
- `source_updated_at`, `last_synced_at` 갱신
- 필요 시 status history 는 후속 문서에서 추가

### 삭제
IMS에서 안 보인다고 즉시 delete 하지 않는다.
- hard delete 금지
- 상태 기반 종료/취소 처리 우선

---

## 동기화 주기 초안

### 기본 권장
- 준실시간 poll 방식
- 예: 1~5분 주기

### 이유
- 목록/가용성 정확도 확보
- 실시간 직결보다 구현/안정성 균형이 좋음

### 추가 원칙
- 예약 확정 직전에는 필요 시 한 번 더 최신성 확인 가능
- 단, 앱 조회 전체를 IMS 실시간 응답에 묶지 않는다.

---

## 최소 저장 필드 기준
IMS 원본에서 최소한 아래는 확보되어야 한다.
- IMS 예약 ID
- 차량 식별자
- 예약 상태
- 대여 시각
- 반납 시각
- 고객명/연락처 가능 시
- 업데이트 시각

이 중 차량 식별자 매핑이 불완전하면
**`car_id` 매핑 전략 문서가 별도로 필요**하다.

---

## 가장 중요한 리스크

### 1. IMS 차량 식별자와 우리 차량 DB 식별자가 다를 수 있음
- 이 경우 `car_id` 직접 매핑 불가
- 해결: 별도 매핑 테이블 필요 가능

후속 후보:
- `ims_car_mappings`
  - `ims_car_id`
  - `ims_car_name`
  - `local_car_id`
  - `is_active`

### 2. IMS 상태값이 우리 차단 기준과 다를 수 있음
- `status_raw` 저장 필요
- 내부 표준 status 는 분리 필요

### 3. 수정/취소 타이밍 지연
- 준실시간 동기화는 지연 가능
- 예약 확정 직전 재검증이 필요할 수 있음

### 4. 원본 필드 누락/형식 변경
- raw 보관 없으면 추적이 어려움
- `payload` 원본 저장은 필수

---

## 이 문서 기준으로 다음에 해야 할 것
1. IMS 실제 응답 기준으로 필드 매핑표 작성
2. `car_id` 매핑 전략 확정
3. 내부 표준 `status` 매핑표 작성
4. 예약 겹침 blocking status 확정
5. Supabase SQL 스키마 초안 작성

---

## 한 줄 기준
지금부터 `premove-clone`의 가용성 판단 기반은
**IMS 예약을 준실시간으로 적재한 우리 예약 DB**로 전환한다.
