# PRICE EXECUTION NEXT STEPS

## 목적
그룹 기준 가격 시스템을 실제 반영하기 위한 다음 실행 순서를 고정한다.

## 바로 다음 순서
### Step 1. migration 적용
- 대상: `20260415170000_create_group_based_pricing_tables.sql`
- 결과물
  - `car_groups`
  - `price_policies`
  - `price_policy_groups`
  - `v_active_group_price_policies`

### Step 2. import preview 생성
- 명령 예시
  - `node scripts/pricing/build-group-pricing-preview.js <group-list.xlsx> <group-cost.xlsx>`
- 결과물
  - `supabase/reference/group-pricing-preview.json`

### Step 3. ims_group_id 검증
- preview 에서 `imsGroupId = null` 인 그룹 확인
- IMS API 또는 기존 seed 기준으로 보강
- 종료 조건: unresolved 0

### Step 4. 실제 import 스크립트 작성
- preview JSON 기반으로
  - `car_groups upsert`
  - `price_policies upsert`
  - `price_policy_groups upsert`
- dry-run / apply 모드 분리 권장

### Step 5. 조회 연결
- `fetchGroupPricePolicies` 를 search-db 흐름에 연결
- 기존 `fetchPriceRules` 는 제거 대상 후보로 분리

### Step 6. 계산 연결
- `calculateGroupPrice` 를 `composeReadModel` 에 연결
- `dto.price`, `dto.discountPrice`, `dto.deliveryPrice` 산출

### Step 7. 검증
- `PRICE_VALIDATION_SCENARIOS_PRESENT.md` 기준 검증
- 대표 검색 쿼리 shadow 재실행

## 이번 phase 산출물
- preview builder: `scripts/pricing/build-group-pricing-preview.js`
- xlsx reader: `scripts/pricing/lib/readWorkbook.js`
- repository scaffold: `server/search-db/repositories/fetchGroupPricePolicies.js`
- calculator scaffold: `server/search-db/pricing/calculateGroupPrice.js`

## 주의
- 이번 단계에서는 아직 검색 흐름을 직접 바꾸지 않았다.
- 실제 연결 전 `ims_group_id` 미확정 그룹이 남아 있으면 import 를 밀지 않는다.
- `car_prices` 의 임시값은 새 가격 시스템 검증이 끝날 때까지 source of truth 로 취급하지 않는다.
