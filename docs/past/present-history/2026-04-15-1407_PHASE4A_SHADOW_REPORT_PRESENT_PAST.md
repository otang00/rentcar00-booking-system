# PHASE 4-A SHADOW REPORT

## 1. 실행 개요
- **샘플 세트:** `docs/present/PHASE4_SAMPLE_QUERIES_PRESENT.md` (S01~S12)
- **실행 스크립트:** `scripts/run-phase4a-shadow.js`
- **로그 위치:** `supabase/.temp/shadow-log.phase4a.jsonl`
- **요약 데이터:** `supabase/.temp/shadow-log.phase4a.summary.json` (생성 스크립트 `scripts/analyze-phase4a-shadow.js`)
- **환경:** `.env` (Supabase anon key) + `SEARCH_SHADOW_ENABLED=true`, `SEARCH_SHADOW_LOG_PATH=supabase/.temp/shadow-log.phase4a.jsonl`
- **Supabase insert 상태:** `search_shadow_diffs` 테이블 미생성으로 모든 insert가 `PGRST205` 에러로 실패 (파일 로깅만 성공)

## 2. 결과 요약
| ID | Partner count | DB count | resultCountDelta | missingInDb | extraInDb | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S01 | 16 | 58 | -42 | 16 | 58 | 기본 24h 픽업, 전혀 겹치지 않음 |
| S02 | 18 | 58 | -40 | 18 | 58 | 48h + high sort, 동일 현상 |
| S03 | 19 | 58 | -39 | 19 | 58 | weekend + newer sort |
| S04 | 21 | 58 | -37 | 21 | 58 | 5일 대여 |
| S05 | 21 | 58 | -37 | 21 | 58 | 10일 장기 |
| S06 | 0 | 0 | 0 | 0 | 0 | 운전자 21세: 양측 모두 가용차량 없음 |
| S07 | 0 | 58 | -58 | 0 | 58 | 배송, 파트너 0 (dongId 미적용 추정) |
| S08 | 0 | 58 | -58 | 0 | 58 | 배송 단기, partner 0 |
| S09 | 0 | 58 | -58 | 0 | 58 | 배송 + high sort, partner 0 |
| S10 | 0 | 0 | 0 | 0 | 0 | 배송 + driver21, 양측 0 |
| S11 | 0 | 58 | -58 | 0 | 58 | 배송 야간, partner 0 |
| S12 | 0 | 0 | 0 | 0 | 0 | 배송 + driver21 + high |

- **총 12건 중 5건(S01~S05)**만 partner 결과가 존재하며, DB 결과와 단 1건도 겹치지 않는다 (missing=partnerCount, extra=58).
- **DB totalCount 고정 58**: `fetchCandidateCars` 가 `active` + `rent_age` 조건만 쓰고 있어 검색 기간/옵션/배송을 전혀 반영하지 않는다.
- **가격 비교 불가**: DB 쪽 가격 필드가 전부 0이다 (`car_prices` 테이블 미구축 + 규칙 미적용) → `priceDiffs` 비어 있음.
- **배송 샘플(S07~S11)** 은 partner 응답이 0이거나 지역 리스트가 호환되지 않아 비교 불가. `dongId` 로 행정동 표준 코드를 사용했으나 partner 측 코드와 불일치하는 것으로 추정.

## 3. 핵심 이슈
1. **Supabase 테이블 미구축**
   - `car_prices` → 현재 가드로 에러만 무시, 실제 가격 계산 로직 부재.
   - `search_shadow_diffs` → insert 전부 `PGRST205`, Supabase SQL migration 적용 필요.

2. **검색 필터 미적용**
   - `fetchCandidateCars` 가 날짜/픽업옵션/위치 조건을 사용하지 않아 항상 58대를 반환.
   - `fetchBlockingReservations`, `composeReadModel` 이 예약 차단을 계산해도 입력 후보가 과도하게 크고 배송/픽업 구분이 전혀 없다.

3. **배송 지역 데이터 부재**
   - partner API가 기대하는 `dongId` 값이 불명확. 현재 사용한 행정동 코드로는 배송 결과가 0으로 떨어짐.
   - 실제 프론트가 사용하는 동코드 소스를 확보해 샘플을 교체해야 배송 시나리오 diff를 수집할 수 있다.

4. **가격/정렬 비교 불가**
   - DB 가격=0이라 price diff가 측정되지 않는다.
   - partner와 공통 carId 자체가 겹치지 않아 orderVariance/priceDiffs가 항상 0으로 집계된다.

## 4. 다음 단계 제안 (Phase 4-B~4-F 대비)
1. **Supabase migration 실행**: `car_prices`, `search_shadow_diffs` 생성 후 shadow insert & 가격 조회가 모두 가능하도록 함.
2. **배송 동 코드 입력원 확보**: partner 관리자 페이지나 기존 프론트 코드에서 사용하는 `dongId` 리스트를 추출해 샘플 교체.
3. **DB 후보 필터링 확장**: `fetchCandidateCars` 수준에서 `searchWindow`/`pickupOption`/`dongId` 관련 조건 설계 필요. (Phase 4-B/C).
4. **예약/상태 데이터 연동**: `reservations` seed 혹은 실제 데이터가 없는 상태이므로 blocking 규칙 자체가 테스트되지 않음 → 샘플 예약 데이터가 필요.
5. **가격 read model 설계**: `car_prices` 테이블과 가격 계산 파이프라인 정의(Phase 4-E 선행 작업).

## 5. 로그/데이터 참고
- Shadow raw log: `supabase/.temp/shadow-log.phase4a.jsonl`
- 분석 요약(JSON): `supabase/.temp/shadow-log.phase4a.summary.json`
- Supabase insert 에러 예시: `[shadow-diff] supabase insert failed code=PGRST205 (table search_shadow_diffs missing)`
