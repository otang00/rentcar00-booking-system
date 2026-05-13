# 2026-05-13 RENTCAR00 PRICING FORMULA CURRENT

## 문서 상태
- 상태: active current
- 목적: 메인 플랫폼 검색가격 계산식의 최종 결정안을 프로젝트 구조 기준으로 잠근다.

연결 문서:
- 장기 허브 정책: `docs/policies/RENTCAR00_PRICING_HUB.md`
- 현재 active 작업 요약: `docs/present/2026-05-13_RENTCAR00_CURRENT.md`
- 옵션 baseline current: `docs/present/2026-05-14_RENTCAR00_PRICING_OPTION_BASELINE_CURRENT.md`

## 기준 경로
### 실제 계산 코드
- `server/search-db/pricing/calculateGroupPrice.js`
- `server/search-db/repositories/fetchGroupPricePolicies.js`

### 데이터 소스
- `v_search_pricing_hub_policies`
- `pricing_hub_periods`
- `pricing_hub_rates`

## 현재 구조 판단
1. 실검색 가격 계산은 현재 `calculateGroupPrice.js` 가 담당한다.
2. 이번 단계에서는 legacy bucket 구조를 더 이상 기준으로 유지하지 않는다.
3. search 와 계산은 `v_search_pricing_hub_policies` 의 새 입력값을 직접 읽는 방향으로 잠근다.
4. 특히 `7일 미만`은 단일 버킷 고정가가 아니라 **일자별 주중/주말 합산 + 추가시간 cap** 규칙으로 본다.

## 고정 기준값
### 단기 버킷 가중치
- `1~2일 = 1.00`
- `3~4일 = 0.90`
- `5~6일 = 0.85`

### 옵션별 입력 baseline
- 구체적인 `hour_1_price / week_1_price / week_2_price / month_1_price` baseline 표는
  `docs/present/2026-05-14_RENTCAR00_PRICING_OPTION_BASELINE_CURRENT.md` 를 기준으로 본다.
- 이 문서는 구간 계산식만 잠그고, 옵션별 입력 배수표는 별도 current 로 분리한다.

### 구간 일증가값
- `7+ daily = 0.50`
- `14+ daily = 0.35`

## 입력값
- `base24h`: 기준 24시간 금액
- `hour_1_price`: 1시간 금액
- `weekday_24h_price`: 주중 24시간 금액
- `weekend_24h_price`: 주말 24시간 금액
- `week_1_price`: 7일 금액
- `week_2_price`: 14일 금액
- `month_1_price`: 30일 금액
- `startAt`: 대여 시작 시각
- `endAt`: 대여 종료 시각

## 파생 기준값
- `weekdayDaily = weekday_24h_price`
- `weekendDaily = weekend_24h_price`
- `hourlyBase = hour_1_price`
- `anchor7 = week_1_price`
- `anchor14 = week_2_price`
- `anchor30 = month_1_price`

주의
- `7일 미만`은 시작일 기준이 아니라 **대여 구간에 포함된 실제 각 날짜의 요일을 순회**해서 계산한다.
- 즉 스케줄 전체 확인형이다.

## 7일 미만 계산식
### 1. 일수 / 시간 분리
- `days = floor(totalHours / 24)`
- `hours = ceil(totalHours - (days * 24))`

### 2. 일수 버킷 선택
- `days <= 2` -> `bucketWeight = 1.00`
- `days <= 4` -> `bucketWeight = 0.90`
- `days <= 6` -> `bucketWeight = 0.85`

### 3. 일수 금액
대여 기간에 포함된 각 일자를 순회해서 계산한다.

- 평일이면 `weekdayDaily * bucketWeight`
- 주말이면 `weekendDaily * bucketWeight`

식:
- `dayTotal = sum(eachDayRate * bucketWeight)`

### 4. 추가시간 금액
- `timeTotal = hours * hourlyBase`

### 5. 다음 1일 cap
추가시간 합산 금액이 다음 1일 금액보다 커지면 다음 1일 금액으로 전환한다.

식:
- `price(days + h시간) = min(price(days) + timeTotal, price(days + 1))`

예:
- `3일 + 5시간 = min(3일 금액 + 5 * hourlyBase, 4일 금액)`

## 7~14일 계산식
7일 이상부터는 요일별 합산이 아니라 저장된 앵커값 기준 증분형으로 계산한다.

- `anchor7 = week_1_price`
- `anchor14 = week_2_price`
- `price(d) = min(anchor14, anchor7 + (d - 7) * base24h * 0.50)`
- 적용 범위: `7 <= d <= 14`

## 15~30일 계산식
- `anchor14 = week_2_price`
- `anchor30 = month_1_price`
- `price(d) = min(anchor30, anchor14 + (d - 14) * base24h * 0.35)`
- 적용 범위: `15 <= d <= 30`

## 30일 초과
- 검색에서는 30일 초과 예약을 받지 않는다.
- 따라서 `30일 초과` 계산 규칙은 이번 공식 범위에 없다.
- 코드에서도 30일 초과 입력은 오류로 본다.

## 구현 관점 메모
1. 이번 기준은 더 이상 legacy bucket 금액을 읽지 않는다.
2. 실제 코드 반영 시에는 아래가 같이 바뀌어야 한다.
   - `fetchGroupPricePolicies.js`: `v_search_pricing_hub_policies` 기준 조회
   - `calculateGroupPrice.js`: 새 입력값 기준 계산
3. 실제 계산은 아래를 따른다.
   - `7일 미만`: 날짜별 주중/주말 순회 + 시간 cap
   - `7일 이상`: `week_1 / week_2 / month_1` anchor + 구간 daily add
4. `nextDayPrice` 계산도 같은 규칙으로 재귀/헬퍼 계산해야 한다.

## 한 줄 결론
- `7일 미만 = 날짜별 주중/주말 합산 + 1h 0.12 + 다음 1일 cap`
- `7일 이상 = 7/14/30 anchor + 0.50 / 0.35 증분`
- 이 기준을 `server/search-db/pricing/calculateGroupPrice.js` 반영 대상 공식으로 잠근다.
