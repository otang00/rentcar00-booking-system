# 2026-05-14 RENTCAR00 CURRENT

## 문서 상태
- 상태: past / completed issue lock
- 목적: pricing hub admin 의 주중/주말 비율 오적용을 잠그고, 수정 전 기준점을 명확히 한다.

## 긴급 잠금: pricing hub weekday/weekend 비율 오적용

### 문제
관리자 pricing hub 화면에서 주중/주말 비율이 `45% / 50%` 로 보이는 문제가 확인됐다.

### 원인
`45% / 50%` 는 IMS/legacy `price_policies.weekday_rate_percent`, `price_policies.weekend_rate_percent` 값이다.
이 값이 admin pricing hub 의 `weekdayPercent`, `weekendPercent` backfill/fallback 기준으로 잘못 승격됐다.

문제 지점:
- `api/admin/pricing-hub.js`
  - `buildEditorState()` 가 metadata 누락 시 `price_policies.weekday_rate_percent`, `price_policies.weekend_rate_percent` 를 fallback 으로 사용한다.
  - `fallbackWeekday24h`, `fallbackWeekend24h` 도 같은 legacy percent 를 기준으로 계산한다.
- `scripts/pricing/backfill-pricing-hub-rate-metadata.js`
  - metadata backfill 시 `weekdayPercent`, `weekendPercent` 를 `price_policies` 의 legacy percent 로 채운다.
- `docs/complete/2026-05-14_RENTCAR00_PRICING_HUB_ADMIN_COMPLETE.md`
  - backfill 기준을 legacy percent 로 적어 둔 문서 오류가 있었다.

### 고정 기준
pricing hub admin 의 기본 주중/주말 기준은 아래다.

- `base24h` 는 공통 기준 24시간 금액이다.
- `weekdayPercent` 기본값은 `90` 이다. 즉 `weekday = base24h * 0.90` 이다.
- `weekendPercent` 기본값은 `115` 이다. 즉 `weekend = base24h * 1.15` 이다.
- 운영 표현으로는 주중 `-10%`, 주말 `+15%` 다.
- `price_policies.weekday_rate_percent = 45`, `price_policies.weekend_rate_percent = 50` 은 IMS/legacy 값이며 pricing hub admin 기본 비율 truth 로 쓰면 안 된다.

### truth 해석
- search/read model 이 실제로 읽는 최종 가격 truth 는 `pricing_hub_rates.fee_24h` 절대값이다.
- `pricing_hub_rates.metadata.weekdayPercent`, `metadata.weekendPercent` 는 admin 입력/표시용 변수다.
- 이 변수의 기본 기준은 `90 / 115` 이며, legacy `45 / 50` 에서 가져오면 안 된다.
- 그룹별 조정은 가능하지만, 조정 전 baseline 은 반드시 `90 / 115` 다.

### 수정 전 금지 사항
- `45 / 50` 을 pricing hub admin 의 정상 비율로 문서화하지 않는다.
- `price_policies.weekday_rate_percent`, `weekend_rate_percent` 를 admin percent fallback 으로 계속 쓰지 않는다.
- metadata 를 다시 backfill 할 때 legacy percent 를 재사용하지 않는다.
- DB metadata 정정 없이 화면만 숨기는 방식으로 끝내지 않는다.

## 실행 phase

### Phase 0. 롤백포인트
- 커밋: `d031300 docs: lock pricing hub percent rollback point`
- 역할: legacy percent 삭제 작업 전 문서 기준점

### Phase 1. 코드 기준 정정
- 대상:
  - `api/admin/pricing-hub.js`
  - `src/pages/AdminPricingHubPage.jsx`
  - `scripts/pricing/backfill-pricing-hub-rate-metadata.js`
  - `scripts/pricing/apply-group-pricing.js`
  - `scripts/pricing/build-group-pricing-preview.js`
- 종료 조건:
  - 신규/누락 metadata 의 기본 percent 가 `90 / 115` 로 고정된다.
  - admin/API/import 코드에서 `price_policies.weekday_rate_percent`, `price_policies.weekend_rate_percent` 참조가 제거된다.

### Phase 2. DB 컬럼 삭제 migration
- 대상:
  - `price_policies.weekday_rate_percent`
  - `price_policies.weekend_rate_percent`
  - `v_pricing_hub_policy_editor`
  - `v_search_pricing_hub_policies`
- 종료 조건:
  - 새 migration 에서 legacy percent 컬럼을 drop 한다.
  - 관련 view 는 legacy percent 없이 재생성한다.

### Phase 3. metadata 정정 스크립트 준비
- 대상:
  - `pricing_hub_rates.metadata.weekdayPercent`
  - `pricing_hub_rates.metadata.weekendPercent`
- 종료 조건:
  - `45 / 50` 류 legacy 오염값을 `90 / 115` 로 정정하는 dry-run/apply 스크립트를 준비한다.
  - 운영 DB 반영은 별도 실행 승인을 받아야 한다.

### Phase 4. 검증
- 대상:
  - 코드 정적 확인
  - `npm run build`
  - `npm run test:zzimcar-sync`
  - 필요 시 `/admin/pricing-hub`
- 종료 조건:
  - 관리자 화면 비율이 `90 / 115` 기준으로 표시된다.
  - 계산 주중24/주말24가 `base24h * 0.90 / 1.15` 기준과 일치한다.
  - search 가격이 의도한 절대값을 읽는다.

## 현재 확인한 근거
- `docs/past/present-history/2026-05-13_RENTCAR00_PRICING_HUB_WEEKDAY_WEEKEND_BASELINE_CURRENT_PAST.md`
  - `weekday = base24h의 -10%`
  - `weekend = base24h의 +15%`
- `server/search-db/pricing/calculateGroupPrice.js`
  - search 계산은 `weekday_24h_price`, `weekend_24h_price` 절대값을 사용한다.
- `supabase/migrations/20260514024500_slim_search_pricing_hub_view.sql`
  - search view 는 `pricing_hub_rates.fee_24h` 를 우선 읽는다.
- `api/admin/pricing-hub.js`
  - admin editor state 에서 legacy percent fallback 이 남아 있다.
- `scripts/pricing/backfill-pricing-hub-rate-metadata.js`
  - metadata backfill 이 legacy percent 를 사용한다.

## 한 줄 결론
현재 pricing hub admin 의 `45% / 50%` 표시는 IMS/legacy 비율을 새 허브 변수로 잘못 사용한 오류이며, 정상 baseline 은 `weekday 90%`, `weekend 115%` 로 잠근다.
