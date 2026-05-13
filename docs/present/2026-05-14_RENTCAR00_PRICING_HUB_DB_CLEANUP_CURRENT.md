# 2026-05-14 RENTCAR00 PRICING HUB DB CLEANUP CURRENT

## 문서 상태
- 상태: completed current (to move past)
- 목적: admin 통합요금체제 개편 전에 pricing hub 관련 DB / view / dead code 정리 후보를 먼저 잠갔고, 실제 cleanup 반영까지 끝난 상태를 기록한다.

## 현재 판단 기준
이번 문서는 실제 코드 사용처를 기준으로 아래 3가지로 나눈다.
1. **즉시 삭제 가능 후보**
2. **코드 제거 후 삭제 후보**
3. **아직 유지해야 하는 대상**

판단 원칙:
- 문서상 존재가 아니라 **실제 런타임 사용처**를 기준으로 본다.
- search / reservation / admin 현재 경로에서 읽지 않으면 삭제 후보로 본다.
- 다만 remote DB에 이미 반영됐고, 운영 경로와 엮였을 가능성이 있으면 즉시 drop 하지 않는다.

## 현재 실사용 축
### search runtime
- `server/search-db/repositories/fetchGroupPricePolicies.js`
- `server/search-db/pricing/calculateGroupPrice.js`
- search source view: `v_search_pricing_hub_policies`

### admin runtime
- `api/admin/pricing-hub.js`
- `src/pages/AdminPricingHubPage.jsx`
- `src/services/adminPricingHubApi.js`
- admin source view: `v_pricing_hub_policy_editor`
- admin source tables:
  - `pricing_hub_periods`
  - `pricing_hub_rates`
  - `price_policy_groups`

## 1. 즉시 삭제 가능 후보
### 테이블
아래는 현재 코드 기준 direct 사용처가 없다.
- `pricing_hub_publishes`
- `pricing_hub_publish_items`
- `pricing_hub_channel_mappings`

판단:
- 현재 publish 기능 없음
- 채널 매핑 기능 없음
- admin / search 어느 경로에서도 사용 안 함

정리 원칙:
- drop migration 후보로 본다.
- 단, 실제 row 유무와 외부 수동 사용 여부는 drop 전 한 번 더 확인한다.

## 2. 코드 제거 후 삭제 후보
### 2-1. preview 기능 축
#### 테이블
- `pricing_hub_previews`
- `pricing_hub_preview_items`

#### API / service
- `POST /api/admin/pricing-hub?action=build-preview`
- `src/services/adminPricingHubApi.js` 의 `buildPricingHubPreview`

판단:
- DB와 API는 남아 있지만 현재 UI 호출처가 없다.
- 기능이 죽어 있으므로 먼저 dead code 제거 후 테이블 삭제가 안전하다.

정리 순서:
1. `build-preview` API 제거
2. service export 제거
3. 테이블 drop migration

### 2-2. override 기능 축
#### 테이블
- `pricing_hub_overrides`

#### API / service
- `fetchOverrides`
- `save-override`
- `savePricingHubOverride`

판단:
- 현재 admin 화면에 override 편집 UI가 없다.
- search 계산에도 override 적용이 없다.
- 사실상 dormant 구조다.

정리 순서:
1. admin 개편 방향에서 override를 계속 쓸지 먼저 결정
2. 안 쓰면 API/service 제거
3. 이후 table drop

## 3. 합치거나 슬림화할 후보
### 3-1. `v_search_pricing_hub_policies`
view 자체는 유지 대상이다.
다만 현재 search가 실제로 쓰는 컬럼만 남기도록 슬림화 후보로 본다.

#### search 실사용 컬럼
- `ims_group_id`
- `price_policy_id`
- `policy_name`
- `base24h`
- `hour_1_price`
- `weekday_24h_price`
- `weekend_24h_price`
- `week_1_price`
- `week_2_price`
- `month_1_price`

#### 미사용 보조 컬럼 후보
- `active_period_id`
- `active_period_name`
- `price_policy_group_id`
- `pricing_option_type`
- `has_hub_common_rate`
- `has_hub_weekday_rate`
- `has_hub_weekend_rate`
- `uses_anchor_fallback`
- `legacy_base_daily_price`
- `legacy_hour_1_price`
- `legacy_weekday_rate_percent`
- `legacy_weekend_rate_percent`
- `legacy_weekday_7d_plus_price`
- `legacy_weekend_7d_plus_price`

판단:
- search runtime 기준으로는 과잉 컬럼이다.
- view는 유지하되 출력 shape를 축소하는 것이 맞다.

### 3-2. admin 입력 구조
현재 admin 저장은 실제로 아래를 같이 저장한다.
- `price_policy_groups.pricing_option_type`
- `pricing_hub_rates(common/weekday/weekend)`

그러나 화면은 단일 편집 폼처럼 보인다.
따라서 향후 정리 방향은
- 퍼센트 중심 구조 축소
- 금액 truth 중심 구조로 단순화
를 우선 검토한다.

이 문서에서는 DB drop이 아니라 **운영 구조 슬림화 후보**로만 기록한다.

## 4. 현재 유지 대상
### 필수 view
- `v_pricing_hub_policy_editor`
- `v_search_pricing_hub_policies`

### 필수 table
- `pricing_hub_periods`
- `pricing_hub_rates`
- `price_policy_groups`
- `price_policies`
- `car_groups`

### 유지 이유
- admin list/editor/save 가 직접 사용한다.
- search 계산이 직접 사용한다.
- 현재 admin 계산은 아직 일부 legacy price_policy 컬럼에 의존한다.

## 5. 보류 대상
### `v_active_group_price_policies`
판단:
- 현재 앱 런타임 기준 직접 사용처는 보이지 않는다.
- 다만 legacy 운영 조회/수동 SQL/과거 스크립트 가능성은 남아 있다.

처리:
- 즉시 drop 금지
- 실제 참조 여부 추가 확인 후 후순위 정리 후보로 유지

### `price_policies` legacy 컬럼들
예:
- `hour_6_price`
- `hour_12_price`
- `weekday_1_2d_price`
- `weekday_3_4d_price`
- `weekday_5_6d_price`
- `weekend_1_2d_price`
- `weekend_3_4d_price`
- `weekend_5_6d_price`
- `effective_from`
- `effective_to`

판단:
- admin API가 아직 표시/비율/fallback 계산에 사용한다.
- admin 구조 개편 전 삭제하면 위험하다.

처리:
- admin 개편 후 재평가

## 정리 우선순위
### 1순위
- preview 계열 dead code + table 제거 여부 확정
- publish / channel mapping table 제거 여부 확정

### 2순위
- `v_search_pricing_hub_policies` 미사용 컬럼 제거

### 3순위
- override 기능 유지/삭제 결정
- `v_active_group_price_policies` 실제 참조 여부 재확인

### 4순위
- admin 개편 후 legacy 컬럼 축소 여부 판단

## 다음 phase
### Phase 1. 실데이터 확인 — 완료
- preview/publish/channel mapping/override 테이블 row 존재 여부 확인 완료
- `v_active_group_price_policies` 참조 가능성 1차 재확인 완료

### Phase 2. 삭제안 잠금 — 완료
- 1차/2차 drop 대상과 보류 대상을 확정했다.

### Phase 3. 실행 — 부분 완료
- 1차 cleanup 완료
  - `pricing_hub_publishes`
  - `pricing_hub_publish_items`
  - `pricing_hub_channel_mappings`
- 2차 cleanup 완료
  - `pricing_hub_overrides`
  - `pricing_hub_previews`
  - `pricing_hub_preview_items`
- 관련 dead code 제거 완료

### Phase 4. view 슬림화 준비
다음 정리 대상은 table 이 아니라 view shape 다.

#### 4-1. `v_search_pricing_hub_policies`
유지 대상이지만, search runtime 실사용 컬럼만 남기는 방향으로 슬림화한다.

##### 유지 후보 컬럼
- `ims_group_id`
- `price_policy_id`
- `policy_name`
- `base24h`
- `hour_1_price`
- `weekday_24h_price`
- `weekend_24h_price`
- `week_1_price`
- `week_2_price`
- `month_1_price`

##### 제거 후보 컬럼
- `active_period_id`
- `active_period_name`
- `price_policy_group_id`
- `pricing_option_type`
- `has_hub_common_rate`
- `has_hub_weekday_rate`
- `has_hub_weekend_rate`
- `uses_anchor_fallback`
- `legacy_base_daily_price`
- `legacy_hour_1_price`
- `legacy_weekday_rate_percent`
- `legacy_weekend_rate_percent`
- `legacy_weekday_7d_plus_price`
- `legacy_weekend_7d_plus_price`

#### 4-2. `v_active_group_price_policies`
- 현재 앱 코드 직접 참조는 보이지 않는다.
- 다만 legacy 운영 조회 가능성을 아직 배제하지 않는다.
- 따라서 다음 단계는 **즉시 drop이 아니라 최종 보류/삭제 판단 준비**로 본다.

#### 4-3. 실행 전 확인 포인트
1. `v_search_pricing_hub_policies` 의 보조 컬럼을 admin이나 수동 운영 SQL에서 쓰지 않는지
2. `v_active_group_price_policies` 를 외부 수동 조회 기준으로 여전히 쓰는지
3. view 슬림화 후 search 테스트 fixture 영향이 없는지

## 한 줄 결론
- pricing hub cleanup 은 실제 반영까지 완료됐다.
- 이 문서는 더 이상 active 실행 문서가 아니며, 다음 정리 시 `past/` 로 이동 대상이다.
