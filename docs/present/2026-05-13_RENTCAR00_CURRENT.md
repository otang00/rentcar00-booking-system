# 2026-05-13 RENTCAR00 CURRENT

## 문서 상태
- 상태: active current
- 목적: 현재 실제 최우선 작업을 짧고 명확하게 잠근다.

## 현재 작업명
- **PRICING_HUB ↔ 자사플랫폼 검색 연결 작업**

## 현재 최우선 작업
- 장기 PRICING_HUB 정책을 새로 정의하는 것이 아니라,
- **PRICING_HUB에 담길 가격 구조를 자사플랫폼 검색 계산 경로에 연결하는 작업**을 진행한다.

## 작업 전제
1. 장기 PRICING_HUB 기준은 `docs/policies/RENTCAR00_PRICING_HUB.md` 에서 관리한다.
2. 이번 current 는 허브 자체 구축 문서가 아니라 **허브와 자사플랫폼 검색을 연결하는 실행 문서**다.
3. IMS publish, 찜카 publish, 장기 멀티채널 완성은 이번 current 범위 밖이다.
4. 이번 작업의 직접 대상은 **자사플랫폼 검색 가격 source / 계산식 / 연결 경로**다.

## 연결 문서
- 계산식 최종 결정안:
  - `docs/present/2026-05-13_RENTCAR00_PRICING_FORMULA_CURRENT.md`
- weekday / weekend baseline 선행 current:
  - `docs/present/2026-05-13_RENTCAR00_PRICING_HUB_WEEKDAY_WEEKEND_BASELINE_CURRENT.md`
- 장기 허브 정책:
  - `docs/policies/RENTCAR00_PRICING_HUB.md`
- 장기 월요금 source 참고:
  - `docs/present/2026-05-01_RENTCAR00_PRICING_HUB_MONTHLY_SOURCE_CURRENT.md`

## 현재 진행 정리
### 지금까지 완료한 것
1. Phase 1~3 기준 정리와 설계 잠금은 current 문서에 반영됐다.
2. `v_search_pricing_hub_policies` migration 을 작성하고 원격 DB에 반영했다.
3. 반영 후 `supabase db push --linked --dry-run` 으로 remote DB up to date 상태를 재확인했다.
4. weekday / weekend baseline 선행 current 를 별도로 진행해 기준을 다시 잠갔다.
5. `weekday -10%`, `weekend +15%` 기준으로 허브 baseline 재적용과 천원단위 올림 반영까지 마쳤다.
6. 검토용 엑셀 재업로드까지 마쳤다.

### 현재 완료 상태에서 truth
- DB 에는 `v_search_pricing_hub_policies` view 가 존재한다.
- 검색 조회 코드는 아직 `v_active_group_price_policies` 를 읽는다.
- 검색 계산 코드는 아직 legacy `calculateGroupPrice.js` 공식을 사용한다.
- 즉 **DB 준비만 끝났고, 검색 연결/계산식 변경은 아직 시작 전**이다.

### 이번 current 에서 아직 미실행인 것
- `fetchGroupPricePolicies.js` 전환
- `calculateGroupPrice.js` 계산식 개편
- admin / preview / search 의미 정렬
- 샘플 그룹 기준 검산 및 테스트 재구성
- `v_search_pricing_hub_policies` 보조 상태 컬럼 제거

## 현재 확인된 현행 구조
### 검색 current source
- `price_policies`
- `price_policy_groups`
- `v_active_group_price_policies`
- `server/search-db/repositories/fetchGroupPricePolicies.js`
- `server/search-db/pricing/calculateGroupPrice.js`

### 허브 current source
- `pricing_hub_periods`
- `pricing_hub_rates`
- `pricing_hub_overrides`
- `api/admin/pricing-hub.js`
- `v_search_pricing_hub_policies`

### 현행 판단
1. 검색 계산은 아직 legacy 가격 경로를 읽는다.
2. PRICING_HUB 저장 구조와 검색용 새 view 는 준비됐지만, 검색 계산 source로 아직 직접 연결되지는 않았다.
3. 따라서 지금부터의 핵심은 **준비된 허브 값을 어떤 순서로 검산하고, 어떻게 조회/계산식에 연결할지 구조를 잠그는 것**이다.

## phase 로드맵
### 완료된 phase
#### Phase 1. 연결 기준 잠금 — 완료
- 이번 작업을 `PRICING_HUB ↔ 자사플랫폼 검색 연결 작업`으로 명시했다.
- 검색 계산에 필요한 입력값 범위를 잠갔다.

#### Phase 2. 현행 구조 대비표 작성 — 완료
- 검색 source / 허브 source / 공식 기준 필요값 대비를 정리했다.

#### Phase 3. 목표 연결 구조 설계 — 완료
- 검색 전용 view `v_search_pricing_hub_policies` 구조를 확정했다.
- active period / rate scope / anchor fallback 원칙을 잠갔다.

#### Phase 4. DB 스키마/뷰 반영 — 완료
- 새 view migration 을 작성했다.
- 원격 DB 반영과 dry-run 재검증까지 끝냈다.

### 앞으로 진행할 phase
#### Phase 5. 허브 값 검산 구조 확정 — 완료
- 샘플 그룹 기준 검산 완료
- 전체 33개 그룹 전수 검산 완료
- `pricing_hub_rates` / `v_search_pricing_hub_policies` / 최신 엑셀 기준 일치 확인 완료
- search 입력 truth 후보 값 잠금 완료

#### Phase 6. 검색 조회 전환 구조 설계
- `fetchGroupPricePolicies.js` 를 어떤 방식으로 새 view 로 바꿀지 정한다.
- legacy fallback 유지 여부와 중단 조건을 잠근다.
- 계산식 반영 전까지 필요한 호환 범위를 판단한다.

#### Phase 7. 계산식 반영 설계
- `PRICING_FORMULA_CURRENT` 기준으로 `calculateGroupPrice.js` 교체 구조를 설계한다.
- `7일 미만`, `7~14일`, `15~30일`, `다음 1일 cap` 케이스를 함수 단위로 정리한다.
- 입력 컬럼과 계산 결과 필드를 명확히 매핑한다.

#### Phase 8. admin / preview / search 정렬 설계
- 운영 입력값, preview 결과, search 계산 결과의 의미를 맞춘다.
- `week_1 / week_2 / month_1` 해석 차이가 없는지 잠근다.

#### Phase 9. 검증/반영 실행 계획
- 테스트 묶음, 샘플 검산표, 반영 순서, 중단 조건을 고정한다.
- 실행 전 어떤 증거가 있어야 통과인지 잠근다.

## phase별 종료 조건
1. **Phase 1**: 이번 작업 범위와 입력값 목록이 흔들리지 않는다.
2. **Phase 2**: 필요값 대비 현행 DB 보유값과 부족값이 표로 보인다.
3. **Phase 3**: 검색 연결 목표 구조를 설명할 수 있다.
4. **Phase 4**: 허브 값을 읽는 DB 경로가 준비되고 remote DB 반영 확인까지 끝난다.
5. **Phase 5**: 샘플 허브 값이 신뢰 가능하고 search 입력 truth 가 숫자로 잠긴다. — 완료
6. **Phase 6**: 조회 전환 방식과 fallback/중단 조건을 설명할 수 있다.
7. **Phase 7**: 공식 계산식을 코드 구조로 바꾸기 전 함수/케이스/입력 매핑 설계가 잠긴다.
8. **Phase 8**: admin / preview / 검색 의미 차이가 없다고 설명할 수 있다.
9. **Phase 9**: 운영 반영 전 검증 기준, 실행 순서, 중단 조건이 모두 잠긴다.

## Phase 2 결과
### 2-1. 현행 source 분리 상태
- 검색 계산 truth:
  - `price_policies`
  - `v_active_group_price_policies`
- 허브 저장 truth:
  - `pricing_hub_periods`
  - `pricing_hub_rates`
- 현재 구조상 검색 계산은 `pricing_hub_rates` 를 직접 읽지 않는다.

### 2-2. 필요 입력값 대비표
| 항목 | 공식 기준 필요 여부 | 현행 검색 source | 허브 source | 판단 |
| --- | --- | --- | --- | --- |
| `base24h` | 필요 | `price_policies.base_daily_price` | `pricing_hub_rates.fee_24h` | 양쪽 모두 가능 |
| 주중/주말 기준값 | 필요 | `weekday_rate_percent`, `weekend_rate_percent` + bucket day price | `rate_scope=weekday/weekend` 의 `fee_24h` | 허브 쪽은 비율이 아니라 값 중심이라 해석 규칙 필요 |
| `1h` 값 | 필요 | `hour_1_price` | `fee_1h` | 양쪽 모두 가능 |
| `7일` 기준값 | 필요 | 없음 (`7d+` 일당만 있음) | `week_1_price` | 허브 기준으로 읽어야 함 |
| `14일` 기준값 | 필요 | 없음 | `week_2_price` | 허브 기준으로 읽어야 함 |
| `30일` 기준값 | 필요 | 없음 | `month_1_price` | 허브 기준으로 읽어야 함 |
| `7+ daily` 증분 | 필요 | 없음 | 없음 | 현재는 코드 상수로 둘지, 허브 값으로 뺄지 결정 필요 |
| `14+ daily` 증분 | 필요 | 없음 | 없음 | 현재는 코드 상수로 둘지, 허브 값으로 뺄지 결정 필요 |
| `1~2일 / 3~4일 / 5~6일` 가중치 | 필요 | legacy 일당 가격으로만 간접 보유 | 없음 | 현재 공식 기준에선 코드 상수 처리 가능 |
| 다음 1일 cap 계산 기준 | 필요 | 없음 | 없음 | 계산 로직에서 구현 필요 |

### 2-3. 현행 구조 판단
1. 검색 계산은 아직 `7일 / 14일 / 30일` anchor 구조가 아니라 `7d+` 일당 반복 구조다.
2. 허브는 `7일 / 14일 / 30일` 값을 저장할 수 있지만 검색은 아직 그 값을 읽지 않는다.
3. 새 공식을 검색에 반영하려면 `pricing_hub_rates` 쪽 값을 검색 source 로 연결하는 DB 경로가 먼저 필요하다.
4. 특히 `14일`, `30일`, 증분값, cap 계산 기준은 legacy source 만으로는 공식 반영이 어렵다.

### 2-4. Phase 3 진입 전 결정 초안
1. 검색이 읽을 기준 source 는 `pricing_hub_rates` 중심으로 옮긴다.
2. `6h`, `12h` 값은 검색 연결 목표 구조에서 제거한다.
3. `7+ daily`, `14+ daily` 증분은 허브 저장값으로 늘리지 않고, 코드 안의 **수정 가능한 정책 변수**로 둔다.
4. 검색 연결 경로는 기존 legacy view 를 바로 뜯지 않고, **검색 전용 새 view** 를 만든다.

### 2-5. 새 view 설계 기준 초안
- 가칭: `v_search_pricing_hub_policies`
- 역할: PRICING_HUB 값을 자사플랫폼 검색 계산이 바로 읽을 수 있게 만든 검색 전용 read model
- 기존 `v_active_group_price_policies` 는 유지한다.

새 view 에 우선 포함할 값:
- 식별값: `ims_group_id`, `group_name`, `car_group_id`, `price_policy_id`, `policy_name`
- 허브 기준값: `base24h`, `weekday_24h_price`, `weekend_24h_price`, `hour_1_price`, `week_1_price`, `week_2_price`, `month_1_price`
- 검증용 legacy 값: `legacy_base_daily_price`, `legacy_weekday_rate_percent`, `legacy_weekend_rate_percent`, `legacy_weekday_7d_plus_price`, `legacy_weekend_7d_plus_price`
- 코드 정책 변수(`WEEK1_DAILY_INCREMENT_RATE`, `WEEK2_DAILY_INCREMENT_RATE`, cap 관련 변수`)는 **view 컬럼이 아니라 계산 코드 상수/변수 영역**으로 관리한다.

### 2-6. anchor / 증분 처리 원칙
1. `week_1_price`, `week_2_price`, `month_1_price` 는 기본적으로 허브 값을 우선 사용한다.
2. 허브 anchor 값이 비어 있으면 문서에 잠근 공식 기준값으로 계산한다.
   - `7일 = base24h * 5.50`
   - `14일 = base24h * 8.00`
   - `30일 = base24h * 12.00`
3. `7+ daily`, `14+ daily` 증분은 DB 값이 아니라 코드의 수정 가능한 정책 변수로 계산한다.
4. 즉 **anchor 값은 DB**, **증분 규칙은 코드 변수**로 잠근다.

## Phase 3 설계 확정안
### 3-1. 새 view 이름과 역할
- view 이름: `v_search_pricing_hub_policies`
- 역할: PRICING_HUB 값을 자사플랫폼 검색 계산이 바로 읽을 수 있게 만든 검색 전용 read model
- 원칙: 기존 `v_active_group_price_policies` 는 유지하고, 검색 연결 전환은 새 view 기준으로 진행한다.

### 3-2. 새 view 기준 테이블 연결
1. `price_policy_groups`
   - 그룹과 정책의 기본 연결 source
2. `car_groups`
   - `ims_group_id`, `group_name`, `car_group_id` 제공
3. `price_policies`
   - legacy 비교값과 기존 정책 식별값 제공
4. `pricing_hub_periods`
   - `price_policy_id` 기준으로 연결
   - 검색 계산에 사용할 허브 period 선택 source
5. `pricing_hub_rates`
   - `pricing_hub_period_id` 기준으로 연결
   - `rate_scope = common / weekday / weekend` 값을 검색용 컬럼으로 펼친다.

### 3-3. 검색이 실제로 읽을 컬럼
#### 식별 컬럼
- `ims_group_id`
- `group_name`
- `car_group_id`
- `price_policy_id`
- `policy_name`

#### 허브 기준 계산 컬럼
- `base24h`
  - 우선값: `common.fee_24h`
  - fallback: `price_policies.base_daily_price`
- `hour_1_price`
  - 우선값: `common.fee_1h`
  - fallback: `price_policies.hour_1_price`
- `weekday_24h_price`
  - 우선값: `weekday.fee_24h`
  - fallback: `base24h`
- `weekend_24h_price`
  - 우선값: `weekend.fee_24h`
  - fallback: `base24h`
- `week_1_price`
  - 우선값: `common.week_1_price`
  - fallback: `base24h * 5.50`
- `week_2_price`
  - 우선값: `common.week_2_price`
  - fallback: `base24h * 8.00`
- `month_1_price`
  - 우선값: `common.month_1_price`
  - fallback: `base24h * 12.00`

#### 상태/검증 컬럼
- `active_period_id`
- `active_period_name`
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

### 3-4. period 선택 규칙
- `pricing_hub_periods.active = true` 인 row 만 대상
- `price_policy_id` 가 현재 정책과 연결된 row 만 대상
- 이번 검색 연결 1차 범위에서는 `apply_mon ~ apply_sun` 요일 플래그는 사용하지 않고, `start_at ~ end_at` 유효기간만 본다.
- period 가 여러 개면 아래 순서로 1개를 고른다.
  1. `start_at`, `end_at` 기준 현재 시점 포함 row 우선
  2. 여러 개면 `created_at` 최신 row 우선
- 즉 검색은 정책별로 **현재 시점에 유효한 period 1개**만 읽는다.

### 3-5. rate scope 해석 규칙
- `rate_scope = common`
  - `base24h`, `hour_1_price`, `week_1_price`, `week_2_price`, `month_1_price` source
- `rate_scope = weekday`
  - `weekday_24h_price` source
- `rate_scope = weekend`
  - `weekend_24h_price` source
- `6h`, `12h` 관련 컬럼은 새 검색 연결 구조에서 사용하지 않는다.

### 3-6. anchor / fallback 규칙
1. `7일`, `14일`, `30일` anchor 는 허브 값을 우선 사용한다.
2. 허브 anchor 값이 비어 있으면 아래 기준으로 수치화한다.
   - `week_1_price = round(base24h * 5.50)`
   - `week_2_price = round(base24h * 8.00)`
   - `month_1_price = round(base24h * 12.00)`
3. 이 fallback 은 검색 제외가 아니라 **공식 기준 수치 fallback** 이다.
4. 증분값은 view 에 넣지 않고 계산 코드의 정책 변수로 관리한다.

### 3-7. SQL 초안 구조
```sql
create or replace view public.v_search_pricing_hub_policies as
with ranked_periods as (
  select
    php.*,
    row_number() over (
      partition by php.price_policy_id
      order by
        case
          when (php.start_at is null or php.start_at <= now())
           and (php.end_at is null or php.end_at >= now())
          then 0 else 1
        end,
        php.created_at desc
    ) as rn
  from public.pricing_hub_periods php
  where php.active = true
),
active_periods as (
  select *
  from ranked_periods
  where rn = 1
),
common_rates as (
  select * from public.pricing_hub_rates where rate_scope = 'common'
),
weekday_rates as (
  select * from public.pricing_hub_rates where rate_scope = 'weekday'
),
weekend_rates as (
  select * from public.pricing_hub_rates where rate_scope = 'weekend'
)
select
  cg.ims_group_id,
  cg.group_name,
  cg.id as car_group_id,
  pp.id as price_policy_id,
  pp.policy_name,
  ap.id as active_period_id,
  ap.period_name as active_period_name,
  coalesce(cr.fee_24h, pp.base_daily_price) as base24h,
  coalesce(cr.fee_1h, pp.hour_1_price) as hour_1_price,
  coalesce(wdr.fee_24h, coalesce(cr.fee_24h, pp.base_daily_price)) as weekday_24h_price,
  coalesce(wer.fee_24h, coalesce(cr.fee_24h, pp.base_daily_price)) as weekend_24h_price,
  coalesce(cr.week_1_price, round((coalesce(cr.fee_24h, pp.base_daily_price) * 5.50)::numeric)) as week_1_price,
  coalesce(cr.week_2_price, round((coalesce(cr.fee_24h, pp.base_daily_price) * 8.00)::numeric)) as week_2_price,
  coalesce(cr.month_1_price, round((coalesce(cr.fee_24h, pp.base_daily_price) * 12.00)::numeric)) as month_1_price,
  (cr.id is not null) as has_hub_common_rate,
  (wdr.id is not null) as has_hub_weekday_rate,
  (wer.id is not null) as has_hub_weekend_rate,
  (cr.week_1_price is null or cr.week_2_price is null or cr.month_1_price is null) as uses_anchor_fallback,
  pp.base_daily_price as legacy_base_daily_price,
  pp.hour_1_price as legacy_hour_1_price,
  pp.weekday_rate_percent as legacy_weekday_rate_percent,
  pp.weekend_rate_percent as legacy_weekend_rate_percent,
  pp.weekday_7d_plus_price as legacy_weekday_7d_plus_price,
  pp.weekend_7d_plus_price as legacy_weekend_7d_plus_price
from public.price_policy_groups ppg
join public.car_groups cg on cg.id = ppg.car_group_id
join public.price_policies pp on pp.id = ppg.price_policy_id
left join active_periods ap on ap.price_policy_id = pp.id
left join common_rates cr on cr.pricing_hub_period_id = ap.id
left join weekday_rates wdr on wdr.pricing_hub_period_id = ap.id
left join weekend_rates wer on wer.pricing_hub_period_id = ap.id
where pp.active = true
  and ppg.active = true
  and cg.active = true;
```

### 3-8. Phase 4 입력으로 넘길 항목
- migration 에 새 view 추가
- 필요 시 `has_hub_*`, `uses_anchor_fallback` 보조 컬럼 포함
- `fetchGroupPricePolicies.js` 가 이 view 를 읽도록 교체 준비
- 테스트 fixture 는 common / weekday / weekend rate 3종 케이스로 준비

## 다음 진행 원칙
### 순서 고정
1. current 문서에 현재 상태와 다음 구조를 먼저 반영한다.
2. 다음 phase의 목적 / 입력값 / 종료조건 / 중단조건을 잠근다.
3. 필요한 설계안을 current 기준에 맞춰 정리한다.
4. 문서를 다시 잠그고 검토한다.
5. 그 다음에만 해당 phase 실행 여부를 승인받는다.
6. 승인된 phase만 실행한다.

### 지금 시점에서 실행 금지인 것
- `fetchGroupPricePolicies.js` 전환
- `calculateGroupPrice.js` 계산식 변경
- admin / preview 의미 변경
- 테스트 fixture 대규모 교체

## Phase 5 준비안 — 허브 값 검산 기준 잠금
### 5-1. 목적
- `v_search_pricing_hub_policies` 에 담긴 값이 실제 search 입력 truth 로 써도 되는지 숫자로 검산한다.
- admin 에서 보이는 값과 DB view 값의 의미 차이를 먼저 잠근다.

### 5-2. 현재 확인된 코드 기준
1. search 조회는 아직 `fetchGroupPricePolicies.js` 에서 `v_active_group_price_policies` 만 읽는다.
2. search 계산은 아직 `calculateGroupPrice.js` 에서 legacy 컬럼(`weekday_1_2d_price`, `weekday_7d_plus_price`, `hour_6_price`, `hour_12_price`)을 직접 사용한다.
3. admin editor 는 `buildEditorState()` 기준으로 `base24h`, `weekday24h`, `weekend24h`, `weekdayPercent`, `weekendPercent` 를 계산해 보여준다.
4. admin preview 는 legacy before 값과 hub after 값(`periods`, `rates`, `overrides`) diff 를 저장하지만, search 계산 결과를 직접 보여주지는 않는다.

### 5-3. 검산 대상 값
- `base24h`
- `hour_1_price`
- `weekday_24h_price`
- `weekend_24h_price`
- `week_1_price`
- `week_2_price`
- `month_1_price`
- `active_period_id`
- `active_period_name`
- `has_hub_common_rate`
- `has_hub_weekday_rate`
- `has_hub_weekend_rate`
- `uses_anchor_fallback`

### 5-4. 검산 비교표 source
- source A: `pricing_hub_rates`
- source B: `v_search_pricing_hub_policies`
- source C: admin editor 의 `base24h / weekday24h / weekend24h / weekdayPercent / weekendPercent`
- source D: preview 의 `before_json / after_json / diff_json`

### 5-5. 검산 샘플 기준
- 샘플은 최소 3개 그룹으로 잡는다.
  1. common / weekday / weekend rate 가 모두 있는 그룹
  2. common 만 있고 weekday / weekend 가 없는 그룹
  3. anchor(`week_1 / week_2 / month_1`) 일부가 비어 fallback 이 켜지는 그룹
- 각 샘플마다 아래를 표로 남긴다.
  - DB 원본값
  - view 노출값
  - admin 표시값
  - 해석 결과

### 5-6. Phase 5 종료 조건
- 어떤 값을 search truth 로 쓸지 컬럼별로 잠긴다.
- `weekday24h / weekend24h` 를 금액으로 볼지 비율 환산 결과로 볼지 해석이 잠긴다.
- preview 는 검산 보조 증거일 뿐 search 계산 결과가 아니라는 점이 명시된다.

### 5-7. Phase 5 중단 조건
- admin 값과 view 값이 같은 이름인데 뜻이 다르면 즉시 중단
- active period 선택 결과가 admin 과 view 에서 다르면 즉시 중단
- fallback 이 켜진 그룹에서 기대값이 문서 공식과 다르면 즉시 중단

## Phase 6 준비안 — 검색 조회 전환 구조 설계
### 6-1. 목적
- `fetchGroupPricePolicies.js` 를 새 view 기준으로 바꿀 때 필요한 호환 범위와 중단 조건을 먼저 잠근다.

### 6-2. 현재 확인된 코드 기준
1. 현재 조회 코드는 `v_active_group_price_policies` 를 `.select('*')` 로 읽는다.
2. 조회 후 `overlapsWindow()` 에서 `effective_from`, `effective_to` 로 search window 필터를 한 번 더 건다.
3. 새 view 초안에는 현재 `effective_from`, `effective_to` 가 없다.
4. 따라서 단순 view 이름 교체만 하면 현재 기간 필터 계약이 깨질 수 있다.

### 6-3. Phase 6 설계 질문
- 옵션 A: 새 view 에 `effective_from`, `effective_to` 호환 컬럼을 추가할지
- 옵션 B: `fetchGroupPricePolicies.js` 의 기간 필터를 active period 기준으로 새로 바꿀지
- 옵션 C: 조회 전환 전 임시 compatibility adapter 를 둘지

### 6-4. 추천 방향
- 1차 추천은 **조회 코드에서 새 view 전용 계약을 명시적으로 다시 정의**하는 것이다.
- 이유:
  1. 새 view 는 legacy 정책 기간이 아니라 hub active period 선택 구조를 전제로 한다.
  2. 억지로 legacy `effective_from/effective_to` 를 흉내 내면 의미가 섞일 수 있다.
  3. 대신 조회 코드에서 `active_period_id`, `active_period_name`, hub 기준 컬럼을 읽는 계약으로 전환하는 편이 장기적으로 안전하다.

### 6-5. 조회 전환 시 최소 호환 체크포인트
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
- `active_period_id`
- `active_period_name`
- fallback / 상태 플래그

### 6-6. Phase 6 종료 조건
- 조회 전환안이 1개로 잠긴다.
- 기존 `overlapsWindow()` 계약을 유지/대체/삭제 중 무엇으로 갈지 명시된다.
- 조회 전환 전 필요한 compatibility 항목이 표로 잠긴다.

### 6-7. Phase 6 중단 조건
- 기간 필터 의미가 legacy 와 hub 에서 다르면 즉시 중단
- 새 view 로는 현행 searchWindow 계약을 설명할 수 없으면 즉시 중단
- 조회 전환만으로 계산 코드가 같이 깨질 가능성이 높으면 즉시 중단

## Phase 7 준비안 — 계산식 반영 설계 잠금
### 7-1. 목적
- `calculateGroupPrice.js` 를 공식 기준으로 교체하기 전에 함수 구조, 입력 컬럼, 케이스 분해를 먼저 잠근다.

### 7-2. 현재 확인된 코드 기준
1. 현재 `getBucket()` 은 `hour_1 / hour_6 / hour_12 / hour_12_plus / days_1_2 / days_3_4 / days_5_6 / days_7_plus` 구조다.
2. 현재 `calculateDailyPrice()` 는 legacy 일당 컬럼을 직접 더한다.
3. 현재 `7일 이상` 구간도 `weekday_7d_plus_price / weekend_7d_plus_price` 반복 구조다.
4. 따라서 공식 기준 반영은 기존 버킷 값 교체 수준이 아니라 **계산 구조 자체의 교체**다.

### 7-3. 계산식 입력 계약 초안
- `base24h`
- `weekday_24h_price`
- `weekend_24h_price`
- `hour_1_price`
- `week_1_price`
- `week_2_price`
- `month_1_price`
- 정책 상수
  - `SHORT_HOURLY_RATE = 0.12`
  - `DAYS_1_2_WEIGHT = 1.00`
  - `DAYS_3_4_WEIGHT = 0.90`
  - `DAYS_5_6_WEIGHT = 0.85`
  - `WEEK1_DAILY_INCREMENT_RATE = 0.50`
  - `WEEK2_DAILY_INCREMENT_RATE = 0.35`

### 7-4. 함수 분해 초안
1. `calculateShortRentalPrice()`
   - 대상: `7일 미만`
   - 역할: 실제 날짜 순회 + 주중/주말 금액 합산 + 추가시간 + 다음 1일 cap
2. `calculateWeek1To2AnchorPrice()`
   - 대상: `7~14일`
   - 역할: `week_1_price` anchor 와 `week_2_price` cap 사이를 `0.50` 증분으로 계산
3. `calculateWeek2ToMonthAnchorPrice()`
   - 대상: `15~30일`
   - 역할: `week_2_price` anchor 와 `month_1_price` cap 사이를 `0.35` 증분으로 계산
4. `calculateNextDayCapPrice()`
   - 역할: `days + hours` 케이스를 `days + 1` 가격과 비교
5. `selectPricingStrategy()`
   - 역할: 총 대여시간/일수에 따라 단기 / 7~14일 / 15~30일 계산 경로를 분기

### 7-5. 설계 메모
- 문서 공식은 `weekdayRate`, `weekendRate` 비율 표현을 쓰지만, 새 view 는 이미 `weekday_24h_price`, `weekend_24h_price` 금액을 준다.
- 따라서 실제 코드 반영 시에는 **비율 재계산보다 금액 컬럼 직접 사용**이 우선이다.
- admin 에서 필요한 경우에만 `weekdayPercent`, `weekendPercent` 는 파생값으로 유지한다.
- `hour_6_price`, `hour_12_price`, `weekday_1_2d_price`, `weekend_7d_plus_price` 등 legacy 컬럼은 새 계산식의 truth 로 쓰지 않는다.

### 7-6. Phase 7 종료 조건
- 기존 버킷 구조를 무엇으로 치환할지 함수 단위로 설명 가능하다.
- 입력 컬럼과 정책 상수가 잠긴다.
- `다음 1일 cap` 계산 근거가 문서/코드 설계 양쪽에서 설명 가능하다.

### 7-7. Phase 7 중단 조건
- `weekday_24h_price`, `weekend_24h_price` 를 금액이 아닌 비율로 다시 해석해야 하면 즉시 중단
- `week_1_price`, `week_2_price`, `month_1_price` 값 뜻이 admin / view / formula 문서에서 다르면 즉시 중단
- 30일 초과 구간 규칙이 필요해지면 별도 phase 로 분리하고 즉시 중단

## Phase 8 준비안 — admin / preview / search 의미 정렬
### 8-1. 정렬 대상
- admin editor 의 `base24h`, `weekday24h`, `weekend24h`, `weekdayPercent`, `weekendPercent`
- view 의 `base24h`, `weekday_24h_price`, `weekend_24h_price`, `week_1_price`, `week_2_price`, `month_1_price`
- formula 문서의 `base24h`, `weekdayRate`, `weekendRate`
- search 계산 코드 입력값

### 8-2. 잠가야 할 해석
- admin 의 percent 는 저장 truth 가 아니라 **금액 기반 파생 해석값**인지
- `week_1 / week_2 / month_1` 는 anchor 총액인지 일당 환산값인지
- preview 의 `after_json` 은 search 예상값이 아니라 hub 저장 상태 diff 인지

### 8-3. 종료 조건
- 같은 이름의 값이 같은 뜻으로만 쓰인다.
- 다른 뜻이면 이름/설명 분리가 필요하다는 점이 명시된다.

## Phase 9 준비안 — 검증/반영 실행 계획
### 9-1. 검증 묶음
1. DB 검증
   - 샘플 그룹별 `pricing_hub_rates` ↔ `v_search_pricing_hub_policies` 대조
2. 조회 검증
   - `fetchGroupPricePolicies.js` 전환 후 그룹/기간 필터 결과 대조
3. 계산 검증
   - `7일 미만`, `7~14일`, `15~30일`, `days + hours cap` 케이스별 기대값 비교
4. 운영 검증
   - admin editor / preview / search 결과 비교

### 9-2. 최소 테스트 케이스
- `3일 평일 중심`
- `4일 주말 포함`
- `6일 + 5시간`
- `7일 정확히`
- `10일`
- `14일 정확히`
- `20일`
- `30일 정확히`
- anchor fallback 케이스
- weekday/weekend rate 미등록 fallback 케이스

### 9-3. 반영 순서 초안
1. Phase 5 검산표 잠금
2. Phase 6 조회 전환 설계 잠금
3. Phase 7 계산식 설계 잠금
4. 문서 전체 검토
5. 승인
6. 승인된 순서대로 구현
7. 각 phase 검증 후 다음 phase 진행

### 9-4. 중단 조건
- 검산표에서 해석 충돌 발견
- 조회 전환과 계산식 변경이 분리되지 않음
- 테스트 케이스 기대값을 문서로 설명 못 함
- admin / preview / search 의미 충돌 미해결

## 한 줄 결론
현재 active 범위는 다시 **메인 current 기준의 PRICING_HUB ↔ 자사플랫폼 검색 연결 작업**이며, 선행 weekday / weekend baseline 작업과 Phase 5 검산은 끝났다. 다음은 **Phase 6 조회 전환 설계**다.
