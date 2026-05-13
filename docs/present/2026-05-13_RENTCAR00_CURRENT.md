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
- 장기 허브 정책:
  - `docs/policies/RENTCAR00_PRICING_HUB.md`
- 장기 월요금 source 참고:
  - `docs/present/2026-05-01_RENTCAR00_PRICING_HUB_MONTHLY_SOURCE_CURRENT.md`

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

### 현행 판단
1. 검색 계산은 아직 legacy 가격 경로를 읽는다.
2. PRICING_HUB 저장 구조는 이미 존재하지만, 검색 계산 source로 직접 연결되지는 않았다.
3. 따라서 이번 작업의 핵심은 **허브 값을 검색이 읽을 수 있는 구조로 연결하는 것**이다.

## phase 로드맵
### Phase 1. 연결 기준 잠금
- 이번 작업을 `PRICING_HUB ↔ 자사플랫폼 검색 연결 작업`으로 명시한다.
- 검색 계산에 필요한 입력값 목록을 잠근다.
- 이번 범위 밖 항목을 분리한다.

### Phase 2. 현행 구조 대비표 작성
- 검색이 현재 어떤 값을 어디서 읽는지 정리한다.
- 허브가 어떤 값을 저장하는지 정리한다.
- 필요 입력값 / 현행 검색 source / 허브 source / 부족 스키마를 표로 맞춘다.

### Phase 3. 목표 연결 구조 설계
- 검색이 허브 값을 어떤 경로로 읽을지 결정한다.
- legacy view 확장 / 검색 전용 view / 서버 조합 방식 중 하나를 고른다.
- active period 와 scope 해석 기준을 잠근다.

### Phase 4. DB 스키마/뷰 반영
- 목표 연결 구조에 맞는 migration / view / reference 를 반영한다.
- 검색이 허브 값을 읽을 수 있는 DB 기준 경로를 만든다.

### Phase 5. 허브 값 채우기
- 샘플 그룹부터 허브 값을 입력한다.
- `1h / 24h / 7일 / 14일 / 30일 / 주중 / 주말` 값을 검산한다.
- preview 기준으로 운영값을 확인한다.

### Phase 6. 검색 연결
- 검색 조회 경로를 허브 연결 source 기준으로 바꾼다.
- legacy fallback 필요 여부를 결정한다.

### Phase 7. 계산식 반영
- `PRICING_FORMULA_CURRENT` 기준으로 실제 검색 계산식을 수정한다.
- `7일 미만`, `7~14일`, `15~30일` 계산 규칙을 공식 기준으로 맞춘다.

### Phase 8. admin / preview 정렬
- 허브 저장값, preview, 검색 계산 결과의 의미를 일치시킨다.
- `week_1 / week_2 / month_1` 해석을 통일한다.

### Phase 9. 검증
- 단위 테스트
- 샘플 그룹 검산
- preview ↔ 검색 결과 대조
- rollback 가능성 확인

## phase별 종료 조건
1. **Phase 1**: 이번 작업 범위와 입력값 목록이 흔들리지 않는다.
2. **Phase 2**: 필요값 대비 현행 DB 보유값과 부족값이 표로 보인다.
3. **Phase 3**: 검색 연결 목표 구조를 설명할 수 있다.
4. **Phase 4**: 허브 값을 읽는 DB 경로가 준비된다.
5. **Phase 5**: 샘플 허브 값이 신뢰 가능하다.
6. **Phase 6**: 검색이 허브 연결 source를 읽는다.
7. **Phase 7**: 공식과 코드가 일치한다.
8. **Phase 8**: admin / preview / 검색 의미가 맞는다.
9. **Phase 9**: 운영 반영 전 검증 기준을 통과한다.

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

## Phase 4 실행 준비
### 4-1. Phase 4 범위 고정
- Phase 4 는 **DB migration 으로 `v_search_pricing_hub_policies` view 를 추가하는 작업까지만** 포함한다.
- 아래 항목은 **Phase 4 범위 밖**으로 고정한다.
  - `fetchGroupPricePolicies.js` 전환
  - `calculateGroupPrice.js` 계산식 변경
  - 테스트 fixture 구조 변경
  - admin / preview 해석 변경

### 4-2. Phase 4 실행 순서
1. migration SQL 작성
2. 컬럼/조인/period 선택 규칙을 current 문서와 1:1 대조
3. `supabase db push --linked --dry-run` 으로 반영 예정 migration 확인
4. dry-run 결과가 예상과 일치하는지 확인
5. 사용자 승인 후에만 실제 DB 반영 실행

### 4-3. Phase 4 SQL 포함 대상
- 식별 컬럼
  - `ims_group_id`, `group_name`, `car_group_id`, `price_policy_id`, `policy_name`
- 허브 기준 컬럼
  - `base24h`, `weekday_24h_price`, `weekend_24h_price`, `hour_1_price`, `week_1_price`, `week_2_price`, `month_1_price`
- 상태/검증 컬럼
  - `active_period_id`, `active_period_name`
  - `has_hub_common_rate`, `has_hub_weekday_rate`, `has_hub_weekend_rate`
  - `uses_anchor_fallback`
  - `legacy_base_daily_price`, `legacy_hour_1_price`
  - `legacy_weekday_rate_percent`, `legacy_weekend_rate_percent`
  - `legacy_weekday_7d_plus_price`, `legacy_weekend_7d_plus_price`

### 4-4. Phase 4 실행 전 검증 체크리스트
- [ ] migration 파일은 **새 view 추가만** 포함한다.
- [ ] 기존 `v_active_group_price_policies` 는 수정하지 않는다.
- [ ] `6h`, `12h` 는 새 view 컬럼에 넣지 않는다.
- [ ] `7일 / 14일 / 30일` anchor fallback 은 `5.50 / 8.00 / 12.00` 기준과 일치한다.
- [ ] period 선택 규칙은 `active=true` + 현재 시점 유효 + `created_at` 최신 우선으로 잠겼다.
- [ ] `apply_mon ~ apply_sun` 은 Phase 4 에서 사용하지 않는다고 명시됐다.
- [ ] `fetchGroupPricePolicies.js` 전환은 아직 안 건드린 상태다.
- [ ] `calculateGroupPrice.js` 계산식은 아직 안 건드린 상태다.
- [ ] dry-run 대상 migration 이 정확히 1건인지 확인한다.
- [ ] dry-run 출력이 새 view 생성 외의 의도치 않은 변경을 포함하지 않는다.

### 4-5. Phase 4 중단 조건
- 새 view 에 계산코드 호환 컬럼을 추가해야 한다는 요구가 나오면 즉시 중단
- repository 전환까지 함께 하자는 요구가 나오면 즉시 중단
- 계산식 변경까지 함께 하자는 요구가 나오면 즉시 중단
- dry-run 결과가 view 생성 외의 변경을 포함하면 즉시 중단
- current 문서와 SQL 초안이 1개라도 어긋나면 즉시 중단

## 한 줄 결론
현재 active 범위는 **PRICING_HUB를 자사플랫폼 검색 source에 연결하고, 그 다음 공식 계산식을 반영하는 작업**이며, Phase 4 는 **새 검색용 view migration 준비와 dry-run 검증까지만**, 실제 검색 연결과 계산식 변경은 다음 phase 승인 전까지 분리한다.
