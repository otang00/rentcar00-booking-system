# EXECUTION MASTER PRESENT

## 목적
프리무브의 가격/검색/상세 구조를 **실행 가능한 기준**으로 다시 잠근다.
이 문서는 설명용 요약이 아니라, 다음 수정 phase들이 그대로 따를 실행 기준 문서다.

## 현재 기준점
- 브랜치: `feat/db-preview-home`
- 기준 커밋: `67334d3`
- active present 문서: 이 문서 1개만 사용

## 이번 실행의 최종 목표
아래 상태가 되면 이번 구조 정리 작업은 끝난다.

1. 가격 경로가 **group policy only** 로 설명 가능하다
2. `car_prices` 관련 legacy fallback 이 제거된다
3. 검색/상세가 같은 pricing 조립 규칙을 사용한다
4. ID 이름이 역할 기준으로 읽힌다
5. 문서와 코드 설명이 일치한다

## 현재 상태
- Phase 1 완료: 상세 입력 검증이 partner helper 에서 분리됨
- Phase 2 완료: 가격 경로가 group-policy only 로 전환됨
- Phase 3 완료: legacy `car_prices` 자산과 active 문서 참조가 정리됨

## 정답 구조
### 1. 가격 기준축
가격 계산의 기준 키는 차량 개별 id가 아니라 **그룹 id**다.

흐름:
1. 차량 row 조회
2. `cars.source_group_id` 확인
3. `v_active_group_price_policies.ims_group_id` 로 정책 조회
4. `calculateGroupPrice()` 로 가격 계산
5. 검색/상세 DTO에 pricing 반영

### 2. ID 역할
- `source_car_id`: 차량 식별 키, 검색 결과 `carId` 및 상세 진입 기준
- `source_group_id`: 차량이 속한 가격 계산 시작 키
- `ims_group_id`: 그룹 가격 정책 조회 키
- `car.id` (uuid): DB 내부 row 식별자, 외부 계약의 기준이 아님

### 3. 검색 결과 단위
검색 결과는 실차 전체 목록이 아니라 **그룹 대표 1건 단위**다.
같은 `source_group_id` 차량이 여러 대여도 검색 DTO는 대표 1건만 내려간다.

### 4. 가격 공식 기준
- 계산 엔진: `server/search-db/pricing/calculateGroupPrice.js`
- 시간 구간:
  - `<=1h`
  - `<=6h`
  - `<=12h`
  - `12h~24h fallback`
- 일 구간:
  - `1~2일`
  - `3~4일`
  - `5~6일`
  - `7일+`
- 주중/주말은 서울 시간 기준으로 계산
- `deliveryPrice` 는 `delivery_regions.round_trip_price` 별도 합산

### 5. 검색/상세의 올바른 책임 분리
- 검색: 차량 후보 조회 + 예약 충돌 제외 + 그룹 가격 계산 + 그룹 대표 DTO 생성
- 상세: 단일 차량 조회 + 동일 그룹 가격 계산 규칙 적용 + 상세 DTO 생성
- 즉 가격 계산 규칙은 검색/상세가 따로 가지면 안 되고, 같은 정책 축을 써야 한다.

## 현재 코드와 맞는 사실
### 검색
- `/api/search-cars` 는 `dbSearchService.run()` 만 사용
- 후보 차량은 `cars` 테이블에서 조회
- 가격 조회는 `fetchPriceRules()` 를 통해 group policy 만 읽는다
- DTO는 `carId=source_car_id`, `groupId=source_group_id`
- 그룹 dedupe 가 있어 그룹 대표 1건만 반환

### 상세
- `buildDbCarDetailDto()` 는 `cars` 테이블에서 차량 1건 조회
- 입력 검증은 `server/search/searchState.js` 를 사용한다
- 가격 조회는 검색과 동일하게 `fetchPriceRules()` 를 사용한다
- `source_group_id` 기반으로 정책을 찾고 공통 pricing builder 로 계산한다
- `meta.groupId` 는 `source_group_id`

## 현재 확인 범위
### 확인 완료
- 검색 API 경로
- 상세 DTO 생성 경로
- 가격 계산기
- 그룹 정책 조회 경로
- 검색 DTO 그룹 dedupe 테스트
- 검색 DB 서비스 테스트

### 다음 phase에서 추가 확인 필요
- 검색 프론트 전체 렌더 의존 필드
- 상세 프론트 전체 렌더 의존 필드
- 검색 → 상세 이동 계약 전체
- legacy 문서 전수 정리 범위

## 구조 문제의 핵심
### 문제 1. 이름이 역할을 충분히 드러내지 못함
`carId`, `groupId`, `priceRules` 같은 이름만 보면
- 차량 식별 키인지
- 그룹 정책 키인지
- legacy 포함 조회 결과인지
한 번에 안 보인다.

### 문제 2. 검색/상세 pricing 조립이 분산
- 검색: `mapDbCarsToDto.js`
- 상세: `buildDbCarDetailDto.js`
같은 가격 규칙이 두 군데서 따로 조립되던 구조는 공통 builder 로 정리했다.

## 유지 / 제거 / 변경 기준
### 유지
- `source_group_id -> ims_group_id -> group policy -> calculateGroupPrice()` 축
- `fetchGroupPricePolicies.js`
- `calculateGroupPrice.js`
- delivery region 별도 합산 구조

### 제거 완료
- `car_prices` fallback 경로
- `scripts/build-car-price-seed.js`
- `supabase/migrations/20260415013000_create_car_prices_and_shadow_diffs.sql`
- `supabase/seed.sql` 내 `car_prices` seed
- active 문서의 `car_prices` 기준 설명

### 리네임 대상
- `fetchPriceRules` -> 그룹 정책 전용 의미 이름으로 분리 필요
- 내부 변수명도 역할 기준으로 분리 필요
  - `vehicleId`
  - `sourceCarId`
  - `sourceGroupId`
  - `imsGroupId`
  - `groupPricingPolicy`

### 공통화 대상
- 검색/상세 공통 pricing builder
- 가격 컨텍스트 조회 결과 shape
- meta/pricing source 표기 규칙

## 실행 phase 결과
### Phase 1. partner 경계 정리
- `api/car-detail.js` 가 `server/search/searchState.js` 를 사용하도록 변경
- detail 검증 로직이 partner helper 위치 의존에서 분리됨

### Phase 2. 가격 엔진 단일화
- `fetchPriceRules()` 를 group-policy only 조회로 변경
- 검색/상세 공통 pricing builder `buildAppliedGroupPricing.js` 추가
- 검색 DTO와 상세 DTO가 같은 계산 기준을 사용

### Phase 3. legacy 삭제와 문서 정리
- legacy price seed 제거
- `car_prices` migration 제거 후 shadow diff migration 분리
- active 문서와 agent 결과 문서 기준 업데이트

## 실행 원칙
1. 점검 phase 후에만 구조 변경 phase로 넘어간다
2. 한 phase에는 한 종류의 변경만 넣는다
3. legacy 삭제는 마지막 phase에서만 한다
4. 각 phase는 검증 후 종료한다

## 최종 검증 기준
- 검색 가격은 group policy 만으로 계산된다
- 상세 가격도 같은 builder 를 사용한다
- 검색 결과는 그룹 대표 1건만 반환한다
- 상세 입력 검증은 partner helper 와 분리되었다
- active 문서에는 `car_prices` 가 현재 기준처럼 남아 있지 않다

## 이번 문서의 역할
이 문서는 이번 3단계 실행 결과를 잠근 기준점이다.
이후 변경은 이 문서를 기준으로만 판단한다.
