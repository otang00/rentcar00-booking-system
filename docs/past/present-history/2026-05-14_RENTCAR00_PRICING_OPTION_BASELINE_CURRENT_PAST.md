# 2026-05-14 RENTCAR00 PRICING OPTION BASELINE CURRENT

## 문서 상태
- 상태: active current
- 목적: `기본 / 준프리미엄 / 프리미엄` 3단 옵션의 입력값 매핑 기준을 잠근다.

## 이 문서의 역할
- 이 문서는 **입력값 baseline 옵션표**만 잠근다.
- 실제 search 계산식 자체를 바꾸는 문서는 아니다.
- 즉 `calculateGroupPrice.js` 의 구간 계산식은 유지하고,
  `base24h -> hour_1_price / week_1_price / week_2_price / month_1_price` 입력 매핑 기준만 잠근다.

## 연결 문서
- 계산식 current:
  - `docs/present/2026-05-13_RENTCAR00_PRICING_FORMULA_CURRENT.md`
- 메인 current:
  - `docs/present/2026-05-13_RENTCAR00_CURRENT.md`
- 장기 허브 정책:
  - `docs/policies/RENTCAR00_PRICING_HUB.md`

## 잠긴 전제
1. 현재 옵션축은 아래 3개다.
   - 기본
   - 준프리미엄
   - 프리미엄
2. 옵션 타입 truth 는 `car_groups.pricing_option_type` 기준으로 본다.
3. 현재 existing 기준값은 `준프리미엄` 이다.
4. `weekday_24h_price`, `weekend_24h_price` baseline 은 기존 기준을 유지한다.
   - `weekday_24h_price = ceil_1000(base24h * 0.90)`
   - `weekend_24h_price = ceil_1000(base24h * 1.15)`
4. 이번 문서에서 다시 잠그는 것은 아래 4개다.
   - `hour_1_price`
   - `week_1_price`
   - `week_2_price`
   - `month_1_price`

## 옵션별 baseline 표
| 옵션 | hour_1 | week_1 (7일) | week_2 (14일) | month_1 (30일) |
| --- | ---: | ---: | ---: | ---: |
| 기본 | 0.12 | 5.50 | 7.50 | 10.50 |
| 준프리미엄 | 0.12 | 5.50 | 8.00 | 12.00 |
| 프리미엄 | 0.14 | 6.50 | 9.00 | 14.00 |

## 입력값 매핑식
### 공통
- `weekday_24h_price = ceil_1000(base24h * 0.90)`
- `weekend_24h_price = ceil_1000(base24h * 1.15)`

### 기본
- `hour_1_price = ceil_1000(base24h * 0.12)`
- `week_1_price = ceil_10000(base24h * 5.50)`
- `week_2_price = ceil_10000(base24h * 7.50)`
- `month_1_price = ceil_10000(base24h * 10.50)`

### 준프리미엄
- `hour_1_price = ceil_1000(base24h * 0.12)`
- `week_1_price = ceil_10000(base24h * 5.50)`
- `week_2_price = ceil_10000(base24h * 8.00)`
- `month_1_price = ceil_10000(base24h * 12.00)`

### 프리미엄
- `hour_1_price = ceil_1000(base24h * 0.14)`
- `week_1_price = ceil_10000(base24h * 6.50)`
- `week_2_price = ceil_10000(base24h * 9.00)`
- `month_1_price = ceil_10000(base24h * 14.00)`

## 반올림 규칙
- `hour_1_price`: 천원 단위 올림
- `week_1_price`: 만원 단위 올림
- `week_2_price`: 만원 단위 올림
- `month_1_price`: 만원 단위 올림
- `weekday_24h_price`: 천원 단위 올림
- `weekend_24h_price`: 천원 단위 올림

## 실무 해석
1. `기본 / 준프리미엄 / 프리미엄` 은 계산식 종류를 바꾸는 옵션이 아니다.
2. 구간 계산식은 동일하고, **입력 anchor 값의 baseline** 만 달라진다.
3. 옵션 타입 분류 기준은 rate row 가 아니라 **group row** 다.
4. 따라서 현재 단계에서는 코드보다 **입력값 세팅 기준** 이 먼저다.
5. 운영자가 그룹별로 개별 조정할 수는 있지만, baseline 생성 기준은 이 표를 우선한다.

## view 값 해석 기준
### search 가 읽는 값
- `v_search_pricing_hub_policies` 가 search 에 내려주는 값은 **숫자값**이다.
- 즉 search runtime 은 수식 문자열을 읽는 것이 아니라, 최종 산출된 숫자를 읽는다.

### 내부 정의 방식
- 다만 view SQL 내부에는 fallback 계산식이 들어 있다.
- 현재 구조는 아래다.
  1. `pricing_hub_rates` 저장값이 있으면 그 값을 우선 사용
  2. 저장값이 없으면 view 안의 fallback 수식으로 숫자를 계산

즉 정리하면:
- **runtime 입력은 숫자값**
- **view 내부에는 fallback 계산식이 존재**

## 현재 주의사항
1. 현재 view fallback 은 아직 `준프리미엄` 계열에 가깝다.
   - `week_1_price = 5.50`
   - `week_2_price = 8.00`
   - `month_1_price = 12.00`
2. 따라서 `기본 / 프리미엄` 을 실제로 쓰려면
   - `pricing_hub_rates` 에 해당 숫자값을 직접 저장하는 쪽이 우선이다.
3. view fallback 자체를 옵션형으로 바꾸는 작업은 이번 문서 범위 밖이다.

## 종료 조건
1. 옵션 3종의 baseline 배수가 문서상 고정된다.
2. 운영/검토 시 어떤 옵션을 어떤 숫자로 넣어야 하는지 모호함이 없다.
3. view 가 숫자를 읽는지, 식을 읽는지 해석이 명확하다.

## 한 줄 결론
이번 current 는 **기본 / 준프리미엄 / 프리미엄 3단 옵션의 입력값 매핑 기준표를 잠그는 문서**이며, search 는 최종적으로 view 가 계산/선택한 **숫자값**을 읽는다.
