# PROJECT_STATE

## 현재 상태 요약
`rentcar00-booking-system`은 단순 홈페이지가 아니라 검색, 상세, 예약, 결제, 회원, 관리자, 가격 허브, 외부 플랫폼 동기화까지 포함한 운영형 예약 서비스다.

## Known Good State
- 서버 테스트: `node --test server/**/*.test.js` 통과
  - 78 tests / 78 pass / 0 fail
- 작업트리 확인 시 문서 정리 전 코드 변경 없음.
- 주요 구현 축:
  - React/Vite SPA
  - Vercel serverless API
  - Supabase DB/Auth
  - Solapi OTP/SMS
  - KCP 결제 준비/복귀 구조
  - 관리자 가격 허브
  - 카모아/찜카 동기화 스크립트
  - OPS 앱 예약 이벤트 outbox

## 현재 기준점
- 정책 기준: `docs/policies/RENTCAR00_POLICY.md`
- 결제/예약 무결성 기준: `docs/policies/RENTCAR00_BOOKING_PAYMENT_INTEGRITY_V1.md`
- 가격 허브 기준: `docs/policies/RENTCAR00_PRICING_HUB.md`
- 현재 상세 작업 문서는 `docs/PHASE`, 완료 문서는 `docs/COMPLETED`, 과거/폐기 문서는 `docs/ARCHIVE` 또는 기존 archive/past 영역으로 정리한다.

## 최근 완료 사항
- 카니발 홈페이지/카모아 가격 조정 완료: `docs/COMPLETED/2026-06-09_CARNIVAL_PRICE_AND_CARMORE_APPLY.md`
- 관리자 가격 패널 PC 리빌드 완료: `docs/COMPLETED/2026-06-06_ADMIN_PRICING_PANEL_PC_REBUILD.md`
- 카모아 sync vendor bundle recovery 완료: `docs/COMPLETED/2026-06-05_CARMORE_SYNC_VENDOR_BUNDLE_RECOVERY_COMPLETE.md`

## 진행 중 / 다음 phase
- 상태·이벤트·owner 기준 문서화 baseline 작성 완료:
  - `docs/PHASE/2026-06-11_RENTCAR00_DOCH_STATE_EVENT_MAP.md`
- 다음 후보 phase:
  - KCP approve 성공 후 예약 생성 실패를 복구 가능하게 남기는 Payment Ledger 최소 설계 PM

## 막힌 점 / 확인 필요
- KCP 운영 결제는 코드 저장 단계보다 KCP 상점 승인 가능 상태 확인이 blocker다.
- 홈페이지 DB 가격과 외부 플랫폼 가격은 변경 시 반영 결과/복구 근거를 함께 남겨야 한다.
- 카모아/찜카 동기화는 live save-run, launchd, DB 상태가 얽히므로 상태 owner와 재처리 기준을 먼저 봐야 한다.
- Preview 카카오 지도 검증용 고정 alias는 `https://rentcar00-booking-system-git-dev-otang00s-projects.vercel.app` 이다. Kakao Developers Web 플랫폼 도메인에는 이 alias를 유지 등록한다.


## 2026-06-29 IMS external sync split block local implementation
- PMDOC: `docs/PHASE/2026-06-29_IMS_EXTERNAL_SYNC_SPLIT_BLOCK_POLICY_PM.md`
- 상태: 로컬 구현 및 테스트 통과. 운영 반영/COMPLETE/commit은 아직 아님. 운영 save-run 전 mapping schema gate 필요.
- 정책: unmanaged wall + child block split. mapping 없는 찜카/카모아 차단은 삭제·흡수·replace하지 않고, IMS required coverage 중 빈 구간만 child block/date range로 생성한다.
- 추가된 검증 축: 공통 IMS required coverage builder, read-only 전역 coverage verifier, sync logger/admin event 검증.
- 검증: zzimcar 46 pass, carmore 18 pass, syncLogger 10 pass, sync-coverage 3 pass, build pass, diff check pass.
- 금지 유지: 외부 save-run/write, Supabase migration apply/push, deploy/restart/launchd, commit은 별도 승인 전 미실행.
- 운영 schema gate: 현재 찜카/카모아 mapping table과 repository upsert가 `ims_reservation_id` 단일 unique 기준이라 IMS 1건 -> 여러 child block 저장에 부족하다. child key/range 기반 schema/repository phase 승인 전 save-run 금지.


## 2026-06-29 IMS external sync child mapping schema local implementation
- PMDOC: `docs/PHASE/2026-06-29_IMS_EXTERNAL_SYNC_CHILD_MAPPING_SCHEMA_PM.md`
- 상태: 로컬 구현 및 테스트 통과. 운영 반영/COMPLETE/commit은 아직 아님.
- schema 파일: `supabase/migrations/20260629102000_update_external_sync_child_mapping_keys.sql`
- 변경: 찜카 `child_block_key`, 카모아 `child_holiday_key` 추가/backfill 후 `(ims_reservation_id, child_*_key)` unique 기준으로 전환. 기존 단일 `ims_reservation_id` unique index는 신규 index 생성 뒤 drop하도록 migration 파일만 준비.
- repo/reconcile: mapping upsert/failed/deleted 경로가 child key를 저장·대상 지정하도록 변경.
- 검증: zzimcar 47 pass, carmore 18 pass, syncLogger 10 pass, sync-coverage 4 pass, build pass, diff check pass.
- 금지 유지: Supabase migration apply/push, 외부 API save-run/write, deploy/restart/launchd, commit, `.env*`/secret 변경 미실행.


## 2026-06-29 IMS external sync verification correction
- 정정: 현재 상태는 로컬 코드/그린테스트 PASS이지, 실제 runner dry-run/read-only smoke/운영 데이터 coverage smoke 완료가 아니다.
- 다음 PMDOC 기준: `docs/PHASE/2026-06-29_IMS_EXTERNAL_SYNC_CHILD_MAPPING_SCHEMA_PM.md` 앞단 Phase 1~4에 runner side-effect 조사, no-write smoke 모드, read-only smoke, 실제 coverage smoke를 추가했다.
- 운영 DB migration/save-run/배포/커밋은 위 smoke gate 전까지 금지.

## 리스크
- 예약 상태, 결제 상태, 외부 플랫폼 휴무/가격 상태가 서로 다른 owner를 가진다.
- 관리자 UI/API가 운영 상태를 직접 바꾸는 구간은 guardrail이 필요하다.
- 문서 구조가 과거 `present/complete/archive`와 현재 `GOAL/PHASE/COMPLETED/ARCHIVE`가 섞여 있어, 새 문서는 4축 기준으로 작성한다.

## 다음 작업 후보
1. Payment Ledger 최소 설계 PM으로 KCP approve 성공 후 booking RPC 실패 시 복구 가능한 상태를 설계한다.
2. 이후 실제 구현·DB·외부 반영은 별도 phase 승인 후 진행한다.

## 2026-06-29 IMS external sync Phase 1~4 smoke result
- PMDOC: `docs/PHASE/2026-06-29_IMS_EXTERNAL_SYNC_CHILD_MAPPING_SCHEMA_PM.md`
- 상태: 승인된 `pa 1-4` 범위만 실행 완료. COMPLETE/commit/운영 반영 아님.
- no-write smoke 추가: IMS/찜카/카모아 runner에 `--no-write-smoke` 및 `NO_WRITE_SMOKE=true` 경로 추가. run row, mapping row, sync_events DB write, 외부 create/update/delete 없이 stdout/report만 반환.
- 실제 read-only smoke: 찜카 no-write smoke PASS(68 desired, 69 actual, unmanagedWall 1, replacements 67, errors 0), 카모아 no-write smoke PASS(68 desired, 69 actual, additions 1, deletions 2, unchanged 67, errors 0).
- coverage smoke: read-only verifier 결과 WARN. IMS `4320448` / `142호5773` / `2026-06-30T01:00:00.000Z~2026-07-03T01:00:00.000Z` 구간이 찜카와 카모아 각각 missing.
- 검증: no-write smoke test, zzimcar-sync, carmore-sync, sync-coverage, syncLogger, build, diff-check 모두 PASS.
- 금지 유지: Supabase migration apply/push, 외부 API write/save-run, deploy/restart/launchd, commit, `.env*`/secret 변경 미실행.

## 2026-06-30 IMS 4320448 existing external block mapping absorb COMPLETE
- PMDOC: `docs/COMPLETED/2026-06-30_IMS_4320448_EXISTING_BLOCK_MAPPING_ABSORB_PM_COMPLETE_20260630.md`
- 상태: B안 완료. 기존 외부 차단은 삭제/재생성하지 않고 라이브 DB mapping으로 흡수했다.
- 대상: IMS `4320448`, 차량 `142호5773`, `2026-06-30T01:00:00+00:00` ~ `2026-07-03T01:00:00+00:00`.
- 외부 차단: 찜카 `disableTimePid=231732`, 카모아 `holidaySerial=1605223` / memo `IMS 4320448`.
- DB 반영: `zzimcar_disable_time_sync_mappings` 1건, `carmore_holiday_sync_mappings` 1건 active mapping 추가.
- 검증: DB SELECT 확인, 찜카/카모아 no-write smoke에서 IMS `4320448`은 unchanged로 판정, targeted sync tests 48 pass, `npm run build` pass.
- 금지 유지: 외부 save-run/write, 외부 차단 삭제/재생성, Supabase migration apply/push, deploy/restart/launchd는 미실행.
- 후속 기준: child key migration은 아직 라이브 DB 미적용이며, 전체 save-run 전에는 migration/schema gate와 추가 no-write 검증이 필요하다.

## 2026-06-30 IMS external sync remaining live apply + Carmore recovery COMPLETE
- PMDOC: `docs/COMPLETED/2026-06-30_IMS_EXTERNAL_SYNC_REMAINING_LIVE_APPLY_PM_COMPLETE_20260630.md`
- 상태: recovery complete. `origin/dev` push, Supabase migration apply, 카모아 holiday 복구, final no-write smoke 완료.
- 적용 migration:
  - `20260629090500_create_sync_events.sql`
  - `20260629102000_update_external_sync_child_mapping_keys.sql`
  - `20260630004000_drop_legacy_external_sync_single_reservation_unique_indexes.sql`
- 사고/복구: 카모아 filtered canary에서 actual 전체 deletion이 발생하여 holiday 70건이 삭제됐고, 즉시 full recovery save-run과 mapping 재연결로 복구했다.
- 최종 카모아 no-write: desired 70 / actual 70 / additions 0 / deletions 0 / changes 0 / unchanged 70 / errors 0. IMS `4320448`, `4320591` 모두 unchanged.
- 최종 찜카 no-write: desired 70 / actual 69 / unmanagedWall 1 / additions 0 / deletions 0 / replacements 0 / unchanged 69 / errors 0. IMS `4320448` unchanged.
- 운영 반영: Vercel production deploy, launchd restart/kickstart는 미실행. 복구에는 불필요로 판단.
- 후속 필수: provider별 필터 save-run은 금지. 전체 actual을 좁히지 않는 필터 결함을 별도 코드 수정 PM으로 처리해야 한다.
