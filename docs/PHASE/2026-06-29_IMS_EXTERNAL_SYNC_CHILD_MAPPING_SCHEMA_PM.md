# IMS External Sync Child Mapping Schema PM

## 0. 문서 정보
- 작성일: 2026-06-29
- 상태: Draft - 승인 대기
- 목적: split child block 정책을 운영 save-run까지 안전하게 연결하기 위해 찜카/카모아 mapping DB 구조와 repository upsert 기준을 `IMS 1건 -> 여러 child block/holiday` 저장 가능 구조로 바꾼다.
- 선행 PMDOC: `docs/PHASE/2026-06-29_IMS_EXTERNAL_SYNC_SPLIT_BLOCK_POLICY_PM.md`
- 완료 후 후보 경로: `docs/COMPLETED/2026-06-29_IMS_EXTERNAL_SYNC_CHILD_MAPPING_SCHEMA_PM_COMPLETE_YYYYMMDD.md`

## 1. 비개발자 기준 설명
현재 split 정책은 IMS 예약 1건이 외부 차단 여러 개로 쪼개질 수 있다.

예시:
- IMS 예약: `6/22~7/10`
- 기존 수동 차단: `6/30~7/5`
- 새로 만들어야 할 child block:
  - `6/22~6/29`
  - `7/6~7/10`

그런데 현재 DB mapping은 IMS 예약 1건당 mapping 1개만 저장하는 구조다.
그래서 child block 2개를 저장하려 하면 나중 값이 앞 값을 덮거나, 운영 save-run 상태 추적이 깨질 수 있다.

따라서 운영 save-run 전에는 mapping schema를 먼저 고쳐야 한다.

## 2. 현재 확인 근거
현재 구조:
- 찜카 table: `zzimcar_disable_time_sync_mappings`
- 카모아 table: `carmore_holiday_sync_mappings`

문제 근거:
- `supabase/migrations/20260429131000_create_zzimcar_disable_time_sync_mappings.sql`
  - unique index: `ims_reservation_id`
- `supabase/migrations/20260530003000_create_carmore_holiday_sync_tables.sql`
  - unique index: `ims_reservation_id`
- `scripts/zzimcar-sync/lib/zzimcar-sync-mapping-repo.js`
  - `upsert(... onConflict: 'ims_reservation_id')`
- `scripts/carmore-sync/lib/carmore-sync-mapping-repo.js`
  - `upsert(... onConflict: 'ims_reservation_id')`

현재 판정:
- 로컬 split 계산/테스트는 PASS.
- 운영 save-run은 schema gate 때문에 금지.

## 3. 확정 정책
### 3-1. mapping 소유 기준
- IMS 예약 id는 원본 예약 추적용이다.
- child block/holiday는 외부 차단 저장 단위다.
- 운영 mapping의 unique 기준은 `ims_reservation_id` 단독이면 안 된다.
- unique 기준은 provider별 child 단위를 식별할 수 있어야 한다.

### 3-2. 찜카 mapping 기준
찜카 child key 후보:
- `ims_reservation_id`
- `zzimcar_vehicle_pid`
- `child_block_start_at`
- `child_block_end_at`

또는 별도 `child_block_key` 컬럼:
- 예: `imsReservationId:startAt:endAt`

권장:
- 명시 컬럼 `child_block_key` 추가
- unique index: `(ims_reservation_id, child_block_key)`
- 기존 `zzimcar_disable_time_pid`는 외부 생성 결과 추적값으로 유지

### 3-3. 카모아 mapping 기준
카모아 child key 후보:
- `ims_reservation_id`
- `carmore_rentcar_serial`
- `holiday_start_date`
- `holiday_end_date`

또는 별도 `child_holiday_key` 컬럼:
- 예: `imsReservationId:holidayStartDate:holidayEndDate`

권장:
- 명시 컬럼 `child_holiday_key` 추가
- unique index: `(ims_reservation_id, child_holiday_key)`
- 기존 `carmore_holiday_serial`은 외부 생성 결과 추적값으로 유지

### 3-4. 기존 데이터 처리
- 기존 active mapping은 child key를 backfill해야 한다.
- 기존 단일 mapping은 기존 `start_at/end_at` 또는 `holiday_start_date/holiday_end_date` 기준으로 child key를 생성한다.
- 기존 mapping을 삭제하지 않는다.
- 기존 `ims_reservation_id` 단일 unique index는 새 unique index 적용 후 제거하거나 비활성화해야 한다.
- 운영 DB 적용 전에는 dry-run SQL 검토가 필요하다.


## 3-A. 운영 검증 우선 정책: dry-run / smoke / 실제 coverage gate
이번 작업의 완료 기준은 그린테스트가 아니다. 운영 판단 전 반드시 실제 실행 흐름을 단계별로 검증한다.

### 3-A-1. no-write dry-run 원칙
- dry-run은 외부 API write를 하지 않는 것만으로 부족하다.
- dry-run은 가능하면 DB write도 하지 않는 no-write 모드여야 한다.
- 기존 runner가 `sync_runs` 등 DB 기록을 남기는 경우, 그것은 완전 no-write dry-run이 아니다.
- 따라서 먼저 runner별 side effect를 확인하고, 필요하면 no-write smoke 모드를 분리한다.

### 3-A-2. read-only smoke 원칙
read-only smoke는 실제 운영 데이터를 읽어서 아래를 확인한다.
- IMS active/future 예약 조회 가능 여부
- 홈페이지/internal 차단 기준 조회 가능 여부
- 찜카 현재 disable_time 조회 가능 여부
- 카모아 현재 holiday 조회 가능 여부
- mapping DB 조회 가능 여부
- sync logger가 dry-run/smoke 이벤트를 남길 수 있는지 여부

단, 이 단계에서도 외부 write/save-run은 금지한다.

### 3-A-3. 실제 coverage 검증 원칙
단순히 runner가 성공하는지 보지 않는다.
IMS 예약 구간이 실제로 다음 세 군데에서 막혔는지 비교한다.
- 홈페이지/internal availability
- 찜카 disable_time coverage
- 카모아 holiday coverage

검증 결과는 아래로 나눈다.
- PASS: required coverage가 모두 막힘
- WARN: unmanaged wall이 대신 막고 있음
- FAIL: 실제 판매 가능 구간이 남아 있음
- UNKNOWN: 조회 실패 또는 데이터 불충분

### 3-A-4. code-use real test 원칙
코드만 테스트하지 않는다. 구현된 실제 runner/verifier 코드를 사용해 운영 데이터 read-only smoke를 수행한다.
테스트 fixture가 아니라 실제 연결 경로를 탄다.
단, save-run/write는 별도 승인 전까지 금지한다.

## 4. 실행 금지
이 PM 승인 전 및 각 phase 별도 승인 전 금지:
- Supabase migration apply/push
- 외부 API save-run/write
- deploy/restart/launchd
- commit
- `.env*`, secret, token, credential 수정

## 5. Phase 목록

### Phase 1. runner side-effect 조사
- 목적: 현재 IMS/찜카/카모아 runner의 dry-run이 정말 no-write인지 확인한다.
- 변경점: 없음. 조사/기록만 한다.
- 확인대상:
  - `scripts/ims-sync/run-ims-reservation-sync.js`
  - `scripts/zzimcar-sync/run-zzimcar-reconcile-sync.js`
  - `scripts/carmore-sync/run-carmore-reconcile-sync.js`
  - 각 run repo / mapping repo / logger repo
- 종료조건:
  - dry-run 시 DB write 여부, external write 여부, logger write 여부가 표로 정리된다.
- 검증방법:
  - 코드 경로 직접 확인
  - write 함수 호출 grep
- 출력보고:
  - no-write 가능/불가능 runner 목록

### Phase 2. no-write smoke 모드 준비
- 목적: 운영 데이터 read-only 검증 전에 DB/external write 없는 smoke 실행 경로를 확보한다.
- 변경점:
  - 필요 시 `--no-write-smoke` 또는 equivalent option 추가
  - sync run 기록, mapping update, external write, DB migration, deploy 없이 summary만 출력
  - logger도 stdout only 또는 best-effort off 옵션 제공
- 변경대상 후보:
  - IMS/찜카/카모아 runner
  - sync coverage verifier
  - logger option
- 종료조건:
  - no-write smoke 실행 시 DB/external write 경로가 호출되지 않는다.
- 검증방법:
  - mock client/mock repo 테스트
  - grep 및 테스트로 write 함수 미호출 확인
- 출력보고:
  - 실제 실행 명령 후보와 side-effect 없음 근거

### Phase 3. read-only smoke 실행
- 목적: 실제 운영 연결을 읽기 전용으로 타서 데이터 조회 가능성을 확인한다.
- 실행 전제: 사용자 별도 승인 필요.
- 실행 범위:
  - IMS active/future 예약 조회
  - mapping DB 조회
  - 찜카 current disable_time 조회
  - 카모아 current holiday 조회
  - 홈페이지/internal availability 조회 가능성 확인
- 금지:
  - create/update/delete/save-run
  - DB migration apply
  - deploy/restart
- 종료조건:
  - provider별 조회 성공/실패가 기록된다.
- 출력보고:
  - 조회 성공 provider
  - 조회 실패 provider
  - 인증/권한/데이터 부족 이슈

### Phase 4. 실제 coverage smoke 검증
- 목적: 실제 운영 데이터 기준으로 IMS 예약이 홈페이지/찜카/카모아에서 막혔는지 비교한다.
- 실행 전제: Phase 3 통과 및 사용자 별도 승인.
- 변경점:
  - 전역 coverage verifier가 실제 조회 결과를 입력받아 PASS/WARN/FAIL/UNKNOWN report 출력
- 종료조건:
  - critical missing coverage 목록이 나온다.
  - unmanaged wall로 커버된 구간은 WARN으로 분리된다.
- 검증방법:
  - 실제 read-only smoke report
- 출력보고:
  - PASS/WARN/FAIL/UNKNOWN 집계
  - 차량/예약별 missing coverage

### Phase 5. schema 설계 확정
- 목적: child mapping key 구조를 확정한다.
- 변경점:
  - 찜카: `child_block_key` 기준 확정
  - 카모아: `child_holiday_key` 기준 확정
  - 기존 index 제거/신규 index 생성 순서 확정
- 변경대상:
  - 이 PMDOC
  - 필요 시 `PROJECT_STATE.md`
- 종료조건:
  - DB 컬럼, unique index, backfill 방식 확정
- 검증방법:
  - 기존 migration/repo와 비교 검토
- 출력보고:
  - 최종 schema 변경안

### Phase 6. migration 파일 작성
- 목적: 운영 DB에 적용할 수 있는 migration SQL을 파일로만 준비한다.
- 변경점:
  - 찜카 mapping table에 `child_block_key` 추가
  - 카모아 mapping table에 `child_holiday_key` 추가
  - 기존 row backfill
  - 신규 unique index 생성
  - 기존 `ims_reservation_id` 단일 unique index 제거
- 변경대상 후보:
  - `supabase/migrations/YYYYMMDDHHMMSS_update_external_sync_child_mapping_keys.sql`
- 종료조건:
  - migration 파일 작성 완료
  - 실제 DB 적용은 하지 않음
- 검증방법:
  - SQL 문법/순서 리뷰
  - 가능하면 local/static 검증
- 리스크:
  - 운영 DB 상태가 migration 파일과 다르면 적용 전 중단 필요
- 출력보고:
  - migration 요약

### Phase 7. mapping repository upsert 기준 변경
- 목적: save-run 시 child block 여러 개가 서로 덮어쓰지 않게 한다.
- 변경점:
  - 찜카 repo `upsertMapping`, `markMappingFailed` onConflict 변경
  - 카모아 repo `upsertMapping`, `markMappingFailed` onConflict 변경
  - delete/failed 처리 시 child key 기준을 함께 사용
- 변경대상:
  - `scripts/zzimcar-sync/lib/zzimcar-sync-mapping-repo.js`
  - `scripts/carmore-sync/lib/carmore-sync-mapping-repo.js`
- 종료조건:
  - IMS 1건의 child block 2개가 서로 다른 mapping row로 유지됨
- 검증방법:
  - mock Supabase upsert payload/onConflict 테스트
- 리스크:
  - 기존 단일 mapping 조회 코드가 child 복수 row를 처리해야 함
- 출력보고:
  - repo 변경 요약

### Phase 8. reconcile 저장 경로 child key 연결
- 목적: split 계산 결과의 child key가 DB mapping에 저장되게 한다.
- 변경점:
  - 찜카 `childBlockKey` 저장
  - 카모아 `childHolidayKey` 저장
  - deletion/change/failure 경로에서 child key 보존
- 변경대상:
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - `scripts/carmore-sync/lib/reconcile-carmore-holidays.js`
  - 관련 tests
- 종료조건:
  - split child 2개 이상 생성 케이스에서 mapping 2개가 만들어지는 mock 검증 통과
- 검증방법:
  - 찜카 save-run mock test
  - 카모아 save-run mock test
- 출력보고:
  - child key 흐름

### Phase 9. 전역 coverage verifier와 mapping schema 정합성 검증
- 목적: 검증기가 child mapping 다건 구조를 읽어도 coverage 판단이 맞는지 확인한다.
- 변경점:
  - verifier fixture에 IMS 1건 -> child 2개 케이스 추가
  - unmanaged wall + child 2개 coverage 판단 확인
- 변경대상:
  - `scripts/sync-coverage/verify-external-block-coverage.js`
  - `scripts/sync-coverage/__tests__/*.test.js`
- 종료조건:
  - critical missing coverage 0건 판정 테스트 통과
- 검증방법:
  - sync-coverage tests
- 출력보고:
  - coverage report 예시

### Phase 10. 통합 검증
- 목적: schema/repo/reconcile/verifier 변경이 전체 sync 테스트를 깨지 않는지 확인한다.
- 검증 명령:
  - `npm run test:zzimcar-sync`
  - `npm run test:carmore-sync`
  - `node --test server/logging/__tests__/syncLogger.test.js`
  - `node --test scripts/sync-coverage/__tests__/*.test.js`
  - `npm run build`
  - `git diff --check`
- 종료조건:
  - 전체 통과
  - 외부 write/save-run/DB migration apply/deploy/restart/commit 미실행 확인
- 출력보고:
  - 명령별 결과

### Final Phase. 운영 적용 판단 게이트
- 목적: 로컬 구현 완료 후 운영 적용 여부를 별도 승인으로 판단한다.
- 완료 전제:
  - runner side-effect 조사 완료
  - no-write smoke 모드 확보
  - read-only smoke 실행 결과 확보
  - 실제 coverage smoke report 확보
  - migration 파일 리뷰 완료
  - repo/reconcile tests 통과
  - coverage verifier 통과
  - Reviewer PASS
- 별도 승인 필요:
  - Supabase migration apply/push
  - 실제 외부 read-only coverage 조회
  - 찜카/카모아 save-run
  - deploy/restart
  - commit
- 종료조건:
  - 운영 적용 전이면 PMDOC는 PHASE 유지
  - 운영 적용 및 검증 완료 후에만 COMPLETED 이동 가능

## 6. 중단 조건
아래 발견 시 즉시 중단하고 재승인 받는다.
- 운영 DB에 예상과 다른 unique/index/column 상태가 있음
- 기존 active mapping 중 child key backfill 불가 row가 있음
- child mapping 복수화가 기존 deletion/recovery 로직과 충돌함
- 외부 save-run 없이는 검증 불가능한 상태가 됨
- 운영 DB migration 적용이 필요해짐

## 7. 완료 보고 형식
- schema 변경 파일:
- repo 변경 파일:
- reconcile 변경 파일:
- 검증 결과:
- DB migration 적용 여부:
- 외부 write 여부:
- Reviewer 판정:
- 남은 운영 승인:

## 8. 로컬 실행 결과 (2026-06-29)
- 상태: Local implementation/test verified - 운영 반영/COMPLETE/commit 대기
- migration 파일 작성: `supabase/migrations/20260629102000_update_external_sync_child_mapping_keys.sql`
- repo 변경: 찜카/카모아 mapping upsert 기준을 `ims_reservation_id + child_*_key`로 변경
- reconcile 저장 경로: child key 저장/실패/삭제 경로에 전달
- coverage 보강: IMS 1건 -> child 2건 + unmanaged wall 커버리지 테스트 추가
- 검증:
  - `npm run test:zzimcar-sync` PASS
  - `npm run test:carmore-sync` PASS
  - `node --test server/logging/__tests__/syncLogger.test.js` PASS
  - `node --test scripts/sync-coverage/__tests__/*.test.js` PASS
  - `npm run build` PASS
  - `git diff --check` PASS
- 미실행/보호 준수:
  - Supabase migration apply/push 미실행
  - 외부 API save-run/write 미실행
  - deploy/restart/launchd 미실행
  - commit 미실행
  - `.env*`/secret 변경 없음
- 남은 게이트: 운영 DB migration 적용, 외부 read-only coverage 조회, save-run, deploy/restart, commit은 별도 승인 필요


## 8. 2026-06-29 상태 정정
- 이전 보고의 `PASS`는 단위/fixture 테스트, build, diff check, reviewer 기준 PASS였다.
- 실제 runner dry-run, read-only smoke, 운영 데이터 coverage smoke는 아직 완료되지 않았다.
- 따라서 현재 완료 표현은 `로컬 코드/그린테스트 PASS`로 제한한다.
- 운영 완료 판단은 Phase 1~4의 dry-run/smoke/coverage gate를 통과한 뒤에만 가능하다.

## 9. Phase 1~4 실행 결과 (2026-06-29 pa 1-4)
- 상태: Phase 1~4 실행 완료, COMPLETE 아님.
- Phase 1 runner side-effect 조사:
  - IMS runner 기본 경로: `reservation_sync_runs` insert/update, `ims_reservations_raw` insert/update, `ims_sync_reservations` upsert, `reservation_sync_errors` insert, `sync_events` logger insert 가능. `IMS_SYNC_DRY_RUN=true` 또는 `--no-write-smoke`에서는 DB write 없음.
  - 찜카 runner 기존 dry-run: `zzimcar_sync_runs` insert/update, `sync_events` logger insert 가능. no-write smoke 추가 후 run row/logger DB write 없음.
  - 카모아 runner 기존 dry-run: `carmore_sync_runs` insert/update, `sync_events` logger insert 가능. no-write smoke 추가 후 run row/logger DB write 없음.
  - mapping repo write 함수: 찜카/카모아 `upsertMapping`, `markMappingDeleted`, `markMappingFailed`는 save-run에서만 호출되며 no-write smoke test로 미호출 검증.
- Phase 2 no-write smoke 모드:
  - 공통 env/CLI: `NO_WRITE_SMOKE=true`, `--no-write-smoke`
  - provider env: `IMS_NO_WRITE_SMOKE=true`, `ZZIMCAR_NO_WRITE_SMOKE=true`, `CARMORE_NO_WRITE_SMOKE=true`
  - no-write smoke mode는 `mode: "no-write-smoke"`만 stdout/report로 반환하고 run row, mapping row, sync_events DB write, 외부 create/update/delete를 금지한다.
- Phase 3 read-only smoke:
  - 찜카: `NO_WRITE_SMOKE=true node scripts/zzimcar-sync/run-zzimcar-reconcile-sync.js --no-write-smoke` 실제 코드 경로 실행. 결과 요약: desired 68, actual 69, unmanagedWall 1, additions 0, deletions 2, replacements 67, unchanged 0, errors 0. DB write/save-run 없음.
  - 카모아: `NO_WRITE_SMOKE=true node scripts/carmore-sync/run-carmore-reconcile-sync.js --no-write-smoke --limit 0` 실제 코드 경로 실행. 결과 요약: desired 68, actual 69, unmanagedWall 0, additions 1, deletions 2, changes 0, unchanged 67, errors 0. DB write/save-run 없음.
- Phase 4 coverage smoke:
  - `.env`를 source하여 기존 read-only Supabase connector로 실행.
  - 결과: `WARN`, readOnly true, IMS required coverage 68, zzimcar mappings 69, carmore mappings 69.
  - provider coverage: homepage 68/68 covered, zzimcar 67/68 covered, carmore 67/68 covered.
  - missing: IMS `4320448`, car `142호5773`, `2026-06-30T01:00:00.000Z` ~ `2026-07-03T01:00:00.000Z`가 찜카/카모아 각각 missing.
- 검증:
  - `node --test scripts/no-write-smoke.test.js` PASS
  - `npm run test:zzimcar-sync` PASS
  - `npm run test:carmore-sync` PASS
  - `node --test scripts/sync-coverage/__tests__/*.test.js` PASS
  - `node --test server/logging/__tests__/syncLogger.test.js` PASS
  - `npm run build` PASS
  - `git diff --check` PASS
- 보호 준수:
  - Supabase migration apply/push 미실행
  - 외부 API write/save-run/create/update/delete 미실행
  - deploy/restart/launchd/commit 미실행
  - `.env*`/secret 변경 없음
