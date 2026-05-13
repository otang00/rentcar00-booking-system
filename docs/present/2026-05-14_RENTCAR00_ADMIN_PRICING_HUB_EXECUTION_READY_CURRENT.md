# 2026-05-14 RENTCAR00 ADMIN PRICING HUB EXECUTION READY CURRENT

## 문서 상태
- 상태: active current
- 목적: admin 통합요금체제 수정 작업의 기준점과 실행 준비 범위를 잠근다.

## 현재 작업명
- **ADMIN 통합요금체제 정비 작업**

## 현재 기준점
1. search / reservation 쪽은 production 반영 완료 상태다.
2. `v_search_pricing_hub_policies` 는 검색용 최종 출력값을 천원단위 올림으로 맞췄다.
3. 옵션 타입 truth 는 `price_policy_groups.pricing_option_type` 기준이다.
4. admin 미리보기/저장 계산도 천원단위 올림 기준까지 반영됐다.
5. 다음 작업은 검색 연결이 아니라 **admin 운영 체계 정리**다.
6. admin 개편 전에 DB / view / dead code cleanup 후보를 먼저 잠근다.

## 이번 current 범위
- `api/admin/pricing-hub.js`
- `src/pages/AdminPricingHubPage.jsx`
- 필요 시 `src/services/adminPricingHubApi.js`
- 필요 시 admin이 읽는 view / migration

## 이번 current에서 풀 문제
1. admin 화면의 통합요금체제 개념을 더 명확히 정리한다.
2. 운영자가 가격그룹 단위로 무엇을 보고 무엇을 수정하는지 구조를 단순화한다.
3. preview 성격 값과 실제 저장 truth 를 구분한다.
4. 옵션 타입 / 기준24 / 주중 / 주말 / 앵커값 수정 흐름을 운영 기준으로 다시 잠근다.

## 고정 truth
### 저장 truth
- `price_policy_groups.pricing_option_type`
- `pricing_hub_periods`
- `pricing_hub_rates`

### search truth
- `v_search_pricing_hub_policies`
- 검색용 출력값은 천원단위 올림 기준

### admin truth
- admin은 퍼센트가 아니라 **최종 금액 truth** 를 다루는 화면으로 본다.
- 퍼센트는 설명/보조값일 뿐, 저장 기준은 금액이다.

## 작업 전 확인 포인트
1. admin이 실제로 수정해야 하는 최소 필드가 무엇인지
2. 현재 단일 편집 폼이 운영 관점에서 충분히 단순한지
3. 가격그룹 선택 단위와 표시 문구가 혼동 없는지
4. common / weekday / weekend / anchor 값이 한 화면에서 어떻게 보이는 게 맞는지

## phase
### Phase 1. admin 현행 구조 재점검
- 현재 화면/API가 무엇을 보여주고 저장하는지 다시 고정한다.
- 종료조건: 현행 입력/출력/저장 구조를 한 번에 설명할 수 있다.

### Phase 2. 통합요금체제 수정안 잠금
- 어떤 필드를 남기고 어떤 필드를 감출지 정한다.
- 종료조건: 운영자가 수정하는 최소 단위가 명확하다.

### Phase 3. 실행 반영
- 승인된 admin 구조만 반영한다.
- 종료조건: UI/API/저장 구조가 같은 기준을 본다.

### Phase 4. 저장/재조회 검증
- 수정 후 다시 열었을 때 같은 값이 보여야 한다.
- 종료조건: 운영 저장 기준이 흔들리지 않는다.

## 이번 current의 비범위
- search 계산식 재설계
- IMS / 찜카 publish
- 장기 pricing hub 정책 문서 개편
- 대규모 문서 재서술

## 연결 문서
- 장기 정책: `docs/policies/RENTCAR00_PRICING_HUB.md`
- cleanup current: `docs/present/2026-05-14_RENTCAR00_PRICING_HUB_DB_CLEANUP_CURRENT.md`
- 과거 search 연결 기준: `docs/past/present-history/2026-05-13_RENTCAR00_CURRENT_PAST.md`
- 과거 계산식 기준: `docs/past/present-history/2026-05-13_RENTCAR00_PRICING_FORMULA_CURRENT_PAST.md`
- 과거 옵션 baseline 기준: `docs/past/present-history/2026-05-14_RENTCAR00_PRICING_OPTION_BASELINE_CURRENT_PAST.md`

## 한 줄 결론
- search 쪽 반영은 완료로 past로 내리고,
- 이제부터는 **admin 통합요금체제를 운영 수정 기준으로 다시 정리하는 단계**로 들어간다.
