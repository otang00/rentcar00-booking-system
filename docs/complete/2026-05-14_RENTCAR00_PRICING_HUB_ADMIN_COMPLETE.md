# 2026-05-14 RENTCAR00 PRICING HUB ADMIN COMPLETE

## 문서 상태
- 상태: complete
- 목적: admin pricing hub 개편, DB cleanup, metadata backfill 완료 기준을 한 문서로 통합한다.

## 이번 완료 범위
1. admin pricing hub 화면 구조 개편 완료
2. pricing hub dead code / unused table cleanup 완료
3. `pricing_hub_rates.metadata` 기준값 backfill 완료
4. admin / search 해석 기준 재정리 완료

---

## 1. admin pricing hub 완료 기준

### 1-1. 화면 구조
admin pricing hub 는 아래 3단 구조로 잠갔다.

1. 차량그룹 상세
- 현재 연결 정책
- 옵션타입
- 활성/비활성 상태
- 차량번호 chip
- 현재 적용 금액 요약

2. 연결 정책 선택
- 연결할 정책 선택
- 옵션타입 선택
- 활성/비활성 토글
- 선택 정책 가격 미리보기

3. 정책 수정
- 차량그룹과 분리된 정책 전용 편집기
- 기준24 / 주중비율 / 주말비율 수정
- 옵션타입별 전체 금액 미리보기

### 1-2. UI 원칙
- 현재 적용 금액 / 정책 미리보기는 같은 그리드 패턴으로 본다.
- 금액 카드는 세로형이 아니라 가로형 얇은 카드로 본다.
- 활성/비활성은 텍스트가 아니라 색 배지로 본다.
- 차량번호는 이후 이동 기능을 붙일 수 있게 chip 구조로 둔다.

### 1-3. 입력 truth
admin 이 직접 수정하는 값은 아래 4개다.
- `base24h`
- `weekdayPercent`
- `weekendPercent`
- `pricingOptionType`

단,
- `pricingOptionType` 은 연결 truth 로서 `price_policy_groups.pricing_option_type` 기준이다.
- 정책 수정 하단의 옵션타입은 저장값이 아니라 미리보기용이다.

---

## 2. 저장 truth 정리

### 2-1. 연결 truth
- `price_policy_groups.price_policy_id`
- `price_policy_groups.pricing_option_type`
- `price_policy_groups.active`

### 2-2. 가격 truth
- `pricing_hub_periods`
- `pricing_hub_rates.metadata.base24h`
- `pricing_hub_rates.metadata.weekdayPercent`
- `pricing_hub_rates.metadata.weekendPercent`

### 2-3. 계산 저장값 해석
- `common.fee_24h` = `base24h`
- `weekday.fee_24h` / `weekend.fee_24h` 는 비율 기반 계산 결과다.
- `fee_1h`, `week_1_price`, `week_2_price`, `month_1_price` 도 직접입력 truth 가 아니라 계산 결과다.

즉 `pricing_hub_rates` 는 최종 입력 원장이 아니라
**변수형 정책을 계산해 보존하는 파생 저장 구조**로 본다.

---

## 3. metadata backfill 완료 기준

### 3-1. 왜 backfill 했는가
기존 row 는 `metadata.weekdayPercent`, `metadata.weekendPercent` 가 없는 경우가 있었고,
그 결과 admin 화면이 `fee_24h / base24h` 역산값을 보여주면서
`90.7`, `115.12` 같은 소수점 비율이 보였다.

### 3-2. backfill 기준
`pricing_hub_rates.metadata` 에 아래를 일괄 채웠다.
- `base24h` → 같은 period 의 `common.fee_24h`
- `weekdayPercent` → `price_policies.weekday_rate_percent`
- `weekendPercent` → `price_policies.weekend_rate_percent`

### 3-3. 결과
- 대상: `pricing_hub_rates` 54 row
- backfill 완료: 54 row
- 누락: 0 row

### 3-4. fallback 원칙
이후 editor state 해석은 아래 순서로 본다.
1. `metadata.weekdayPercent`, `metadata.weekendPercent`
2. 없으면 `price_policies.weekday_rate_percent`, `price_policies.weekend_rate_percent`

`fee_24h / base24h` 역산 fallback 은 운영 기준에서 더 이상 truth 로 쓰지 않는다.

---

## 4. DB / dead code cleanup 완료 기준

### 4-1. 제거 완료
- `pricing_hub_publishes`
- `pricing_hub_publish_items`
- `pricing_hub_channel_mappings`
- `pricing_hub_overrides`
- `pricing_hub_previews`
- `pricing_hub_preview_items`
- 관련 dead code

### 4-2. 유지 대상
- `price_policy_groups`
- `pricing_hub_periods`
- `pricing_hub_rates`
- `v_pricing_hub_policy_editor`
- `v_search_pricing_hub_policies`

### 4-3. 보류 대상
- `v_active_group_price_policies`
- `price_policies` legacy 컬럼들

이 대상은 즉시 삭제하지 않고 후속 current 에서 재판단한다.

---

## 5. 실제 반영 파일
- `src/pages/AdminPricingHubPage.jsx`
- `api/admin/pricing-hub.js`
- `src/services/adminPricingHubApi.js`
- `scripts/pricing/backfill-pricing-hub-rate-metadata.js`

---

## 6. 검증 기준
- `npm run build` 통과
- admin pricing hub production 응답 200 확인
- `pricing_hub_rates.metadata` 의 `base24h / weekdayPercent / weekendPercent` 저장 확인

---

## 7. 남은 후속 후보
1. `v_search_pricing_hub_policies` view shape 슬림화
2. `v_active_group_price_policies` 실제 참조 여부 최종 확인
3. 차량 chip 클릭 시 차량/그룹 이동 기능 연결
4. admin 실사용 피드백 반영 후 카드 밀도 조정

---

## 한 줄 결론
2026-05-14 기준 pricing hub admin 은
**변수형 truth + 연결 truth + metadata 보존 기준**으로 정리됐고,
기존 분산된 current 문서 내용은 이 complete 문서로 통합한다.
