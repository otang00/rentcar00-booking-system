# 2026-05-14 RENTCAR00 PRICING HUB ADMIN COMPLETE

## 문서 상태
- 상태: complete
- 목적: admin pricing hub 개편, DB cleanup, metadata backfill, legacy percent 제거 완료 기준을 한 문서로 통합한다.

## 이번 완료 범위
1. admin pricing hub 화면 구조 개편 완료
2. pricing hub dead code / unused table cleanup 완료
3. `pricing_hub_rates.metadata` 기준값 backfill 완료
4. admin / search 해석 기준 재정리 완료
5. legacy `price_policies.weekday_rate_percent` / `weekend_rate_percent` 제거 완료
6. 오염 metadata `90 / 115` 정정 및 production 배포 완료

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
- `weekdayPercent`, `weekendPercent` 의 기본 baseline 은 `90 / 115` 다.
- `price_policies.weekday_rate_percent = 45`, `price_policies.weekend_rate_percent = 50` 은 IMS/legacy 값이며 admin pricing hub 기본 비율 truth 로 쓰면 안 된다.

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
> 정정: 최초 문서에는 `weekdayPercent`, `weekendPercent` 를 `price_policies.weekday_rate_percent`, `price_policies.weekend_rate_percent` 에서 가져온다고 기록했으나 이는 오류다.
> 해당 값은 IMS/legacy `45 / 50` 이며 pricing hub admin baseline 으로 쓰면 안 된다.

정상 기준:
- `base24h` → 같은 period 의 `common.fee_24h`
- `weekdayPercent` → 기본 `90`
- `weekendPercent` → 기본 `115`

이미 `45 / 50` 으로 들어간 metadata 는 최종 정정 완료했다.

최종 정리 결과:
- `price_policies.weekday_rate_percent`, `price_policies.weekend_rate_percent` 는 production migration 으로 삭제 완료했다.
- pricing hub admin/import/search 코드에서는 위 legacy 컬럼을 참조하지 않는다.
- `pricing_hub_rates.metadata.weekdayPercent`, `metadata.weekendPercent` 오염값은 `90 / 115` 로 정정 완료했다.

### 3-3. 결과
- 대상: `pricing_hub_rates` 54 row
- backfill 완료: 54 row
- legacy 오염 metadata 정정: 54 row
- 정정 후 dry-run 재확인: matched 0
- 누락: 0 row

### 3-4. fallback 원칙
이후 editor state 해석은 아래 순서로 본다.
1. `metadata.weekdayPercent`, `metadata.weekendPercent`
2. 없으면 pricing hub baseline 기본값 `90 / 115`

`price_policies.weekday_rate_percent`, `price_policies.weekend_rate_percent` 는 IMS/legacy 값이므로 admin percent fallback 으로 쓰지 않는다.
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

### 4-3. legacy percent 제거 완료
- migration: `supabase/migrations/20260514231500_drop_price_policy_legacy_percents.sql`
- 삭제 대상:
  - `price_policies.weekday_rate_percent`
  - `price_policies.weekend_rate_percent`
- 관련 view 는 legacy percent 없이 재생성했다.
- `v_active_group_price_policies` 는 migration 실행 시 존재하지 않아 skip notice 로 처리됐다.

---

## 5. 실제 반영 파일
- `src/pages/AdminPricingHubPage.jsx`
- `api/admin/pricing-hub.js`
- `src/services/adminPricingHubApi.js`
- `scripts/pricing/backfill-pricing-hub-rate-metadata.js`
- `scripts/pricing/fix-pricing-hub-rate-percent-metadata.js`
- `scripts/pricing/apply-group-pricing.js`
- `scripts/pricing/build-group-pricing-preview.js`
- `supabase/migrations/20260514231500_drop_price_policy_legacy_percents.sql`

---

## 6. 검증 기준
- `npm run build` 통과
- `npm run test:zzimcar-sync` 통과
- admin pricing hub production 응답 200 확인
- production JS에 admin pricing hub chunk 반영 확인
- `pricing_hub_rates.metadata` 정정 후 dry-run matched 0 확인
- `https://rentcar00.com` alias 배포 완료

---

## 7. 관련 커밋 / 배포
- rollback 기준점: `d031300 docs: lock pricing hub percent rollback point`
- 최종 반영: `eae02be fix: remove legacy pricing percent columns`
- production alias: `https://rentcar00.com`

## 8. 남은 후속 후보
1. 차량 chip 클릭 시 차량/그룹 이동 기능 연결
2. admin 실사용 피드백 반영 후 카드 밀도 조정
3. 가격 미리보기 카드 순서/밀도 개선은 active current 에서 별도 처리

---

## 한 줄 결론
2026-05-14 기준 pricing hub admin 은
**변수형 truth + 연결 truth + metadata 보존 + legacy percent 제거**까지 완료됐고,
기존 분산된 current 문서 내용은 이 complete 문서로 통합한다.
