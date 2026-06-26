# RENTCAR00 PRICING_HUB calculation rules current

Last updated: 2026-04-29

이 문서는 PRICING_HUB active 계산 규칙을 잠근다.

---

## 1. 직접 입력값

직접 수정 가능한 값은 3개다.

1. `base_24h`
2. `weekday_percent`
3. `weekend_percent`

---

## 2. 24시간 금액 계산

### 기준값
- `base_24h = 관리자 입력 기준 24시간 금액`

### 주중 / 주말
- `weekday_24h = round(base_24h * weekday_percent / 100)`
- `weekend_24h = round(base_24h * weekend_percent / 100)`

---

## 3. 파생 금액 계산

원칙:
- legacy 비율이 있으면 그 비율을 유지한다.
- 없으면 fallback 비율을 쓴다.
- 1차 active 는 원단위 반올림이다.

### common
- 기준: `base_24h`

### weekday
- 기준: `weekday_24h`

### weekend
- 기준: `weekend_24h`

### 항목별 계산
- `1h`
  - legacy 우선
  - fallback `applied_24h * 0.04`
- `6h`
  - legacy 우선
  - fallback `applied_24h * 0.55`
- `12h`
  - legacy 우선
  - fallback `applied_24h * 0.80`
- `week_1_price`
  - legacy 우선
  - fallback 비율 `6.5`
- `week_2_price`
  - legacy 우선
  - fallback 비율 `12.5`
- `month_1_price`
  - 현재 `24배`
- `long_24h_price`
  - 현재 `1배`
- `long_1h_price`
  - legacy 우선
  - fallback `0.1배`

---

## 4. 저장 매핑

- `common` → 기준24 기반 계산 row
- `weekday` → 주중24 기반 계산 row
- `weekend` → 주말24 기반 계산 row

저장 위치:
- `pricing_hub_rates`

onConflict:
- `pricing_hub_period_id, rate_scope`

---

## 5. 현재 비고

- 저장은 additive 구조다.
- legacy `price_policies` 직접 수정은 하지 않는다.
- 계산 규칙은 UI preview 와 저장에 같은 함수를 기준으로 맞춘다.

---

## 6. 한 줄 결론

**기준24를 중심으로 주중%/주말%를 곱해 24h를 만들고, 나머지는 legacy 비율 기반으로 `common/weekday/weekend` row를 계산 저장한다.**
