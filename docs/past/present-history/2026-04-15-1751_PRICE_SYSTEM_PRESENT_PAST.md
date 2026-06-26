# PRICE SYSTEM

## 목적
IMS 그룹 기준 가격 체계를 DB source of truth 로 재구성한다.

## 원본
- 요금표 원본: `group_cost.xlsx`
- 그룹 원본: `20260415-car_group_list.xlsx`
- 현재 차량 기준축: `public.cars.source_group_id`

## 현재 검증 결과
- 요금표 정책 수: 19개
- 요금표에 포함된 적용 그룹명 수: 34개
- 그룹리스트 그룹명 수: 34개
- 현재 활성 차량 기준 exact match: 34 / 34
- 결론: **현재 데이터만으로도 그룹명 기준 1차 매핑은 가능**

## Canonical 모델
가격은 차량 개별 row 기준이 아니라 **IMS 그룹 기준**으로 계산한다.

### 1. `public.car_groups`
IMS 그룹 마스터.

- `id uuid primary key`
- `ims_group_id bigint not null unique`
- `group_name text not null`
- `grade text null`
- `import_type text not null default 'ims'`
- `active boolean not null default true`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

역할:
- IMS group id 와 그룹명을 정식 기준축으로 저장

### 2. `public.price_policies`
요금표 정책 본체.

- `id uuid primary key`
- `policy_name text not null`
- `base_daily_price integer not null`
- `weekday_rate_percent numeric(5,2) not null`
- `weekend_rate_percent numeric(5,2) not null`
- `weekday_1_2d_price integer not null`
- `weekday_3_4d_price integer not null`
- `weekday_5_6d_price integer not null`
- `weekday_7d_plus_price integer not null`
- `weekend_1_2d_price integer not null`
- `weekend_3_4d_price integer not null`
- `weekend_5_6d_price integer not null`
- `weekend_7d_plus_price integer not null`
- `hour_1_price integer not null default 0`
- `hour_6_price integer not null default 0`
- `hour_12_price integer not null default 0`
- `effective_from timestamptz null`
- `effective_to timestamptz null`
- `active boolean not null default true`
- `source_file text null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

역할:
- 한 장의 요금표에서 정의된 정책 1건을 1 row 로 저장
- 주중/주말, 기간 구간, 시간 요금을 모두 명시 저장

### 3. `public.price_policy_groups`
정책과 그룹 연결 테이블.

- `id uuid primary key`
- `price_policy_id uuid not null references public.price_policies(id) on delete cascade`
- `car_group_id uuid not null references public.car_groups(id) on delete cascade`
- `match_source text not null default 'xlsx'`
- `active boolean not null default true`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `unique (price_policy_id, car_group_id)`

역할:
- 요금표 정책 1건이 여러 IMS 그룹에 적용되는 구조를 표현
- 예: `디올뉴그렌져2.5` 정책 1건이 여러 그룹명에 매핑

## 계산 기준
### 1. 기준 키
- 검색 가격 계산은 차량의 `source_group_id` 를 통해 `car_groups.ims_group_id` 를 찾는다.
- 그 다음 `price_policy_groups` 로 연결된 정책 1건을 읽는다.

### 2. 우선 적용 단위
- `total_hours < 24` 이고 해당 시간 요금이 0보다 크면 시간 요금을 우선 적용
- 그 외는 일 요금 적용

### 3. 일 요금 계산
- `billable_days = ceil(total_hours / 24)`
- 구간은 아래 규칙으로 고정
  - `1~2일`
  - `3~4일`
  - `5~6일`
  - `7일 이상`
- 각 billable day 를 한국 시간 기준으로 주중/주말로 분류
- 각 day 에 대해 구간 단가를 적용 후 합산

### 4. 시간 요금 계산
- 시간 요금은 아래 순서로 선택
  - `<= 1시간` -> `hour_1_price`
  - `<= 6시간` -> `hour_6_price` 가 0보다 크면 사용, 아니면 `hour_1_price * ceil(hours)`
  - `<= 12시간` -> `hour_12_price` 가 0보다 크면 사용, 아니면 상위 fallback
- `> 12시간` 이고 `< 24시간` 인 경우는 `hour_12_price + hour_1_price * extra_hours` fallback 을 기본 규칙으로 둔다.
- 단, 실제 IMS 동작이 다르면 구현 전 별도 조정한다.

### 5. 응답 필드 의미
- `discountPrice`: 실제 판매 총액
- `price`: `base_daily_price * billable_days` 를 기본 정가 총액으로 사용
- `deliveryPrice`: 지역 정책 테이블 기준 별도 합산

## 원본 해석 규칙
### 요금표 엑셀
- 첫 줄은 헤더
- 정책 1건은 기본적으로 2행 세트
  - 첫 행: 주중
  - 둘째 행: 주말
- `적용 차량 그룹` 값은 `/` 로 분리하여 여러 그룹으로 해석
- 비율 컬럼은 audit/reference 용으로 저장하되, **최종 계산은 구간별 명시 가격을 우선 사용**

### 그룹리스트 엑셀
- 각 행이 IMS 그룹 1건
- `그룹명` 컬럼을 1차 매핑 키로 사용
- 최종 저장 키는 `ims_group_id`

## 최종 테이블 완성 로드맵
### Phase 1. 기준 데이터 모델 잠금
목적:
- 테이블 구조, 컬럼명, 계산식 확정

종료 조건:
- 본 문서 기준 스키마/공식 승인

### Phase 2. 그룹 카탈로그 구축
목적:
- IMS group id, 그룹명, 현재 차량 연결축 정리

작업:
- IMS API 또는 기존 파싱 데이터에서 `ims_group_id + group_name` 수집
- `car_groups` 적재

종료 조건:
- 활성 차량의 `source_group_id` 가 `car_groups` 와 연결됨

### Phase 3. 요금표 정책 적재
목적:
- 엑셀 요금표를 `price_policies` 로 적재

작업:
- 주중/주말 2행 세트를 1정책으로 변환
- 기간/시간 컬럼 정규화

종료 조건:
- 19개 정책 row 적재 가능

### Phase 4. 정책-그룹 매핑 적재
목적:
- 정책과 그룹 연결 확정

작업:
- `적용 차량 그룹` 문자열 분리
- `price_policy_groups` 적재

종료 조건:
- 요금표 기준 34개 그룹명 전부 연결

### Phase 5. 가격 계산기 구현
목적:
- 검색에서 DB 정책만으로 가격 계산

작업:
- group lookup
- duration bucket 계산
- 주중/주말 day count 계산
- 시간/일 요금 분기

종료 조건:
- `price`, `discountPrice`, `deliveryPrice` 가 DB 공식으로 산출

### Phase 6. 샘플 검증
목적:
- 엑셀 기대값과 계산 결과 비교

검증 샘플:
- 24시간 평일
- 24시간 주말
- 3일 평일 시작
- 5일 주말 포함
- 8일 이상
- 1시간 / 6시간 / 12시간

종료 조건:
- 대표 샘플에서 엑셀 기준값과 계산값 일치

### Phase 7. 검색 연결 및 shadow 검증
목적:
- 기존 검색 응답에 실제 정책 반영

종료 조건:
- 검색 대표 쿼리에서 가격 오차 설명 가능
- 미매핑 그룹 0 또는 명시적 예외 목록화

## 리스크
- 시간 요금 `6시간`, `12시간` 이 실제 IMS에서 미사용일 수 있음
- `price` 정가 총액 정의가 UI 기대와 다르면 별도 조정 필요
- 그룹명 exact match 는 현재 기준으로는 가능하지만, 이후 명칭 변경 시 `ims_group_id` 검증이 필요

## 현재 판단
- 설계 잠금 가능
- 1차 import 준비 가능
- 구현 전 마지막 확인 포인트는 **IMS API로 `ims_group_id ↔ group_name` 최종 검증** 이다
