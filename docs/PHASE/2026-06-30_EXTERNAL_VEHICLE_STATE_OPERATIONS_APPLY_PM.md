# External Vehicle State 운영로그·적용 준비 PM

## 0. 문서 정보
- 작성일: 2026-06-30
- 상태: Phase 1~3 complete / waiting for migration apply approval
- 기준 커밋: `ee64791 Implement IMS external vehicle state planning`
- 목적: IMS 기준 외부 차량 상태 sync를 실제 운영 적용 가능한 수준으로 보강한다.
- 승인 범위: 운영로그 연결, 차량별 리포트 강화, DB migration apply 준비/검증, 실제 write 전 최종 gate 작성.
- 제외 범위: 이 PMDOC 작성 시점에는 DB migration apply, 카모아/찜카 실제 write, deploy, launchd restart 미실행.
- 완료 후 문서명: `docs/COMPLETED/2026-06-30_EXTERNAL_VEHICLE_STATE_OPERATIONS_APPLY_PM_COMPLETE_20260630.md`

## 1. 현재 점검 결과

### 1-1. 실제 상태
- 전체 차량: 60대
- 3사 정책 일치: 33대
- 불일치: 27대
- 카모아 write 필요: 17대
- 찜카 write 필요: 15대
- 조회 에러: 0건

### 1-2. 가상 write 검증
- 실제 API/DB write 없이 현재 planner 결정값을 가상 적용했다.
- 결과:
  - before mismatch: 27대
  - after mismatch: 0대
  - virtualPass: true
  - touched vehicles: 27대
- 결론: 현재 정책/플래너 기준으로 실제 write가 정상 수행되면 3사 상태는 일치한다.

### 1-3. 현재 부족한 점
- 신규 `external-vehicle-state-sync` runner가 아직 `sync_events` 운영로그를 직접 쓰지 않는다.
- no-write 출력이 count 중심이라 차량별 적용 리스트를 운영자가 즉시 확인하기 어렵다.
- migration 파일은 있으나 live DB apply는 아직 안 됐다.
- save-run은 hard fail 상태라 안전하지만, 실제 write phase는 아직 없다.

## 2. 확정 적용 순서

1. 운영로그 `sync_events` 연결
2. 차량별 상태표 리포트 강화
3. migration apply 전 SQL/schema 검증
4. migration apply 승인 대기
5. migration apply 후 mapping 저장 no-write 검증
6. 실제 write save-run 별도 승인 대기
7. 카모아/찜카 write 실행
8. write 후 no-write smoke로 3사 일치 재확인
9. 필요 시 deploy/launchd 판단

## 3. Phase 목록

### Phase 1. `sync_events` 운영로그 연결
- 목적: external vehicle state runner도 기존 IMS/카모아/찜카 예약 차단 runner와 동일하게 운영로그를 남긴다.
- 변경점:
  - `run-external-vehicle-state-sync.js`에 `createSyncLogger` 연결.
  - stage: `external_vehicle_state_sync`
  - provider: provider별 이벤트는 `carmore`, `zzimcar`; 전체 summary는 `system` 또는 provider metadata로 기록.
  - no-write smoke에서는 기본적으로 DB 로그 write를 하지 않거나, 명시 옵션으로만 로그 저장한다.
  - save/apply 계열에서는 start/completion/failure 이벤트를 `sync_events`에 best-effort 저장한다.
- eventType 기준:
  - `external_vehicle_state_sync_start`
  - `external_vehicle_state_sync_plan`
  - `external_vehicle_state_sync_success`
  - `external_vehicle_state_sync_partial_success`
  - `external_vehicle_state_sync_failed`
  - `external_vehicle_state_write_planned`
- 종료조건:
  - no-write에서는 외부/DB 상태 write 없음.
  - logger unit test 통과.
  - 기존 `sync_events` repository 패턴 사용.
- 검증:
  - 신규 logger test
  - 기존 external vehicle state tests
  - 카모아/찜카 기존 tests

### Phase 2. 차량별 상태표 리포트 강화
- 목적: 운영자가 어떤 차량이 어떻게 바뀌는지 한눈에 볼 수 있게 한다.
- 변경점:
  - runner summary에 `rows` 또는 `reportRows` 추가.
  - 필드:
    - `carNumber`
    - `activeMonthly`
    - `activeMonthlyReservationIds`
    - `imsGeneral`, `imsMonthly`
    - `carmoreBefore`, `carmoreAfter`, `carmoreAction`
    - `zzimcarBefore`, `zzimcarAfter`, `zzimcarAction`
    - `allMatchBefore`, `allMatchAfter`
  - `--report-json` 또는 기본 JSON에 포함할지 결정.
- 종료조건:
  - 실제 write 전 touched vehicle 27대를 정확히 출력.
  - 가상 적용 후 mismatch 0을 summary에 표시.
- 검증:
  - injected actual 기반 unit test
  - live no-write smoke

### Phase 3. migration apply 전 검증
- 목적: DB apply 전 SQL과 repository mapping을 검증한다.
- 변경점:
  - migration SQL lint/inspection.
  - provider별 repo row shape와 table column 일치 테스트.
  - `pricing_hub_*`와 섞이지 않는지 확인.
- 종료조건:
  - `git diff --check` 통과.
  - tests/build 통과.
  - migration apply 대상 파일 2개 명확히 보고.
- 검증:
  - `node --test scripts/external-vehicle-state-sync/__tests__/*.test.js`
  - `npm run build`

### Phase 4. migration apply 승인 대기
- 목적: live DB 상태 변경 전 승인 지점을 명확히 둔다.
- 실행:
  - 이 phase는 자동 실행하지 않는다.
  - 사용자에게 아래를 보고하고 승인 대기:
    1. 적용 migration 파일
    2. 생성 table
    3. 영향 범위
    4. rollback 전략
- 종료조건:
  - 승인 전 미실행.

### Phase 5. migration apply 후 mapping 저장 no-write 검증
- 목적: 외부 write 없이 DB mapping 저장만 검증한다.
- 전제:
  - Phase 4에서 migration apply 승인 및 적용 완료.
- 변경점:
  - `--persist-plan` 또는 별도 mode로 provider별 mapping row 저장 검증.
  - 외부 write는 여전히 금지.
- 종료조건:
  - `carmore_vehicle_state_sync_mappings`, `zzimcar_vehicle_state_sync_mappings`에 planned/skipped row 저장 확인.
  - sync_events에도 plan/completion 이벤트 저장 확인.
- 검증:
  - 저장 row count
  - 최근 sync_events 확인
  - no external write confirmation

### Phase 6. 실제 write save-run PM/승인 대기
- 목적: 외부 상태 변경 전 별도 승인 문서를 만들고 멈춘다.
- 실행:
  - 이 PM 범위에서 실제 write는 하지 않는다.
  - 별도 PM에는 다음을 포함한다:
    - 카모아 write 17건
    - 찜카 write 15건
    - touched vehicles 27대
    - 가상 적용 후 mismatch 0 근거
    - 실패 시 중단/재검증 기준
- 종료조건:
  - 실제 write 전 사용자 명시 승인 대기.

## 4. 중단 조건
- 가상 적용 결과가 mismatch 0이 아니게 변함.
- 카모아/찜카 조회 에러가 발생함.
- 차량번호 매칭 0건 또는 다건 발생.
- sync_events 저장 실패가 best-effort 범위를 넘어 runner 실패를 유발함.
- migration apply 또는 외부 write 승인이 없는 상태에서 상태 변경이 필요해짐.

## 5. Phase 1~3 실행 결과
- 실행일: 2026-06-30
- 완료 phase:
  - Phase 1 `sync_events` 운영로그 연결
  - Phase 2 차량별 상태표 리포트 강화
  - Phase 3 migration apply 전 검증
- 운영로그 연결:
  - `run-external-vehicle-state-sync.js`에 `createSyncLogger` 연결 완료.
  - eventType: `external_vehicle_state_sync_start`, `external_vehicle_state_sync_plan`, `external_vehicle_state_sync_success`, `external_vehicle_state_sync_partial_success`.
  - no-write smoke 기본값에서는 DB 로그 저장 없이 콘솔 structured event만 출력한다.
  - `--persist-logs` 또는 `EXTERNAL_VEHICLE_STATE_PERSIST_LOGS=true`일 때만 no-write 로그 DB 저장을 허용한다.
- 차량별 리포트:
  - `reportSummary`, `reportRows` 추가.
  - `--report-json` 또는 `EXTERNAL_VEHICLE_STATE_REPORT_JSON=true`로 전체 차량별 before/after 출력 가능.
- live no-write summary:
  - total: 60
  - beforeMismatch: 27
  - afterMismatch: 0
  - virtualPass: true
  - touchedVehicles: 27
  - 카모아 setState: 17 / errors 0
  - 찜카 setState: 15 / errors 0
  - wroteExternal false
  - wroteDb false
- 검증 결과:
  - 신규 external vehicle state 테스트: 5 pass
  - 카모아 테스트: 20 pass
  - 찜카 테스트: 47 pass
  - build: pass
  - live no-write smoke with report: pass
- DB apply 여부: 미실행
- 외부 write 여부: 미실행
- 다음 승인 필요 항목:
  1. Supabase migration apply
  2. apply 후 mapping 저장 no-write 검증
  3. 실제 카모아/찜카 write save-run 별도 PM/승인

## 6. 완료 보고 형식
- 완료 phase:
- 변경 파일:
- 검증 결과:
- live no-write summary:
- 운영로그 연결 여부:
- DB apply 여부:
- 외부 write 여부:
- 다음 승인 필요 항목:
