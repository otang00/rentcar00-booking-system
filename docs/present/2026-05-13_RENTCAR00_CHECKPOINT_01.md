# 2026-05-13 RENTCAR00 CHECKPOINT 01

## 문서 상태
- 상태: open checkpoint
- 목적: PRICING_HUB ↔ 자사플랫폼 검색 연결 작업의 현재 기준을 고정하고, 다음 구현 전 토의 포인트를 잠근다.

## 현재까지 잠긴 것
1. `v_search_pricing_hub_policies` view 는 remote DB 반영 완료.
2. weekday / weekend baseline 선행 current 는 종료.
3. 허브 baseline 은 아래 기준으로 재적용 완료.
   - `weekday = base24h -10%`
   - `weekend = base24h +15%`
   - 천원단위 올림 적용
4. `pricing_hub_rates` ↔ `v_search_pricing_hub_policies` ↔ 최신 검토 엑셀 33개 그룹 전수 검산 완료.
5. 현재 Phase 5 검산은 통과로 본다.

## 현재 truth
- 이제 search truth 는 후보가 아니라 아래 값으로 잠근다.
  - `base24h`
  - `hour_1_price`
  - `weekday_24h_price`
  - `weekend_24h_price`
  - `week_1_price`
  - `week_2_price`
  - `month_1_price`
- 위 값은 `v_search_pricing_hub_policies` 기준으로 search 와 계산이 함께 읽어야 한다.
- legacy bucket 컬럼은 더 이상 기준으로 보지 않는다.

## 바로 다음 phase
### Phase 6. 새 조회값 + 새 계산식 전환 설계
목적:
- `fetchGroupPricePolicies.js` 조회 source 와 `calculateGroupPrice.js` 계산 입력을 함께 새 계약으로 전환할 준비를 끝낸다.
- legacy passthrough / 임시 호환 컬럼 추가는 하지 않는다.

핵심 질문:
1. `v_search_pricing_hub_policies` 가 search 계산에 필요한 입력을 빠짐없이 제공하는지
2. `7일 미만`, `7~14일`, `15~30일`, `다음 1일 cap` 을 함수 구조로 어떻게 나눌지
3. 보조 상태 컬럼을 이 단계에서 바로 제거할지

## 토의 체크포인트
1. `fetchGroupPricePolicies.js` 를 새 view 기준으로 바꾸면서 반환 shape 를 어떻게 단순화할지
2. `calculateGroupPrice.js` 를 어떤 helper 구조로 쪼갤지
3. `v_search_pricing_hub_policies` 에서 아래 보조 상태 컬럼을 바로 제거할지
   - `has_hub_common_rate`
   - `has_hub_weekday_rate`
   - `has_hub_weekend_rate`
   - `uses_anchor_fallback`

## 이번 기준에서 버린 것
- legacy bucket 컬럼 재사용
- `effective_from / effective_to` 호환 맞추기
- passthrough / compatibility adapter / 임시 호환 컬럼 추가
- 조회만 먼저 바꾸고 계산은 나중에 바꾸는 2단 분리안

## Phase 6 진행계획
### Step 1. 입력 계약 잠금
- search 와 계산이 같이 읽을 입력값을 최종 확정한다.
- 기준 입력값:
  - `base24h`
  - `hour_1_price`
  - `weekday_24h_price`
  - `weekend_24h_price`
  - `week_1_price`
  - `week_2_price`
  - `month_1_price`

### Step 2. view 정리
- `v_search_pricing_hub_policies` 에서 search 계산에 필요 없는 과거 기준/보조 컬럼을 제거 대상 확정한다.
- search 계산에 필요한 컬럼만 남기는 방향으로 정리한다.

### Step 3. 조회 함수 교체
- `fetchGroupPricePolicies.js` 를 `v_search_pricing_hub_policies` 기준으로 교체한다.
- searchWindow 호환은 legacy 기간컬럼이 아니라 active period 선택 결과를 그대로 사용한다.

### Step 4. 계산식 교체
- `calculateGroupPrice.js` 를 `PRICING_FORMULA_CURRENT` 기준으로 새로 바꾼다.
- `7일 미만`, `7~14일`, `15~30일`, `다음 1일 cap` 을 새 입력값 기준으로 구현한다.

### Step 5. 검증
- 샘플 그룹 기준으로 search 결과와 검산표를 대조한다.
- 기존 결과 동일성 검증이 아니라 **새 공식 일치 여부**를 본다.

## 한 줄 결론
지금 체크포인트 기준으로는 **검산은 끝났고, 다음은 `v_search_pricing_hub_policies` 값과 새 계산식을 한 세트로 바로 연결하는 단계**다.
