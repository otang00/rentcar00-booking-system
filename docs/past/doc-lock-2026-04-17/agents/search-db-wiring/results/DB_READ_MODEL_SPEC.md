# DB READ MODEL SPEC

## 결론
- 검색/상세 DB read model 의 가격 기준은 `car_prices` 가 아니라 **그룹 가격 정책**이다.
- canonical 가격 축은 아래 4단계다.
  1. `cars.source_group_id`
  2. `car_groups.ims_group_id`
  3. `v_active_group_price_policies`
  4. `calculateGroupPrice()`
- 검색 결과는 **그룹 대표 1건** 단위다.
- 상세도 동일한 그룹 정책 축을 사용한다.

## 현재 기준 테이블
### 검색/상세 기본 테이블
- `cars`
- `reservations`
- `delivery_regions`

### 가격 기준 테이블
- `car_groups`
- `price_policies`
- `price_policy_groups`
- `v_active_group_price_policies`

### shadow 비교 테이블
- `search_shadow_diffs`

## 가격 계산 기준
- 그룹 정책 조회: `server/search-db/repositories/fetchGroupPricePolicies.js`
- 가격 계산기: `server/search-db/pricing/calculateGroupPrice.js`
- 검색/상세 공통 적용: `server/search-db/pricing/buildAppliedGroupPricing.js`

## 검색 read model 기준
- 후보 차량 조회: `fetchCandidateCars.js`
- 예약 겹침 제외: `fetchBlockingReservations.js`
- 그룹 정책 조회: `fetchPriceRules.js` (이제 group-policy only)
- DTO 생성: `composeReadModel.js` → `mapDbCarsToDto.js`

## 상세 read model 기준
- API: `api/car-detail.js`
- 입력 검증: `server/search/searchState.js`
- DTO 생성: `server/detail/buildDbCarDetailDto.js`
- 가격 조립: `buildAppliedGroupPricing.js`

## 제거된 기준
아래는 현재 기준이 아니다.
- `car_prices`
- legacy car price seed
- 검색/상세 가격 fallback 구조
- partner HTML 기반 상세 가격 경로

## 주의
- 외부 응답 계약의 `carId` 는 아직 유지한다. 이것은 검색 카드에서 상세 진입 키로 사용된다.
- 내부 구현에서는 차량 식별과 그룹 식별을 구분해서 읽어야 한다.
  - `source_car_id`: 외부 차량 식별
  - `source_group_id`: 그룹 가격 시작 키
  - `ims_group_id`: 그룹 정책 조회 키

## 실행 원칙
- 검색/상세 응답 shape 를 먼저 깨지 않는다.
- 내부 구조를 group-policy only 로 정리한 뒤, 마지막에 legacy 문서/코드/seed 를 제거한다.
