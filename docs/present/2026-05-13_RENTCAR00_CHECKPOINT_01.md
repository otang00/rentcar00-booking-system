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
- 검색용 truth 후보 값:
  - `base24h`
  - `hour_1_price`
  - `weekday_24h_price`
  - `weekend_24h_price`
  - `week_1_price`
  - `week_2_price`
  - `month_1_price`
- 현재 검색 코드는 아직 `v_active_group_price_policies` 를 읽는다.
- 현재 계산 코드는 아직 legacy `calculateGroupPrice.js` 구조다.

## 바로 다음 phase
### Phase 6. 조회 전환 설계
목적:
- `fetchGroupPricePolicies.js` 를 `v_search_pricing_hub_policies` 기준으로 전환할 준비를 끝낸다.

핵심 질문:
1. `effective_from / effective_to` 없는 새 view 를 현재 searchWindow 계약과 어떻게 맞출지
2. 조회 전환 시 보조 상태 컬럼을 같이 제거할지, 분리할지
3. 조회 전환과 계산식 변경을 어느 경계에서 분리할지

## 토의 체크포인트
1. search 조회는 당장 **새 view로만 교체**할지
2. 아니면 **compatibility adapter**를 한 번 둘지
3. `v_search_pricing_hub_policies` 에서 아래 컬럼을 바로 제거할지
   - `has_hub_common_rate`
   - `has_hub_weekday_rate`
   - `has_hub_weekend_rate`
   - `uses_anchor_fallback`
4. 계산식 반영 전 Phase 6 에서 필요한 최소 호환 컬럼을 어디까지 볼지

## 권장 다음 순서
1. 조회 전환 계약 잠금
2. 보조 상태 컬럼 제거 범위 잠금
3. Phase 6 실행 승인
4. 그 다음 Phase 7 계산식 설계/반영으로 이동

## 한 줄 결론
지금 체크포인트 기준으로는 **검산은 끝났고, 다음 토의 주제는 조회 전환 계약과 보조 컬럼 제거 범위**다.
