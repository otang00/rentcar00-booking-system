# Sync Logger Unification and Overlap Recovery PM

## 0. 문서 정보
- 작성일: 2026-06-28
- 작성자/agent: OpenClaw / rentcar00_reservation_developer
- 상태: Draft
- 승인 범위: 실행 전 계획 문서. 코드 수정, DB 변경, 외부 플랫폼 write, launchd/restart/deploy는 별도 승인 전 미실행.
- 관련 문서:
  - `PROJECT_STATE.md`
  - `docs/PHASE/ZZIMCAR_SYNC_STATUS_POLICY_PHASE3.md`
  - `docs/PHASE/2026-06-26_OTP_COMMON_LOGGER_ERROR_UI_PM.md`
- 완료 후 문서명: `docs/COMPLETED/2026-06-28_SYNC_LOGGER_UNIFICATION_AND_OVERLAP_RECOVERY_PM_COMPLETE_YYYYMMDD.md`
- 상태/정책문서 업데이트 대상:
  - `PROJECT_STATE.md`
  - 필요 시 `docs/policies/RENTCAR00_POLICY.md`
  - 필요 시 sync 운영 문서 신규/갱신

## 1. 목적
- 목표:
  - IMS / 찜카 / 카모아 sync 로그를 같은 기준으로 구조화한다.
  - 운영자가 관리자 화면에서 sync 실패, 경고, 부분성공, stale mapping, overlap duplicate를 바로 볼 수 있게 한다.
  - 이후 찜카 `VEHICLE_SCHEDULE_DUPLICATION_ERROR` 케이스를 update 없이, 내부 DB 재계산 결과와 찜카 현재 disable_time을 비교해 조회/삭제/생성만으로 복구할 수 있게 한다.
- 성공 기준:
  - sync 공통 이벤트 포맷이 정의된다.
  - IMS / 찜카 / 카모아 runner가 최소한 같은 logger 인터페이스를 사용한다.
  - 찜카 overlap 실패가 파일 로그 큰 JSON 안에 묻히지 않고 DB/admin 표시 대상으로 남는다.
  - `101하7003` 같은 겹침 케이스에 대한 테스트가 추가된다.
- 제외 범위:
  - 승인 전 DB migration 적용 금지.
  - 승인 전 찜카/카모아/IMS 외부 write 금지.
  - 승인 전 launchd/restart/deploy 금지.
  - `.env*`, secret, token, credential 수정 금지.

## 2. 현재 상태
- 확인한 파일/docs:
  - `PROJECT_STATE.md`
  - `server/logging/appLogger.js`
  - `scripts/ims-sync/run-ims-reservation-sync.js`
  - `scripts/zzimcar-sync/run-zzimcar-reconcile-sync.js`
  - `scripts/carmore-sync/run-carmore-reconcile-sync.js`
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - `scripts/zzimcar-sync/lib/fetch-desired-ims-reservations.js`
  - `scripts/zzimcar-sync/lib/zzimcar-sync-run-repo.js`
  - `scripts/zzimcar-sync/lib/zzimcar-sync-mapping-repo.js`
  - `scripts/carmore-sync/lib/carmore-sync-run-repo.js`
  - `scripts/carmore-sync/lib/carmore-sync-mapping-repo.js`
  - `api/admin/bookings.js`
  - `src/pages/AdminBookingsPage.jsx`
- 현재 git 상태:
  - PM 작성 전 `git status --short` 출력 없음. 작업트리 clean 기준.
- 기존 구현/문서 상태:
  - `server/logging/appLogger.js`는 홈페이지/API용 JSON logger지만 sync script runner와 연결되어 있지 않다.
  - IMS runner는 stdout/stderr 중심으로 summary JSON을 파일 로그에 남긴다.
  - 찜카/카모아 runner도 stdout/stderr와 각 sync run table/mapping table 중심이다.
  - 관리자 화면은 최신 run summary와 mapping 실패 일부만 표시한다.
  - 찜카 `fetch-desired-ims-reservations.js`의 `collapseOverlappingReservationsByCar()`는 실제 기간 병합이 아니라 겹치는 예약 중 대표 1건을 선택한다.
  - 찜카 `reconcile-zzimcar-disable-times.js`에는 `recover_missing_disable_time` 흐름이 있으나, 내부 DB 재계산 결과를 기준으로 찜카 현재 disable_time을 전체 reconcile하는 구조는 확인되지 않았다.
- 확인 필요:
  - DB에 공통 `sync_events` 테이블이 이미 있는지 여부.
  - Supabase migration 현황.
  - 찜카 disable_time은 문서/실검증 기준 조회/생성/삭제만 확정. update API는 없는 것으로 본다.
  - 관리자 화면에 표시할 이벤트 보존 기간/건수.

## 3. 전체 변경 요약
- 변경점:
  - sync 공통 logger 모듈 추가.
  - IMS / 찜카 / 카모아 sync runner 및 핵심 reconcile 단계에 구조화 이벤트 기록 추가.
  - DB event 저장소를 추가하거나 기존 run/error 구조를 확장한다.
  - 관리자 화면에서 최신 실패뿐 아니라 warning/stale/overlap/recovery failed를 표시한다.
  - 찜카 overlap duplicate는 update 없이 내부 DB active 예약에서 차량 blocked interval을 매번 재계산하고, 찜카 현재 disable_time과 비교해 필요한 삭제/생성으로 맞춘다.
- 변경대상:
  - `server/logging/appLogger.js` 또는 신규 `server/logging/syncLogger.js`
  - `scripts/ims-sync/**`
  - `scripts/zzimcar-sync/**`
  - `scripts/carmore-sync/**`
  - `api/admin/bookings.js`
  - `src/pages/AdminBookingsPage.jsx`
  - Supabase migration 또는 기존 sync run/error table 확장 파일
  - 관련 테스트 파일
- 예상 영향:
  - 운영 로그 가시성이 올라간다.
  - sync 실패 원인 추적 시간이 줄어든다.
  - DB schema 변경을 포함할 경우 배포/운영 리스크가 생긴다.
- 주요 리스크:
  - logger가 외부 sync 본 작업을 방해하면 안 된다.
  - logging DB write 실패가 sync 본 작업 실패로 전파되면 안 된다.
  - 개인정보/토큰/인증값이 로그에 남으면 안 된다.
  - 찜카 delete/create 순서가 잘못되면 일시적으로 필요한 차단구간이 사라질 수 있다.

## 3-A. 2026-06-29 진행 상태 업데이트
- 현재 브랜치: `dev`
- Phase 2 커밋 완료: `5eb3ca4 Add common sync logger`
- Phase 3 커밋 완료: `d3dcfe7 Connect sync runners to common logger`
- Phase 4 상태: 구현 완료, 분리 검수 PASS, 미커밋 상태.
- Phase 4 변경 파일:
  - `supabase/migrations/20260629090500_create_sync_events.sql`
  - `server/logging/syncEventRepository.js`
  - `server/logging/syncLogger.js`
  - `server/logging/__tests__/syncLogger.test.js`
  - `api/admin/bookings.js`
  - `src/services/adminBookingsApi.js`
  - `src/pages/AdminBookingsPage.jsx`
  - `scripts/ims-sync/run-ims-reservation-sync.js`
  - `scripts/zzimcar-sync/run-zzimcar-reconcile-sync.js`
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - `scripts/carmore-sync/run-carmore-reconcile-sync.js`
  - `scripts/carmore-sync/lib/reconcile-carmore-holidays.js`
- Phase 4 구현 내용:
  - `sync_events` migration 파일 추가. 실제 DB 적용은 하지 않았다.
  - sync event repository 추가. insert는 best-effort이며 테이블 미존재/schema cache 오류는 graceful fallback한다.
  - sync logger에 optional DB write를 연결했다. DB 저장 실패가 sync 본 작업을 막지 않는다.
  - IMS/찜카/카모아 runner 및 reconcile logger에 Supabase 설정이 있을 때 DB 저장 옵션을 연결했다.
  - admin bookings API 응답에 `latestSyncEvents`를 추가했다.
  - 관리자 예약 화면에 최근 sync warning/error/partial/overlap/stale 이벤트 표시 섹션을 추가했다.
- Phase 4 검증:
  - `node --test server/logging/__tests__/syncLogger.test.js` → 9 pass.
  - 관련 JS 파일 `node -c` 확인 → 통과.
  - `npm run build` → 통과.
  - `git diff --check` → 통과.
- Phase 4 금지사항 준수:
  - DB 실제 반영 없음.
  - 외부 API write 없음.
  - deploy/restart 없음.
  - `.env*`, secret, token, runtime config 수정 없음.
  - commit 없음.
- Phase 4 남은 리스크:
  - migration 파일만 추가된 상태라 실제 운영 DB에는 `sync_events` 테이블이 아직 없다.
  - 운영 DB 적용, 권한/RLS/schema cache 확인, 배포 후 관리자 화면 확인은 별도 운영 승인 phase로 분리한다.
- 다음 판단:
  - Phase 5는 단순 코드 수정이 아니라 찜카 disable_time 병합 정책 전환이다.
  - 2026-06-29 12:57 기준 정정: 찜카 update API는 없는 것으로 보고, Phase 5-B는 내부 DB 재계산 + 찜카 조회/삭제/생성만으로 다시 작성한다.
  - 기존 P5-B의 update 전제 구현/테스트/문서 표현은 폐기 대상이다.

## 4. Phase 목록

### Phase 1. 현재 sync 로그/DB 이벤트 기준 확정
- 목적: 구현 전 기준점과 DB/로그 현황을 확정한다.
- 변경점: 없음. 읽기 전용 조사.
- 변경대상: 없음.
- 실행방법:
  - `git status --short` 재확인.
  - sync 관련 DB table/migration 현황 확인.
  - 기존 log 파일 샘플에서 `VEHICLE_SCHEDULE_DUPLICATION_ERROR`, `recover_missing_disable_time`, stale/missing mapping 케이스 확인.
  - 관리자 화면이 어떤 error source만 표시하는지 재확인.
- 종료조건:
  - 공통 이벤트 필드와 저장 위치 후보가 확정된다.
- 검증방법:
  - 확인 파일/테이블/로그 라인 근거 보고.
- 리스크:
  - 운영 DB 조회 필요 시 별도 승인 필요.
- 되돌릴 방법:
  - 읽기 전용이므로 변경 없음.
- 출력보고:
  - 현재 로그 경로, DB 테이블, 관리자 표시 누락 목록.

### Phase 2. 공통 sync logger 최소 구현
- 목적: IMS/찜카/카모아가 같은 이벤트 포맷으로 로그를 남기게 한다.
- 변경점:
  - 신규 `syncLogger` 추가 또는 `appLogger` 확장.
  - 공통 이벤트 타입 정의.
  - 민감정보 제거 규칙 적용.
- 변경대상:
  - `server/logging/syncLogger.js` 신규 후보
  - `server/logging/appLogger.js` 필요 시 최소 확장
  - logger 단위 테스트 신규/수정
- 실행방법:
  - console JSON line 출력은 유지한다.
  - logger DB write는 optional/best-effort로 설계한다.
  - 허용 필드 예: `provider`, `runId`, `stage`, `action`, `severity`, `eventType`, `imsReservationId`, `carNumber`, `errorCode`, `message`, `metadata`.
  - 앱/관리자 미확인 badge는 Phase 4에서 구현하되, Phase 2 logger 이벤트에는 `requiresAck`, `ackStatus`, `ackKey`, `visibility`, `dedupeKey` 같은 non-DB schema 필드를 포함해 unread/acknowledged 상태로 확장 가능하게 한다.
- 종료조건:
  - 공통 logger가 sync script에서 import 가능하다.
  - 민감정보 키가 로그에 남지 않는다.
- 검증방법:
  - logger 단위 테스트.
  - dry-run script에서 stdout JSON line 확인.
- 리스크:
  - 기존 `appLogger`의 허용 key 정책과 sync metadata가 충돌할 수 있다.
- 되돌릴 방법:
  - 신규 logger 파일 제거 또는 import 제거.
- 출력보고:
  - logger 파일, 이벤트 포맷, 테스트 결과.

### Phase 3. IMS/찜카/카모아 runner 이벤트 연결
- 목적: sync 시작/성공/부분성공/실패/경고를 공통 이벤트로 남긴다.
- 변경점:
  - 각 runner에 `sync_start`, `sync_success`, `sync_failed`, `sync_partial_success` 기록.
  - 찜카/카모아 reconcile 내부에 recovery/warning 이벤트 기록.
- 변경대상:
  - `scripts/ims-sync/run-ims-reservation-sync.js`
  - `scripts/zzimcar-sync/run-zzimcar-reconcile-sync.js`
  - `scripts/carmore-sync/run-carmore-reconcile-sync.js`
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - `scripts/carmore-sync/lib/reconcile-carmore-holidays.js` 후보
- 실행방법:
  - 기존 summary 출력은 유지한다.
  - 실패 이벤트가 process exit 전에 반드시 남게 한다.
  - logger 실패는 sync 본 작업을 죽이지 않는다.
- 종료조건:
  - 세 sync 모두 공통 이벤트를 출력한다.
- 검증방법:
  - dry-run 또는 단위 테스트로 event output 확인.
- 리스크:
  - 로그량 증가.
- 되돌릴 방법:
  - runner import와 event call 제거.
- 출력보고:
  - provider별 이벤트 샘플.

### Phase 4. DB 이벤트 저장소 및 관리자 표시
- 상태: 2026-06-29 구현 완료, 분리 검수 PASS, 미커밋. 실제 DB migration 적용은 미실행.
- 목적: 파일 로그가 아니라 관리자 화면에서 운영 경고를 볼 수 있게 한다.
- 변경점:
  - `sync_events` 신규 테이블 또는 기존 run/error table 확장.
  - admin API가 최신 sync events를 조회한다.
  - 관리자 UI가 실패/경고/부분성공/stale/overlap을 표시한다.
- 변경대상:
  - Supabase migration 파일 후보
  - sync event repo 신규 후보
  - `api/admin/bookings.js`
  - `src/pages/AdminBookingsPage.jsx`
- 실행방법:
  - DB schema 변경은 별도 승인 후 진행한다.
  - API는 테이블 미존재 시 graceful fallback한다.
  - UI는 최근 이벤트 5~20건 제한 표시.
- 종료조건:
  - 관리자 화면에 최신 sync event가 provider별로 표시된다.
- 검증방법:
  - API 테스트 또는 local mock.
  - UI 렌더링 확인.
- 리스크:
  - DB migration/권한 정책 오류.
  - 관리자 화면 과밀.
- 되돌릴 방법:
  - API/UI 변경 revert.
  - DB migration은 별도 rollback 문서 필요.
- 출력보고:
  - API 응답 필드, UI 표시 예시, DB 변경 여부.

### Phase 5. 찜카 overlap duplicate 재계산 reconcile 복구
- 상태: P5-A 완료, P5-B 구현 완료, P5-C 구현 완료. 최종 분리 검수/완료판정 pending.
- 2026-06-29 12:57 정정:
  - 찜카 disable_time API는 현재 문서/실검증 기준 `GET 조회`, `PUT 생성`, `DELETE 삭제`만 확정한다.
  - `updateDisableTime`, `update action`, `update-merge`, `update payload` 전제는 잘못된 설계로 폐기한다.
  - 기존 P5-B 구현/테스트/문서 중 update 전제는 제거 대상이다.
- 승인 정책:
  - 찜카 `disable_time`은 IMS 예약 1건의 산출물이 아니라 차량 blocked interval이다.
  - 원본 truth는 내부 DB의 active/future IMS 예약 projection이다.
  - 매 sync 때 내부 DB active 예약에서 차량별 desired blocked interval을 새로 계산한다.
  - 기존 mapping/pid는 이전 반영 흔적이며, 남겨야 할 차단구간의 원본 기준이 아니다.
  - 같은 차량 예약은 실제 기간이 겹칠 때만 하나의 blocked interval cluster로 병합한다.
  - 맞닿은 adjacent interval은 병합하지 않는다.
  - 찜카 현재 disable_time과 내부 DB 계산 결과를 비교해 불일치만 처리한다.
  - 겹치는 기존 pid 때문에 새 생성이 막히는 경우, create-first가 아니라 delete-first replacement가 필요하다.
  - 외부 save-run은 별도 승인 전 금지한다.
- P5-A 완료 변경:
  - `fetch-desired-ims-reservations.js`에서 겹치는 IMS 예약을 차량 blocked interval cluster로 union한다.
  - 실제 overlap만 병합하고 adjacent interval은 병합하지 않는다.
  - cluster에 `sourceImsReservationIds`, `sourceReservations`를 보존한다.
  - `reconcile-zzimcar-disable-times.js`의 plan 기준이 clustered source IMS id를 하나의 desired blocked interval로 취급한다.
  - P5-A 테스트 추가: overlap union, adjacent 미병합, 취소/변경 후 남은 active 예약 기준 재계산, clustered plan 처리.
- P5-A 검증:
  - `npm run test:zzimcar-sync` → 36 pass.
  - touched JS `node --check` → 통과.
  - `git diff --check` → 통과.

#### Phase 5-B. update 전제 제거 및 내부 DB 재계산 reconcile 계획 재작성
- 상태: 2026-06-29 구현 완료. save-run replacement 실행/rollback은 P5-C로 유지.
- 목적:
  - 잘못 들어간 update 전제 코드를 제거하고, 내부 DB 재계산 결과 기준의 조회/삭제/생성 reconcile로 바꾼다.
- 변경점:
  - `applyChange`의 update 방식 제거.
  - `buildDisableTimeUpdatePayloadFromDesired`, `updateDisableTime` 가정 제거.
  - dry-run 결과에서 `update` action 제거.
  - plan 용어를 `update`가 아니라 `replace` / `delete_create_replacement`로 정리.
  - desired blocked interval과 찜카 현재 disable_time의 match/overlap/diff 판정 함수를 명확히 분리한다.
  - 기존 pid와 새 desired interval이 겹쳐 create가 막히는 경우를 delete-first replacement 대상으로 계획한다.
- 변경대상:
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - `scripts/zzimcar-sync/__tests__/reconcile-zzimcar-disable-times.test.js`
  - 필요 시 `scripts/zzimcar-sync/lib/fetch-desired-ims-reservations.js`
  - 이 PM 문서
- 실행방법:
  1. 현재 diff에서 update 전제 함수/테스트/문서 표현을 제거한다.
  2. 내부 DB 계산 결과를 desired blocked intervals로 둔다.
  3. 찜카 현재 disable_time은 actual blocked intervals로 둔다.
  4. exact match는 유지한다.
  5. desired와 actual이 overlap하지만 기간이 다르면 `replace`로 계획한다.
  6. desired에 없는 actual은 delete로 계획한다.
  7. actual에 없는 desired는 create로 계획한다.
  8. dry-run에서는 delete/create 순서와 payload만 표시하고 외부 write는 하지 않는다.
- 종료조건:
  - 코드/테스트에서 잘못된 update 클라이언트/페이로드/액션 전제를 제거했다.
  - dry-run plan이 내부 DB desired 기준으로 create/delete/replace만 낸다.
  - clustered desired exact match는 unchanged, overlap interval diff는 replace로 계획한다.
  - `101하7003` overlap cluster가 하나의 desired interval로 계산된다.
- 검증방법:
  - `npm run test:zzimcar-sync`
  - touched JS `node --check`
  - `git diff --check`
- 리스크:
  - replace는 delete-first라 save-run 중 생성 실패 시 차단 공백이 생길 수 있다.
  - 따라서 save-run 실제 외부 write는 P5-C 전 별도 승인과 복구 절차가 필요하다.
- 되돌릴 방법:
  - P5-B 변경 diff revert.
  - save-run 전이면 찜카/운영 DB 외부 영향 없음.
- P5-B 구현 결과:
  - `buildDisableTimeUpdatePayloadFromDesired` export와 update payload 생성을 제거했다.
  - `applyChange` update 실행 경로를 제거하고 `applyReplacement` planning-only 경로로 바꿨다.
  - dry-run 결과는 create/delete/replace plan만 표시한다.
  - replace plan은 delete target, create payload, `delete -> create` 순서만 제공하며 외부 write는 실행하지 않는다.
  - save-run replace 실행은 P5-C rollback flow 전까지 명시적으로 차단한다.
- 출력보고:
  - 제거한 update 전제 목록.
  - 새 plan action 목록.
  - 테스트 결과.

#### Phase 5-C. save-run용 delete-first replacement 안전장치 설계/구현
- 상태: 2026-06-29 구현 완료. 실제 save-run 실행은 하지 않았다.
- 목적:
  - 실제 외부 write를 실행하기 전, delete-first replacement의 실패 복구 절차를 코드로 고정한다.
- 변경점:
  - replace 실행 순서: 기존 actual 스냅샷 저장 → 기존 pid 삭제 → desired 생성 → 새 pid mapping upsert.
  - desired 생성 실패 시: 삭제 전 actual window로 rollback 생성 시도.
  - rollback 생성 성공 시: 기존 상태에 준하는 mapping으로 복구하고 warning 이벤트 기록.
  - rollback도 실패하면 error/manual-confirm 이벤트 기록, 다음 sync 재시도 대상 표시.
  - mapping은 원본 truth가 아니라 마지막 반영 추적값으로만 갱신한다.
- 변경대상:
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - `scripts/zzimcar-sync/lib/zzimcar-sync-mapping-repo.js`
  - `server/logging/syncEventRepository.js` action allowlist 필요 시
  - 관련 테스트
- 실행방법:
  - 외부 API write는 실행하지 않고, mock client 테스트로 delete/create/rollback 순서를 검증한다.
  - save-run 명령 실행은 별도 운영 승인 전 금지한다.
- 종료조건:
  - replace 성공/생성 실패/rollback 성공/rollback 실패 테스트가 있다.
  - shared/cluster source IMS ids가 새 pid에 연결되는 mapping 테스트가 있다.
  - 기존 pid 때문에 create가 막히는 케이스가 delete-first로 계획된다.
- 검증방법:
  - `npm run test:zzimcar-sync`
  - logger 대상 테스트
  - `npm run build`
  - `git diff --check`
- 리스크:
  - 실제 찜카 delete 성공 후 create 실패 시 운영 공백 가능성이 있다.
  - rollback도 실패하면 수동 복구가 필요하다.
- 되돌릴 방법:
  - save-run 전이면 코드 revert만으로 충분.
  - save-run 후 실패 시 sync_events/로그 기준 수동 복구 필요.
- 찜카 겹침 신호 확인:
  - 겹치는 구간 생성은 `PUT /vehicle/disable_time`에서 HTTP `400`으로 거부된다.
  - 오류 신호는 `VEHICLE_SCHEDULE_DUPLICATION_ERROR` / `차량 스케줄이 중복되었습니다.` 이다.
  - 성공 pid는 `body.pid`가 아니라 `body.msg`로 오는 기록이 있어 client가 `msg`를 pid로 회수한다.
  - 실패 detail도 `code`, `msg`, `message`, `errors[0].defaultMessage`를 모두 보존해 duplicate 판정 신호가 사라지지 않게 한다.
- P5-C 구현 결과:
  - save-run replacement 차단을 해제하고 delete-first 실행 흐름을 구현했다.
  - 실행 순서: 기존 actual snapshot 보존 → 기존 pid 삭제 → desired 구간 생성 → clustered IMS id mapping을 새 pid로 upsert.
  - desired 생성 실패 시 삭제 전 actual window로 rollback 생성 시도.
  - rollback 성공 시 rollback pid로 mapping 복구/upsert 후 `replace_disable_time_rollback_succeeded` warning/admin ack 이벤트 기록.
  - rollback 실패 시 `replace_disable_time_rollback_failed` error/admin ack 이벤트 기록 후 manual recovery가 필요하도록 실패 처리.
  - dry-run은 계속 외부 write 없이 delete/create payload와 순서만 표시한다.
- P5-C 검증:
  - `npm run test:zzimcar-sync` → 42 pass.
  - touched JS `node --check` → 통과.
  - `git diff --check` → 통과.
  - update 전제 검색: `scripts/zzimcar-sync` 내 `updateDisableTime`, `buildDisableTimeUpdatePayload`, update action/payload 없음.
- 출력보고:
  - delete/create/rollback 순서.
  - 실패 시 관리자 표시 이벤트.
  - 실제 save-run 승인 필요 여부.

### Final Phase. 검수·완료판정·상태/정책문서 정리·문서 COMPLETE 변경·커밋
- 목적: 전체 변경의 완료 여부를 판정하고 문서를 정리한다.
- 변경점:
  - 전체 변경 검수
  - 완료판정
  - 상태변경/정책변경 여부 판단
  - `PROJECT_STATE.md`, project docs, 정책/운영 문서 업데이트
  - PM 문서를 완료 위치로 이동 또는 이름 변경
  - 파일명에 `COMPLETE_YYYYMMDD` 반영
  - 최종 커밋
- 변경대상:
  - 변경된 코드/테스트/문서 전체
  - `PROJECT_STATE.md`
  - `docs/COMPLETED/**`
- 실행방법:
  - 코드 diff 검수.
  - 관련 테스트 전체 실행.
  - 문서 최신성 점검.
  - 사용자가 커밋 승인한 경우에만 commit.
- 종료조건:
  - 모든 승인 phase 검증 완료.
  - 남은 리스크가 문서화됨.
  - 완료 문서 위치/이름 규칙 충족.
- 검증방법:
  - `npm test` 또는 대상 테스트 명령.
  - sync script dry-run.
  - 관리자 API/UI 확인.
- 리스크:
  - DB/외부 플랫폼 save-run은 별도 운영 승인 없이는 완료 검증이 제한된다.
- 되돌릴 방법:
  - git revert.
  - DB migration 적용 시 별도 rollback 필요.
- 출력보고:
  - 변경 파일, 검증 결과, 완료 문서 경로, 커밋 해시 또는 커밋 제외 사유.

## 5. 승인 및 중단 조건
- 승인 요청:
  - 본 문서는 계획 초안이다.
  - 실행하려면 Phase 1부터 별도 승인 필요.
- 중단 조건:
  - 예상 밖 DB schema 발견.
  - logger 기록에 민감정보 포함 가능성 발견.
  - sync 본 작업 실패를 유발할 가능성 발견.
  - 찜카 조회/삭제/생성만으로 내부 DB 계산 결과를 안전하게 맞출 수 없는 경우.
  - 운영 DB/외부 플랫폼 write가 필요한 경우.
- protected target 별도 승인 필요 여부:
  - `.env*`, secret, token, credential: 수정 금지. 필요 시 별도 승인.
  - DB migration/운영 DB 반영: 별도 승인.
  - launchd/restart/deploy: 별도 승인.
  - 찜카/카모아/IMS 실제 write/save-run: 별도 승인.

## 6. 완료 보고 형식
- 완료 phase:
- 변경 파일:
- 검증 결과:
- 완료 문서 경로:
- 상태/정책문서 업데이트:
- 커밋:
- 남은 리스크:

---

# Final Verification PM - P4/P5 실제 구현 검증 및 완료판정

## 0. 문서 정보
- 작성일: 2026-06-29
- 작성자/agent: OpenClaw rentcar00_reservation_developer
- 상태: Draft - 최종 검증 대기
- 목적: 기존 “완료” 보고를 신뢰하지 않고, 실제 diff/code/test/doc 근거로 P4/P5 구현이 맞는지 다시 판정한다.
- 승인 범위: 검증, 필요한 경우 문서/테스트 보강 계획 수립. 코드 수정은 FIX phase 승인 후만 수행한다.
- 관련 문서:
  - `docs/PHASE/2026-06-28_SYNC_LOGGER_UNIFICATION_AND_OVERLAP_RECOVERY_PM.md`
  - `docs/past/present-history/2026-04-29_RENTCAR00_ZZIMCAR_AUTOMATION_EXECUTION_CURRENT_PAST.md`
  - `docs/past/present-history/2026-04-29_RENTCAR00_ZZIMCAR_SYNC_IMPLEMENTATION_PHASES_CURRENT_PAST.md`
  - manual `zzimcar-api/README.md`
- 완료 후 문서명 후보:
  - `docs/COMPLETED/2026-06-28_SYNC_LOGGER_UNIFICATION_AND_OVERLAP_RECOVERY_PM_COMPLETE_20260629.md`
- 상태/정책문서 업데이트 대상:
  - 필요 시 `PROJECT_STATE.md`
  - 필요 시 `docs/README.md`
  - 필요 시 찜카 API/manual 문서

## 1. 검증 목적
- 목표:
  - P4 sync_events/admin 표시가 기존 sync 흐름을 깨지 않는지 검증한다.
  - P5-A/B/C가 실제로 update 전제를 제거하고, 내부 DB desired 기준으로 찜카 disable_time을 조회/삭제/생성만으로 reconcile하는지 검증한다.
  - delete-first replacement와 rollback 로직이 mock 수준에서라도 정확한 순서와 실패 이벤트를 보장하는지 검증한다.
- 성공 기준:
  - `scripts/zzimcar-sync` 안에 `updateDisableTime`, update payload/action, update-merge 실행 경로가 없다.
  - desired source는 내부 DB active/future IMS projection이며, mapping/pid는 truth로 쓰이지 않는다.
  - overlap cluster는 실제 overlap만 병합하고 adjacent는 병합하지 않는다.
  - replace plan은 exact match와 overlap interval diff를 구분한다.
  - save-run replacement는 delete → create → mapping upsert 순서다.
  - create 실패 후 rollback 생성, rollback 실패 후 admin/manual recovery 이벤트가 테스트로 고정돼 있다.
  - 찜카 duplicate 신호 `VEHICLE_SCHEDULE_DUPLICATION_ERROR` / `차량 스케줄이 중복되었습니다.`가 client error detail에서 보존된다.
  - 외부 API write, DB migration 적용, deploy/restart, commit은 별도 승인 없이는 수행하지 않는다.
- 제외 범위:
  - 실제 찜카 save-run 실행.
  - 실제 운영 DB migration 적용.
  - 운영 배포/restart.
  - 외부 플랫폼에 영향을 주는 write 검증.

## 2. 현재 확인 상태
- 현재 git 상태:
  - 다수 파일 modified/untracked.
  - Phase 4, P5-A, P5-B, P5-C 변경이 한 작업트리에 섞여 있다.
  - commit은 아직 없다.
- 주요 변경 파일:
  - `scripts/zzimcar-sync/lib/fetch-desired-ims-reservations.js`
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - `scripts/zzimcar-sync/lib/zzimcar-client.js`
  - `scripts/zzimcar-sync/lib/disable-time.js`
  - `scripts/zzimcar-sync/__tests__/fetch-desired-ims-reservations.test.js`
  - `scripts/zzimcar-sync/__tests__/reconcile-zzimcar-disable-times.test.js`
  - `scripts/zzimcar-sync/__tests__/zzimcar-client.test.js`
  - `server/logging/syncLogger.js`
  - `server/logging/syncEventRepository.js`
  - `server/logging/__tests__/syncLogger.test.js`
  - `api/admin/bookings.js`
  - `src/services/adminBookingsApi.js`
  - `src/pages/AdminBookingsPage.jsx`
  - `supabase/migrations/20260629090500_create_sync_events.sql`
- 확인된 찜카 API 근거:
  - 조회: `GET /vehicle/vehicle/{vehiclePid}/disable_time`
  - 생성: `PUT /vehicle/disable_time`
  - 삭제: `DELETE /vehicle/disable_time`
  - update endpoint는 현재 문서/코드 기준 확정 없음.
  - 중복 생성 실패 신호: HTTP 400 + `VEHICLE_SCHEDULE_DUPLICATION_ERROR` / `차량 스케줄이 중복되었습니다.`
  - 생성 성공 pid는 `body.msg`로 오는 기록이 있다.
- 이미 실행된 검증 기록:
  - `npm run test:zzimcar-sync` → 43 pass
  - logger/carmore 관련 node test → 23 pass
  - `npm run build` → pass
  - `git diff --check` → pass
- 확인 필요:
  - 실제 diff 전체가 승인된 P4/P5 범위 밖으로 나가지 않았는지 독립 검수.
  - P5-C rollback 성공 시 mapping 복구 대상이 정책과 정확히 맞는지 검수.
  - sync_events admin 표시 이벤트 type/action이 repository filter와 UI 표시 조건에 맞는지 검수.
  - Final Phase에서 문서 COMPLETE 이동/커밋을 할지 여부.

## 3. Final Verification Phase 목록

### Final-V1. 전체 diff 범위 검수
- 목적:
  - 변경 파일 전체가 승인된 P4/P5 범위 안인지 확인한다.
- 변경점:
  - 코드 수정 없음.
  - diff를 파일별로 읽고 승인 범위, protected target, 외부 write 위험을 분류한다.
- 변경대상:
  - 전체 modified/untracked 파일.
- 실행방법:
  1. `git status --short` 확인.
  2. `git diff --stat` 확인.
  3. 파일별 diff를 읽어 P4/P5-A/B/C로 분류.
  4. 범위 밖 변경이 있으면 STOP/FIX로 판정.
- 종료조건:
  - 모든 변경 파일에 owner phase가 붙는다.
  - 범위 밖 변경이 없거나, 있으면 명시적으로 FIX 항목화된다.
- 검증방법:
  - `git diff --name-only`
  - `git diff -- <file>` 직접 확인.
- 리스크:
  - 여러 phase가 한 작업트리에 섞여 있어 누락 가능성 있음.
- 출력보고:
  - 파일별 phase 분류표.
  - PASS/FIX/STOP 판정.

### Final-V2. 찜카 API/update 제거 검수
- 목적:
  - update 가정이 코드 실행 경로에 남아 있지 않은지 확정한다.
- 변경점:
  - 코드 수정 없음.
  - 검색과 직접 코드 읽기로 update 전제 제거 여부를 검수한다.
- 변경대상:
  - `scripts/zzimcar-sync/lib/**`
  - `scripts/zzimcar-sync/__tests__/**`
  - PM 문서의 실행 기준 표현.
- 실행방법:
  1. `rg "updateDisableTime|buildDisableTimeUpdatePayload|update-merge|action: 'update'|action: \"update\"|applyChange" scripts/zzimcar-sync` 실행.
  2. `zzimcar-client.js`에 update method/path가 없는지 확인.
  3. `disable-time.js`에 update payload builder가 없는지 확인.
  4. `reconcile-zzimcar-disable-times.js` 실행 경로가 create/delete/replace만 쓰는지 확인.
- 종료조건:
  - 실행 코드에서 update 관련 함수/액션/HTTP 호출이 0건.
  - 문서의 update 언급은 “폐기/제거한 전제” 설명으로만 남는다.
- 검증방법:
  - ripgrep 결과.
  - 직접 코드 라인 근거.
- 리스크:
  - 문서의 과거 설명과 실행 기준이 섞여 오해 가능.
- 출력보고:
  - update 잔존 여부.
  - 남은 문서 표현 정리 필요 여부.

### Final-V3. desired 재계산/cluster 정책 검수
- 목적:
  - 내부 DB active/future IMS 예약 projection이 truth인지 검증한다.
  - mapping/pid가 truth로 쓰이지 않는지 검증한다.
- 변경점:
  - 코드 수정 없음.
- 변경대상:
  - `fetch-desired-ims-reservations.js`
  - `reconcile-zzimcar-disable-times.js`
  - 관련 테스트.
- 실행방법:
  1. active/inactive status 기준 확인.
  2. `using_car`가 blocking status로 처리되는지 확인.
  3. 실제 overlap은 union하고 adjacent는 병합하지 않는지 확인.
  4. `sourceImsReservationIds`/`sourceReservations` 보존 여부 확인.
  5. planReconcile이 desired vs current actual 기준인지 확인.
- 종료조건:
  - desired 계산 기준이 내부 DB projection으로 고정됨.
  - exact match/overlap diff/create/delete 판단이 테스트로 고정됨.
- 검증방법:
  - `npm run test:zzimcar-sync`
  - 관련 테스트명 직접 확인.
- 리스크:
  - 실제 DB 데이터 fixture가 부족하면 운영 데이터 edge case는 남을 수 있음.
- 출력보고:
  - cluster 정책 PASS/FIX.
  - 추가 fixture 필요 여부.

### Final-V4. delete-first replacement/rollback 검수
- 목적:
  - P5-C가 운영 위험을 숨기지 않고, 실패 시 복구/경고가 가능한지 검증한다.
- 변경점:
  - 코드 수정 없음.
- 변경대상:
  - `reconcile-zzimcar-disable-times.js`
  - `reconcile-zzimcar-disable-times.test.js`
  - `zzimcar-client.js`
  - `zzimcar-client.test.js`
- 실행방법:
  1. dry-run에서 외부 write가 없는지 확인.
  2. save-run mock 성공 순서가 delete → create → mapping upsert인지 확인.
  3. desired create 실패 시 rollback create가 이전 actual window로 호출되는지 확인.
  4. rollback 성공 시 warning/admin ack 이벤트가 남는지 확인.
  5. rollback 실패 시 error/admin ack 이벤트와 manual recovery metadata가 남는지 확인.
  6. duplicate 신호 detail 보존 테스트를 확인한다.
- 종료조건:
  - 위 6개 조건이 테스트와 코드로 모두 확인됨.
- 검증방법:
  - `npm run test:zzimcar-sync`
  - 관련 테스트명 직접 확인.
  - `node --check` touched JS.
- 리스크:
  - 실제 찜카 save-run은 미실행이므로 HTTP 실동작은 운영 승인 전까지 미검증.
- 출력보고:
  - replace/rollback PASS/FIX.
  - 실제 save-run 전 필요한 승인 문구.

### Final-V5. sync_events/admin 표시 검수
- 목적:
  - P4 logging/admin 표시가 sync 본 작업을 막지 않는지 확인한다.
- 변경점:
  - 코드 수정 없음.
- 변경대상:
  - `server/logging/syncLogger.js`
  - `server/logging/syncEventRepository.js`
  - `server/logging/__tests__/syncLogger.test.js`
  - `api/admin/bookings.js`
  - `src/pages/AdminBookingsPage.jsx`
  - `src/services/adminBookingsApi.js`
  - sync runner files.
- 실행방법:
  1. DB insert best-effort 동작 확인.
  2. missing table/schema cache fallback 확인.
  3. sensitive metadata 제거 테스트 확인.
  4. admin API/UI 필드 추가가 기존 응답을 깨지 않는지 확인.
  5. build 통과 확인.
- 종료조건:
  - logger 실패가 sync 본 작업 실패로 전파되지 않음.
  - 관리자 표시 필드가 build에서 깨지지 않음.
- 검증방법:
  - `node --test server/logging/__tests__/syncLogger.test.js`
  - `npm run build`
- 리스크:
  - 실제 운영 DB에 migration이 적용되지 않으면 admin에는 이벤트가 없을 수 있음.
- 출력보고:
  - P4 PASS/FIX.
  - 운영 DB 적용 필요 여부.

### Final-V6. 최종 완료판정·문서 COMPLETE·커밋 게이트
- 목적:
  - 모든 검증 결과를 합쳐 COMPLETE 가능 여부를 판정한다.
- 변경점:
  - 검증 PASS일 때만 문서 완료 처리와 커밋을 검토한다.
  - FAIL/FIX가 있으면 COMPLETE/커밋 금지.
- 변경대상:
  - PM 문서
  - 필요 시 `docs/COMPLETED/**`
  - 필요 시 `PROJECT_STATE.md` 또는 관련 docs index
- 실행방법:
  1. Final-V1~V5 결과 취합.
  2. PASS/FIX/STOP 중 하나로 판정.
  3. PASS면 완료 문서명 후보로 이동/복사 여부 보고.
  4. 커밋 필요 여부와 커밋 범위 보고.
  5. 사용자가 명시 승인한 경우에만 문서 이동/커밋 실행.
- 종료조건:
  - PASS/FIX/STOP 판정이 근거와 함께 남는다.
  - COMPLETE 문서 처리와 커밋은 별도 승인 없이는 미실행.
- 검증방법:
  - `git status --short`
  - `git diff --check`
  - 대상 테스트 전체
- 리스크:
  - 문서 이동/커밋을 서두르면 아직 검증 안 된 변경이 섞일 수 있음.
- 출력보고:
  - 최종 판정.
  - 완료 문서 경로.
  - 커밋 실행 여부/커밋 해시 또는 제외 사유.

## 4. 승인 및 중단 조건
- 승인 요청:
  - 이 Final Verification PM은 검증 계획이다.
  - 실행하려면 `Final-V1부터 검증해` 또는 `pa Final Verification`처럼 명시 승인한다.
- 중단 조건:
  - 범위 밖 파일 변경 발견.
  - update 실행 경로 발견.
  - 실제 외부 write 필요 발견.
  - DB migration 적용 필요 발견.
  - rollback이 실제로 mapping/이벤트를 보장하지 못하는 구조 발견.
  - 테스트는 통과하지만 코드 근거가 불충분한 경우.
- protected target 별도 승인 필요:
  - `.env*`, secret, token, credential: 수정 금지.
  - 찜카/IMS/카모아 실제 write/save-run: 별도 승인.
  - DB migration 적용: 별도 승인.
  - deploy/restart: 별도 승인.
  - commit: 별도 승인.

## 5. Final Verification 완료 보고 형식
- 검증 phase:
- 판정: PASS / FIX / STOP
- 근거 파일/라인:
- 실행한 명령:
- 테스트 결과:
- 발견한 문제:
- 수정 필요 phase:
- COMPLETE 문서 처리 여부:
- 커밋 여부:
- 남은 운영 리스크:

---

# Final FIX PM - 찜카 sync 삭제 범위/actual source 보정

## 0. 문서 정보
- 작성일: 2026-06-29
- 상태: Draft - 실행 준비
- 작성 사유:
  - Final Verification 중 P5-B/P5-C 구현에 구조적 의심 지점이 발견됐다.
  - 테스트는 통과했지만, 실제 운영 안전 기준에서는 PASS로 볼 수 없다.
- 판정:
  - 현재 상태는 **FIX 필요**.
  - COMPLETE/커밋 금지.
  - 실제 찜카 save-run 금지.

## 1. 발견한 문제

### 문제 1. 삭제 누락 위험
- 현재 의심 흐름:
  - desiredRows가 존재하면 `fetchCurrentZzimcarDisableTimeRows()`가 desired 차량 중심으로 찜카 현재 disable_time을 조회한다.
  - 이 경우 이번 내부 DB desired에 없는 차량이지만, 이전 mapping에는 남아 있는 차량의 disable_time 삭제가 누락될 수 있다.
- 왜 문제인지:
  - 내부 DB 재계산 기준에서는 desired에서 사라진 예약/차량은 기존 차단구간을 해제해야 한다.
  - 그런데 actual 조회 대상에서 빠지면 deletion plan 자체가 생기지 않는다.
- 영향:
  - 취소/완료된 IMS 예약의 찜카 차단구간이 남아 판매 차단이 계속될 수 있다.

### 문제 2. 삭제 과잉 위험
- 현재 의심 흐름:
  - 찜카 현재 disable_time 전체를 actualRows로 넣으면, 우리 sync mapping으로 추적하지 않는 수동/외부 차단구간도 deletion 후보가 될 수 있다.
- 왜 문제인지:
  - 찜카 disable_time에는 운영자가 수동으로 넣은 차단구간이 있을 수 있다.
  - 내부 DB desired에 없다는 이유만으로 수동 차단구간을 삭제하면 운영 사고다.
- 영향:
  - 수동 예약불가/정비/운영 차단구간이 자동 삭제될 수 있다.

### 문제 3. synthetic actual id 위험
- 현재 의심 흐름:
  - 찜카 현재 rows에서 만든 actual의 `imsReservationId`가 `zzimcar-disable-time:{pid}` 같은 synthetic id다.
  - deletion 후 `markMappingDeleted()`가 실제 IMS reservation id가 아닌 synthetic id를 대상으로 호출될 수 있다.
- 왜 문제인지:
  - 실제 mapping row가 deleted로 바뀌지 않을 수 있다.
  - 다음 sync에서 stale mapping이 계속 남을 수 있다.
- 영향:
  - mapping 정합성 깨짐, 반복 재시도/오판 가능.

## 2. FIX 원칙
- 원본 truth:
  - 내부 DB active/future IMS reservation projection.
- 관리 범위:
  - 자동 삭제/replace 대상은 **기존 `zzimcar_disable_time_sync_mappings`로 추적되는 pid/window**에 한정한다.
  - 찜카에 존재하지만 mapping으로 추적되지 않는 disable_time은 unmanaged로 분류하고 자동 삭제하지 않는다.
- 찜카 current 조회 목적:
  - truth 산출이 아니라, 기존 mapping pid/window가 실제 찜카에 존재하는지 확인하는 검증 source다.
- 삭제 기준:
  - desired에 없는 previousMapping만 삭제 후보.
  - 삭제할 pid는 previousMapping의 `zzimcarDisableTimePid`.
  - 삭제 전 현재 찜카에서 해당 pid 또는 exact window 존재 여부를 확인한다.
  - 존재하지 않으면 찜카 delete는 skip하고 mapping만 stale/deleted 처리한다.
- replace 기준:
  - desired cluster와 previousMapping/current verified actual이 같은 차량에서 overlap하지만 window가 다를 때만 replace.
  - replace 대상 pid도 previousMapping에서 온 managed pid여야 한다.
- unmanaged actual 기준:
  - mapping 없는 찜카 disable_time은 plan에 넣지 않는다.
  - 단, create 중 duplicate가 발생하면 exact window 회수용으로만 조회/사용한다.

## 3. FIX Phase 목록

### FIX-1. actual source 분리: managed actual vs unmanaged current
- 목적:
  - 찜카 현재 rows를 무조건 actualRows로 쓰는 구조를 제거한다.
  - previousMappings를 managed actual의 기준으로 복원한다.
- 변경점:
  - `previousMappings`는 deletion/replace 대상의 기본 actualRows로 유지한다.
  - 찜카 current 조회 결과는 `currentDisableTimesByVehicle` 또는 검증 보조 데이터로만 둔다.
  - synthetic `imsReservationId = zzimcar-disable-time:{pid}` actual을 deletion 대상에 직접 넣지 않는다.
- 변경대상:
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - `scripts/zzimcar-sync/__tests__/reconcile-zzimcar-disable-times.test.js`
- 실행방법:
  1. `fetchCurrentZzimcarDisableTimeRows()`를 삭제 대상 actual builder로 쓰지 않게 바꾼다.
  2. 필요하면 함수명을 `fetchCurrentDisableTimesForManagedVehicles()`처럼 보조 조회 의미로 변경한다.
  3. previousMappings의 pid/window에 current 존재 여부를 붙이는 helper를 만든다.
- 종료조건:
  - deletion plan의 actual은 항상 실제 previousMapping의 IMS reservation id를 가진다.
  - synthetic id는 deletion/markMappingDeleted 입력으로 쓰이지 않는다.
- 검증방법:
  - synthetic id가 deletion result/markMappingDeleted에 들어가지 않는 테스트.
- 리스크:
  - helper 변경 범위가 커질 수 있음.
- 출력보고:
  - managed/unmanaged 분리 방식.

### FIX-2. 삭제 누락 방지: desired 0 차량도 previousMapping 기준으로 삭제 계획
- 목적:
  - 내부 DB desired에서 사라진 기존 mapping 차량의 차단구간을 삭제 후보로 잡는다.
- 변경점:
  - planReconcile 입력 actualRows는 previousMappings 기반 managed actual 전체를 포함한다.
  - desiredRows가 비어도 previousMappings가 있으면 deletion plan이 나온다.
- 변경대상:
  - `reconcile-zzimcar-disable-times.js`
  - 관련 테스트.
- 실행방법:
  1. desiredRows + previousMappings를 비교한다.
  2. desired에 없는 previousMapping은 deletion으로 계획한다.
  3. 삭제 전 찜카 current에서 pid/window 존재 확인을 붙인다.
- 종료조건:
  - desiredRows `[]`, previousMappings `[A1]` 케이스에서 deletion 1건.
  - deletion target은 previousMapping의 pid.
- 검증방법:
  - `planReconcile` 단위 테스트.
  - `applyDeletion` current missing/present 테스트.
- 리스크:
  - current missing이면 찜카 delete skip + mapping 상태 처리 정책이 필요.
- 출력보고:
  - 삭제 누락 케이스 테스트명.

### FIX-3. 삭제 과잉 방지: unmanaged 찜카 disable_time 자동 삭제 금지
- 목적:
  - 운영자가 수동 생성한 찜카 disable_time을 자동 삭제하지 않게 막는다.
- 변경점:
  - 찜카 current rows 중 previousMappings와 pid 또는 exact window로 연결되지 않는 row는 `unmanaged`로 분류한다.
  - unmanaged는 deletion/replacement 대상에서 제외한다.
  - 필요 시 debug/internal 이벤트만 남긴다.
- 변경대상:
  - `reconcile-zzimcar-disable-times.js`
  - 관련 테스트.
- 실행방법:
  1. current row와 previousMapping matching helper 추가.
  2. unmatched current row는 plan 대상에서 제외.
  3. create duplicate recovery에서는 exact window 회수에만 사용.
- 종료조건:
  - current에만 있는 unmanaged disable_time이 deletion 0건으로 유지된다.
- 검증방법:
  - unmanaged current row deletion 방지 테스트.
- 리스크:
  - 과거 mapping 유실 상태의 우리 sync 생성물은 unmanaged로 남을 수 있음.
  - 이 경우 수동 확인이 안전하다.
- 출력보고:
  - unmanaged 처리 정책.

### FIX-4. replace/rollback mapping 정합성 재검수
- 목적:
  - replace 성공/rollback 성공/rollback 실패 시 mapping 상태가 실제 IMS reservation id 기준으로만 바뀌는지 확인한다.
- 변경점:
  - replace 대상 actual은 managed mapping이어야 한다.
  - rollback success 시 mapping 복구 대상 id를 명확히 한다.
  - 실패 시 synthetic id가 markMappingFailed에 들어가지 않게 한다.
- 변경대상:
  - `reconcile-zzimcar-disable-times.js`
  - related tests.
- 실행방법:
  1. replace success: clustered source IMS ids → new pid upsert.
  2. rollback success: previous managed IMS ids → rollback pid/window upsert.
  3. rollback failure: desired/source IMS ids 기준 error/manual event.
- 종료조건:
  - 모든 mapping write가 실제 IMS reservation id 기준.
- 검증방법:
  - 기존 P5-C 테스트 보강.
- 리스크:
  - rollback 시 이전 cluster source ids를 actual에서 알 수 없으면 previousMapping 목록을 함께 전달해야 함.
- 출력보고:
  - mapping write 대상 id 목록.

### FIX-5. 문서/테스트/최종 검증
- 목적:
  - FIX 반영 후 다시 PASS/FIX/STOP 판정한다.
- 변경점:
  - PM 문서 상태 업데이트.
  - 필요 시 테스트명/주석 정리.
- 변경대상:
  - PM 문서
  - 관련 테스트
- 실행방법:
  1. `npm run test:zzimcar-sync`
  2. `node --test server/logging/__tests__/syncLogger.test.js scripts/carmore-sync/__tests__/*.test.js`
  3. `npm run build`
  4. `git diff --check`
  5. update 전제 검색.
- 종료조건:
  - 삭제 누락/삭제 과잉/synthetic id 위험 테스트 통과.
  - 외부 save-run 미실행 확인.
- 검증방법:
  - 위 명령 결과.
- 출력보고:
  - PASS/FIX/STOP 최종 판정.

## 4. 실행 금지/별도 승인
- 금지:
  - 실제 찜카 save-run.
  - IMS/Carmore/찜카 외부 write.
  - DB migration 적용.
  - deploy/restart.
  - commit.
- 별도 승인 필요:
  - 실제 save-run으로 운영 찜카 반영.
  - Supabase migration push.
  - COMPLETE 문서 이동.
  - commit.

## 5. 실행 준비 결론
- 현재 구현은 일부 보완이 맞지만, `actualRows`를 찜카 current 중심으로 바꾸면서 **삭제 누락/삭제 과잉 위험**이 생겼다.
- 따라서 현재 상태는 COMPLETE가 아니라 **FIX 필요**다.
- FIX의 핵심은 “찜카 current 전체를 truth처럼 쓰지 말고, previousMappings 기준 managed 대상만 자동 삭제/replace한다”이다.
