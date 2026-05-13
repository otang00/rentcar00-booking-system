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
- 코드 정책 변수: `WEEK1_DAILY_INCREMENT_RATE`, `WEEK2_DAILY_INCREMENT_RATE`, cap 관련 변수
- 검증용 legacy 값: `legacy_base_daily_price`, `legacy_weekday_rate_percent`, `legacy_weekend_rate_percent`, `legacy_weekday_7d_plus_price`, `legacy_weekend_7d_plus_price`

### 2-6. anchor / 증분 처리 원칙
1. `week_1_price`, `week_2_price`, `month_1_price` 는 기본적으로 허브 값을 우선 사용한다.
2. 허브 anchor 값이 비어 있으면 문서에 잠근 공식 기준값으로 계산한다.
   - `7일 = base24h * 5.50`
   - `14일 = base24h * 8.00`
   - `30일 = base24h * 12.00`
3. `7+ daily`, `14+ daily` 증분은 DB 값이 아니라 코드의 수정 가능한 정책 변수로 계산한다.
4. 즉 **anchor 값은 DB**, **증분 규칙은 코드 변수**로 잠근다.

## 한 줄 결론
현재 active 범위는 **PRICING_HUB를 자사플랫폼 검색 source에 연결하고, 그 다음 공식 계산식을 반영하는 작업**이며, Phase 2 확인 결과 **새 공식의 핵심 anchor 값은 허브에 있고 검색은 아직 legacy source 만 읽는 상태**다. Phase 3 에서는 이를 위해 **검색 전용 새 view, 6h/12h 제거, anchor는 DB / 증분은 코드 변수 원칙**을 기준으로 구조를 설계한다.
