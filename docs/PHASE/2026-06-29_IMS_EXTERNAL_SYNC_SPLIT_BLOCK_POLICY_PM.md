# IMS External Sync Split Block Policy PM

## 0. 문서 정보
- 작성일: 2026-06-29
- 작성자/agent: OpenClaw / rentcar00_reservation_developer
- 상태: Local implementation verified with schema gate - 운영 반영/COMPLETE/commit 대기
- 문서 목적: IMS 예약을 기준으로 찜카/카모아 외부 차단을 동기화하되, 외부 플랫폼의 기존 수동/미관리 차단을 삭제·흡수하지 않는 split child block 정책을 확정하고, 그 정책 기준으로 코드 수정 phase를 준비한다.
- 이전 PMDOC 처리:
  - 기존 문서: `docs/archive/2026-06-28_SYNC_LOGGER_UNIFICATION_AND_OVERLAP_RECOVERY_PM_ARCHIVED_20260629.md`
  - 기존 문서는 참고자료로 archive 처리한다.
  - 기존 문서의 커밋/진행 정보는 이 문서에 흡수한다.
- 완료 후 문서명 후보:
  - `docs/COMPLETED/2026-06-29_IMS_EXTERNAL_SYNC_SPLIT_BLOCK_POLICY_PM_COMPLETE_YYYYMMDD.md`
- 상태/정책문서 업데이트 대상:
  - `PROJECT_STATE.md`
  - 필요 시 `docs/policies/RENTCAR00_POLICY.md`
  - 필요 시 sync 운영 문서 신규 작성

## 1. 비개발자 기준 목적
IMS는 우리 내부 예약 원장이고, 찜카/카모아는 외부 판매처 달력이다.

목표는 단순하다.

- IMS 예약이 있으면 외부 판매처에서 그 시간/날짜를 팔지 못하게 막는다.
- 우리가 만든 차단만 자동으로 지운다.
- 찜카/카모아에 이미 있던 수동 차단은 자동으로 삭제하거나 흡수하지 않는다.
- 기존 수동 차단과 IMS 예약이 겹치면, 기존 차단은 벽처럼 두고 빈 구간만 잘라서 새 차단을 만든다.

## 2. 현재 상태 요약
- 현재 브랜치: `dev`
- HEAD 기준 최근 sync 관련 커밋:
  - `5eb3ca4 Add common sync logger`
  - `d3dcfe7 Connect sync runners to common logger`
- 현재 `origin/dev` 대비 로컬 `dev`는 위 2개 커밋이 앞서 있다.
- 현재 작업트리에는 P4/P5 구현 변경이 미커밋 상태로 섞여 있다.
- 기존 PMDOC의 최종 판단은 FIX 필요였고, COMPLETE/commit/save-run 금지 상태였다.

## 3. 확인된 주요 변경 파일
- 공통 logger/admin 표시:
  - `server/logging/syncLogger.js`
  - `server/logging/syncEventRepository.js`
  - `server/logging/__tests__/syncLogger.test.js`
  - `api/admin/bookings.js`
  - `src/services/adminBookingsApi.js`
  - `src/pages/AdminBookingsPage.jsx`
  - `supabase/migrations/20260629090500_create_sync_events.sql`
- IMS runner:
  - `scripts/ims-sync/run-ims-reservation-sync.js`
- 찜카 sync:
  - `scripts/zzimcar-sync/run-zzimcar-reconcile-sync.js`
  - `scripts/zzimcar-sync/lib/fetch-desired-ims-reservations.js`
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - `scripts/zzimcar-sync/lib/zzimcar-client.js`
  - `scripts/zzimcar-sync/lib/disable-time.js`
  - `scripts/zzimcar-sync/__tests__/*.test.js`
- 카모아 sync:
  - `scripts/carmore-sync/run-carmore-reconcile-sync.js`
  - `scripts/carmore-sync/lib/reconcile-carmore-holidays.js`

## 4. 기존 구현의 문제 판단
기존 P5 방향은 “겹치면 replace” 쪽으로 기울어 있었다. 그러나 수동/미관리 차단이 섞인 실제 운영에서는 위험하다.

### 문제 1. 삭제 누락 위험
- desired IMS 예약이 사라진 차량도 기존 mapping이 있으면 삭제 대상이 되어야 한다.
- 그런데 actual source를 찜카 current 중심으로 바꾸면 기존 mapping 삭제가 누락될 수 있다.

### 문제 2. 삭제 과잉 위험
- 찜카/카모아에 존재하지만 우리 DB mapping이 없는 차단은 수동 차단, 다른 시스템 차단, 과거 유실 차단일 수 있다.
- 이것을 자동 삭제하면 운영자가 일부러 막은 기간이 열릴 수 있다.

### 문제 3. synthetic id 위험
- 찜카 current에서 만든 `zzimcar-disable-time:{pid}` 같은 synthetic id가 mapping delete/fail 처리에 들어가면 실제 IMS 예약 mapping 정리가 꼬일 수 있다.

## 5. 확정 정책: unmanaged wall + child block split

### 5-1. 공통 원칙
- 내부 IMS active/future 예약 projection이 원본 기준이다.
- 외부 플랫폼 current 조회는 기간 확인/충돌 확인용 보조 데이터다.
- mapping 없는 외부 차단은 `unmanaged wall`로 본다.
- unmanaged wall은 자동 삭제·흡수·replace하지 않는다.
- IMS 예약 구간은 unmanaged wall이 덮지 않는 빈 구간만 잘라 `child block`으로 생성한다.
- mapping은 “우리가 만든 child block 추적값”이지 원본 truth가 아니다.


### 5-1-A. IMS managed overlap 처리 순서
- IMS 내부 active/future 예약끼리 겹치는 것은 unmanaged wall과 다르게 처리한다.
- 같은 차량의 IMS managed 예약 overlap은 먼저 내부 required coverage로 union한다.
- 이 union은 자동 병합 가능하다. 원본 truth가 내부 IMS 예약이기 때문이다.
- union 결과에는 반드시 `sourceImsReservationIds`와 `sourceReservations`를 보존한다.
- 대표 `imsReservationId` 하나만으로 판단하지 않는다. 대표 id는 표시/기존 mapping 호환용일 뿐이다.
- 실제 overlap만 union한다. adjacent interval은 기본적으로 병합하지 않는다.
- 이후 처리 순서:
  1. IMS active/future 예약 조회
  2. 차량별 IMS overlap union으로 required coverage 생성
  3. 외부 platform current 조회로 unmanaged wall 확인
  4. required coverage에서 unmanaged wall 구간 차감
  5. 남은 빈 구간만 child block으로 생성
  6. mapping에는 union source IMS id 목록과 child block id/range를 함께 보존

현재 코드 확인:
- `scripts/zzimcar-sync/lib/fetch-desired-ims-reservations.js`에는 `collapseOverlappingReservationsByCar()`가 있다.
- 이 함수는 같은 차량의 실제 overlap만 병합하고 adjacent는 병합하지 않는다.
- 병합 결과는 `sourceImsReservationIds`, `sourceReservations`를 보존한다.
- 관련 테스트:
  - `collapseOverlappingReservationsByCar merges only actual overlaps into vehicle blocked interval clusters`
  - `collapseOverlappingReservationsByCar does not merge adjacent intervals`
  - `collapseOverlappingReservationsByCar recomputes remaining blocked interval after cancellation-like removal`

보강 필요:
- 현재 구현은 찜카 desired 계산 쪽에 먼저 들어가 있다.
- 새 split policy에서는 이 union 결과를 찜카뿐 아니라 전역 차단 검증기와 카모아 날짜 split의 공통 required coverage source로 승격해야 한다.
- 따라서 provider별 구현 전에 `IMS required coverage builder`로 분리하거나, 같은 로직을 provider 공통 helper로 이동하는 phase가 필요하다.

### 5-2. 찜카 정책
- 찜카는 시간 단위 차단이다.
- 중복 오류만으로는 기존 차단 기간을 알 수 없다.
- 중복 오류 또는 사전 충돌 확인 시 해당 차량의 disable_time 목록을 조회해 겹치는 기간을 확인한다.
- mapping 없는 겹침 차단은 unmanaged wall로 분류한다.
- unmanaged wall은 삭제하지 않는다.
- IMS desired 구간에서 unmanaged wall과 겹치는 부분은 이미 막힌 것으로 보고 child block을 만들지 않는다.
- 빈 구간만 child block으로 생성한다.
- 경계 충돌 방지를 위해 필요하면 1시간 gap을 허용한다.
- 사장님 확인 기준: 1시간 gap은 구매불가이므로 운영상 허용한다.

예시:
- unmanaged wall: `6/30 00:00 ~ 7/5 00:00`
- IMS 예약: `6/22 00:00 ~ 7/1 00:00`
- 생성 대상 child block: `6/22 00:00 ~ 6/29 23:00`
- `6/30 ~ 7/1` 구간은 기존 wall이 이미 막고 있으므로 추가 생성하지 않는다.

### 5-3. 카모아 정책
- 카모아는 일자별 휴무 차단이다.
- mapping 없는 기존 휴무는 unmanaged wall로 분류한다.
- unmanaged wall 날짜는 삭제하지 않는다.
- IMS 예약 날짜 중 unmanaged wall이 덮는 날짜는 생성하지 않는다.
- 빈 날짜만 child holiday로 생성한다.

예시:
- unmanaged wall: `6/30 ~ 7/5`
- IMS 예약: `6/22 ~ 7/1`
- 생성 대상: `6/22 ~ 6/29`
- `6/30 ~ 7/1`은 기존 wall이 이미 막고 있으므로 추가 생성하지 않는다.

### 5-4. 자동 replace 금지 기준
아래 경우 자동 replace 금지:
- mapping 없는 외부 차단과 겹치는 경우
- 수동 차단인지, 과거 유실 차단인지, 다른 시스템 차단인지 확인 불가한 경우
- 기존 차단 삭제 없이 split으로 커버 가능한 경우

### 5-5. replace 허용 기준
자동 replace는 아래 조건을 모두 만족할 때만 허용한다.
- 대상 pid가 우리 mapping에 있다.
- 실제 IMS reservation id 기준으로 추적된다.
- 같은 차량의 같은 managed child block 범위에서 기간 수정이 필요하다.
- 삭제 후 생성 실패 시 rollback 또는 manual recovery 이벤트가 남는다.

## 6. 데이터/매핑 정책
- IMS 예약 1건은 외부 플랫폼 child block 여러 개를 가질 수 있다.
- 따라서 mapping은 `IMS 예약 1건 -> 외부 차단 1개`만 전제하면 안 된다.
- split 이후에는 다음을 추적해야 한다.
  - IMS reservation id
  - provider: `zzimcar` 또는 `carmore`
  - vehicle id / car number
  - external block pid/serial
  - child block start/end 또는 date range
  - source policy: `managed_child_split`
  - sync status
- synthetic id는 mapping write/delete/fail의 기준으로 쓰지 않는다.


## 7. 전역 차단 검증기 정책
코드 적용만으로 완료로 보지 않는다. 최종 목적은 IMS 예약 상태가 찜카/카모아/홈페이지에서 실제로 판매 차단 상태로 맞는지 확인하는 것이다.

### 7-1. 검증 기준
- 내부 IMS active/future 예약 projection을 기준으로 차량별 blocked coverage를 계산한다.
- 홈페이지 검색/예약 가능성은 내부 DB 기준으로 막혀야 한다.
- 찜카는 시간 단위 disable_time 기준으로 막혀야 한다.
- 카모아는 날짜 단위 holiday 기준으로 막혀야 한다.
- unmanaged wall이 덮는 구간은 “외부 차단 충족”으로 인정하되, 우리 mapping으로 흡수하지 않는다.
- split child block이 필요한 빈 구간은 provider별로 전부 생성 계획 또는 생성 결과가 있어야 한다.

### 7-2. 검증기 산출물
전역 검증기는 최소 아래 결과를 낸다.
- IMS 예약별 required block window/date
- 홈페이지 차단 충족 여부
- 찜카 coverage: managed child block + unmanaged wall 포함 여부
- 카모아 coverage: managed child holiday + unmanaged wall 포함 여부
- missing coverage 목록
- over-blocking 의심 목록
- unmanaged wall 충돌 목록
- provider별 sync event 기록 여부

### 7-3. 검증기 실행 모드
- 기본은 read-only 검증이다.
- 외부 플랫폼 write 없이 조회/비교만 수행한다.
- missing coverage가 있으면 자동 수정하지 않고 report만 낸다.
- save-run 보정은 별도 승인 phase로 분리한다.

### 7-4. 완료 기준
- 단순 테스트 통과가 아니라 “전역 차단 검증 report에서 critical missing coverage 0건”이어야 완료 후보가 된다.
- unmanaged wall로 커버되는 구간은 정상으로 분류하되, admin warning/event로 남긴다.
- 검증기가 실제 외부 조회를 필요로 하면 실행 전 별도 승인받는다.

## 8. sync logger 부착 검증 정책
새 logger는 붙었다고 가정하지 않고 provider별로 실제 이벤트 생성/저장/표시 가능성을 확인한다.

### 8-1. 확인 대상
- IMS runner start/success/failed/partial event
- 찜카 split plan / unmanaged wall / child create / failure / manual recovery event
- 카모아 date split / unmanaged wall / child create / failure event
- admin API `latestSyncEvents` 조회
- 관리자 UI 표시

### 8-2. logger 완료 기준
- stdout JSON event 생성 확인
- 민감정보 제거 테스트 통과
- DB 저장은 best-effort이며 실패해도 sync 본 작업을 죽이지 않음
- `sync_events` 테이블 미적용 상태에서도 graceful fallback
- DB migration 적용 후에는 최근 이벤트 조회 가능
- admin 표시 대상 event type allowlist에 split/unmanaged/manual recovery 이벤트 포함

### 8-3. 운영 DB 주의
- `supabase/migrations/20260629090500_create_sync_events.sql` 파일 생성은 DB 적용이 아니다.
- 실제 DB migration push는 별도 승인 phase로 분리한다.

## 9. 실행 금지
이 PM 승인 전 및 각 phase 별도 승인 전 금지:
- 찜카 save-run
- 카모아 save-run
- IMS/찜카/카모아 외부 write
- Supabase migration 적용
- deploy/restart
- commit
- `.env*`, secret, token, credential 수정

## 10. Phase 목록

### Phase 1. 정책 문서/코드 기준 재잠금
- 목적: 기존 replace 중심 PMDOC를 폐기 기준으로 두고, split child block 정책을 공식 기준으로 고정한다.
- 변경점:
  - 이 PMDOC 기준으로 찜카/카모아 sync 정책을 고정한다.
  - 기존 archive 문서는 참고자료로만 남긴다.
- 변경대상:
  - `docs/PHASE/2026-06-29_IMS_EXTERNAL_SYNC_SPLIT_BLOCK_POLICY_PM.md`
  - 필요 시 `PROJECT_STATE.md`
- 종료조건:
  - 정책 기준이 merge/replace가 아니라 split child block으로 명확히 정리된다.
- 검증방법:
  - 문서 직접 확인.
  - old PMDOC archive 경로 확인.
- 리스크:
  - 정책 문서만으로는 코드가 아직 맞지 않다.
- 출력보고:
  - 확정 정책 요약.


### Phase 2. IMS required coverage builder 공통화
- 목적: IMS 내부 managed overlap을 provider별 임시 로직이 아니라 공통 required coverage 기준으로 고정한다.
- 현재 코드 상태:
  - `scripts/zzimcar-sync/lib/fetch-desired-ims-reservations.js`의 `collapseOverlappingReservationsByCar()`가 같은 차량 실제 overlap을 union한다.
  - `sourceImsReservationIds`와 `sourceReservations`는 이미 보존한다.
  - adjacent interval은 병합하지 않는 테스트가 있다.
- 변경점:
  - IMS active/future 예약 → 차량별 required coverage 계산을 공통 helper로 분리하거나 명확히 provider 공통 source로 승격한다.
  - 찜카/카모아/전역 검증기가 같은 required coverage를 사용하게 한다.
  - 대표 IMS id 하나만으로 child block mapping을 판단하지 않게 한다.
- 변경대상:
  - 후보 신규: `scripts/sync-coverage/build-ims-required-coverage.js`
  - 또는 기존 `scripts/zzimcar-sync/lib/fetch-desired-ims-reservations.js` 공통화
  - `scripts/zzimcar-sync/__tests__/fetch-desired-ims-reservations.test.js`
  - 카모아/검증기 관련 tests
- 종료조건:
  - IMS overlap union 결과가 provider 공통 required coverage로 사용된다.
  - source IMS id 목록이 child block split 이후에도 보존된다.
  - adjacent 미병합 정책이 테스트로 유지된다.
- 검증방법:
  - IMS overlap union 테스트.
  - adjacent 미병합 테스트.
  - cancellation-like removal 후 remaining coverage 재계산 테스트.
- 리스크:
  - 기존 찜카 전용 helper를 무리하게 옮기면 import 경로 영향이 생길 수 있다.
- 되돌릴 방법:
  - 공통 helper 분리 diff revert.
- 출력보고:
  - required coverage 예시와 source IMS id 목록.

### Phase 3. 찜카 actual source 재설계
- 목적: 찜카 current 전체를 truth처럼 쓰는 구조를 제거한다.
- 변경점:
  - `previousMappings`는 managed child block 기준으로 유지한다.
  - 찜카 current 조회 결과는 unmanaged wall / overlap wall 검출용으로 분리한다.
  - `fetchCurrentZzimcarDisableTimeRows`의 역할을 actual builder가 아니라 wall detector로 재정의하거나 새 helper로 분리한다.
- 변경대상:
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - `scripts/zzimcar-sync/__tests__/reconcile-zzimcar-disable-times.test.js`
- 종료조건:
  - synthetic id가 deletion/failure mapping 처리에 들어가지 않는다.
  - managed actual과 unmanaged wall이 분리된다.
- 검증방법:
  - synthetic id mapping 금지 테스트.
  - unmanaged wall 자동 삭제 금지 테스트.
- 리스크:
  - 기존 replace 테스트 일부 폐기/수정 필요.
- 되돌릴 방법:
  - Phase 2 diff revert.
- 출력보고:
  - managed/unmanaged 분리 방식.

### Phase 4. 찜카 child block split 계획 구현
- 목적: IMS desired 구간에서 unmanaged wall을 빼고 빈 구간만 생성 계획으로 만든다.
- 변경점:
  - interval subtraction helper 추가.
  - 1시간 gap 정책 적용 지점 명확화.
  - desired 1건이 여러 child block으로 나뉘는 plan 구조 추가.
  - 기존 managed child block과 비교해 create/delete/unchanged/replacement를 계산한다.
- 변경대상:
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - 필요 시 `scripts/zzimcar-sync/lib/fetch-desired-ims-reservations.js`
  - 관련 tests
- 종료조건:
  - unmanaged wall `6/30~7/5`, IMS `6/22~7/1` 케이스에서 `6/22~6/29 23:00` child block만 생성 계획이 나온다.
  - unmanaged wall 삭제 계획은 0건이다.
- 검증방법:
  - interval split 단위 테스트.
  - dry-run plan 테스트.
- 리스크:
  - 1시간 gap 적용으로 실제 차단 범위가 의도보다 짧아질 수 있으나, 구매불가 정책상 허용한다.
- 되돌릴 방법:
  - Phase 3 diff revert.
- 출력보고:
  - 생성 child block 목록 예시.

### Phase 5. 찜카 save-run 안전장치 정리
- 목적: 실제 저장 모드에서도 split child block만 생성/삭제되게 한다.
- 변경점:
  - create는 child block 단위로 수행한다.
  - delete는 managed child block만 수행한다.
  - unmanaged wall은 delete/replace 대상에서 제외한다.
  - duplicate 발생 시 current 조회 후 unmanaged wall로 커버되는지 재판정한다.
  - rollback/manual recovery 이벤트를 유지한다.
- 변경대상:
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - `scripts/zzimcar-sync/lib/zzimcar-sync-mapping-repo.js` 필요 시
  - `server/logging/syncLogger.js` 또는 event type allowlist 필요 시
  - 관련 tests
- 종료조건:
  - save-run mock에서 unmanaged wall 삭제가 발생하지 않는다.
  - managed child block만 삭제/생성된다.
- 검증방법:
  - mock client save-run 테스트.
  - rollback success/failure 테스트.
- 리스크:
  - 실제 찜카 API 동작은 외부 write 승인 전까지 미검증.
- 되돌릴 방법:
  - save-run 전이면 code revert.
  - save-run 후에는 sync event 기준 수동 복구 필요.
- 출력보고:
  - 실제 외부 write 미실행 여부.

### Phase 6. 카모아 날짜 split 정책 구현
- 목적: 카모아 일자별 휴무에서도 unmanaged wall을 삭제하지 않고 빈 날짜만 생성한다.
- 변경점:
  - existing unmapped holiday 날짜를 unmanaged wall로 분류한다.
  - IMS desired 날짜에서 unmanaged 날짜를 제외한다.
  - 빈 날짜 range만 child holiday로 생성한다.
  - 날짜가 연속되면 가능한 range로 묶되, unmanaged 날짜를 침범하지 않는다.
- 변경대상:
  - `scripts/carmore-sync/lib/reconcile-carmore-holidays.js`
  - `scripts/carmore-sync/__tests__/reconcile-carmore-holidays.test.js`
  - 필요 시 mapping repo
- 종료조건:
  - unmanaged wall `6/30~7/5`, IMS `6/22~7/1` 케이스에서 `6/22~6/29`만 생성 계획이 나온다.
  - unmanaged wall 삭제 계획은 0건이다.
- 검증방법:
  - `npm run test:carmore-sync`
- 리스크:
  - 카모아 날짜 inclusive/exclusive 해석 오류 가능.
- 되돌릴 방법:
  - Phase 5 diff revert.
- 출력보고:
  - 날짜 split 결과.

### Phase 7. 공통 sync event/admin 표시 정리
- 목적: split conflict와 unmanaged wall 상태가 관리자에게 보이게 한다.
- 변경점:
  - event type 후보:
    - `sync_unmanaged_wall_detected`
    - `sync_child_block_split_planned`
    - `sync_child_block_create_failed`
    - `sync_manual_recovery_required`
  - admin API/UI에서 warning/error/ack 대상 이벤트 표시 유지.
- 변경대상:
  - `server/logging/syncLogger.js`
  - `server/logging/syncEventRepository.js`
  - `api/admin/bookings.js`
  - `src/services/adminBookingsApi.js`
  - `src/pages/AdminBookingsPage.jsx`
  - 관련 tests
- 종료조건:
  - logger 실패가 sync 본 작업을 막지 않는다.
  - unmanaged wall 감지 이벤트가 admin 표시 대상에 포함된다.
- 검증방법:
  - `node --test server/logging/__tests__/syncLogger.test.js`
  - 전역 차단 검증기 read-only/mock report
  - `npm run build`
- 리스크:
  - 실제 DB migration 적용 전에는 admin 화면에 DB 이벤트가 없을 수 있다.
- 되돌릴 방법:
  - API/UI/logger diff revert.
- 출력보고:
  - admin 표시 이벤트 목록.


### Phase 8. 전역 차단 검증기 도입
- 목적: IMS 예약 상태가 홈페이지/찜카/카모아 전체에서 실제 차단 coverage로 맞는지 read-only로 검증한다.
- 변경점:
  - IMS active/future 예약 projection 기준 required coverage 계산.
  - 홈페이지 내부 차단, 찜카 disable_time, 카모아 holiday coverage 비교.
  - managed child block과 unmanaged wall을 분리해 coverage 판정.
  - missing coverage / over-blocking / unmanaged conflict report 생성.
- 변경대상:
  - 신규 후보: `scripts/sync-coverage/verify-external-block-coverage.js`
  - 필요 시 provider별 조회 helper
  - 관련 tests
- 종료조건:
  - read-only 검증 report가 provider별 coverage를 출력한다.
  - critical missing coverage를 식별한다.
  - 자동 수정/write는 수행하지 않는다.
- 검증방법:
  - 검증기 단위 테스트.
  - fixture 기반 IMS/찜카/카모아 coverage 비교 테스트.
- 리스크:
  - 실제 외부 조회가 필요하면 별도 승인 전까지 fixture/mock 검증으로 제한된다.
- 출력보고:
  - coverage summary, missing list, unmanaged wall list.

### Phase 9. sync logger 실제 부착/표시 검증
- 목적: 새 logger가 IMS/찜카/카모아 runner와 admin 표시까지 실제로 연결되는지 검증한다.
- 변경점:
  - split/unmanaged/manual recovery event type 추가/정리.
  - provider별 event 생성 테스트.
  - `sync_events` 저장소 fallback 및 admin 조회 확인.
- 변경대상:
  - `server/logging/syncLogger.js`
  - `server/logging/syncEventRepository.js`
  - `server/logging/__tests__/syncLogger.test.js`
  - `scripts/ims-sync/run-ims-reservation-sync.js`
  - `scripts/zzimcar-sync/run-zzimcar-reconcile-sync.js`
  - `scripts/carmore-sync/run-carmore-reconcile-sync.js`
  - `api/admin/bookings.js`
  - `src/pages/AdminBookingsPage.jsx`
- 종료조건:
  - IMS/찜카/카모아 이벤트가 stdout에 남는다.
  - DB 저장 실패가 sync 실패로 전파되지 않는다.
  - admin 표시 대상 이벤트에 split/unmanaged/manual recovery가 포함된다.
- 검증방법:
  - `node --test server/logging/__tests__/syncLogger.test.js`
  - runner dry-run/mock event 확인
  - `npm run build`
- 리스크:
  - 실제 DB 저장 확인은 migration 적용 승인 후 가능하다.
- 출력보고:
  - provider별 event sample, admin 표시 필드.

### Phase 10. 통합 검증
- 목적: 찜카/카모아/IMS sync 변경이 기존 기능을 깨지 않는지 확인한다.
- 변경점: 코드 수정 없음. 검증만 수행.
- 검증 명령:
  - `npm run test:zzimcar-sync`
  - `npm run test:carmore-sync`
  - `node --test server/logging/__tests__/syncLogger.test.js`
  - `npm run build`
  - `git diff --check`
  - update 전제 검색: `rg "updateDisableTime|buildDisableTimeUpdatePayload|action: ['\"]update['\"]|update-merge" scripts/zzimcar-sync scripts/carmore-sync`
- 종료조건:
  - 전체 명령 통과.
  - 외부 write/save-run/DB migration/deploy/restart 미실행 확인.
- 리스크:
  - 실제 운영 플랫폼 반영은 아직 검증되지 않는다.
- 출력보고:
  - 명령별 결과.

### Final Phase. 완료판정·문서 COMPLETE·커밋 게이트
- 목적: 모든 phase가 끝난 후 완료 여부를 판정한다.
- 변경점:
  - PM 문서 완료 위치 이동 또는 이름 변경.
  - 필요 시 `PROJECT_STATE.md`, 정책/운영 문서 업데이트.
  - 사용자 승인 시에만 commit.
- 변경대상:
  - `docs/PHASE/2026-06-29_IMS_EXTERNAL_SYNC_SPLIT_BLOCK_POLICY_PM.md`
  - `docs/COMPLETED/**`
  - `PROJECT_STATE.md` 필요 시
  - 변경 코드 전체
- 종료조건:
  - 테스트 통과.
  - 문서 최신화.
  - 남은 운영 리스크 기록.
  - 커밋 승인 시 커밋 해시 기록.
- 검증방법:
  - `git status --short`
  - `git diff --check`
  - Phase 10 검증 결과 재확인.
- 리스크:
  - DB migration, 외부 save-run, deploy는 별도 운영 승인 없이는 완료 범위에 넣지 않는다.
- 출력보고:
  - 완료 phase, 변경 파일, 검증 결과, 완료 문서 경로, 커밋 여부, 남은 리스크.

## 11. 승인 및 중단 조건
- 승인 요청:
  - 이 문서는 정책/phase 계획이다.
  - 코드 수정은 별도 승인 후 Phase 2부터 진행한다. Phase 2는 IMS required coverage 공통화부터 시작한다.
- 중단 조건:
  - unmanaged wall을 삭제해야만 해결 가능한 구조 발견.
  - split child block으로 외부 플랫폼 중복 오류를 피할 수 없음이 확인됨.
  - mapping schema가 다중 child block을 추적할 수 없어 DB schema 변경이 필요한 경우.
  - 운영 DB migration 적용 필요.
  - 외부 플랫폼 save-run 필요.
  - `.env*`, secret, token, credential 수정 필요.
- protected target 별도 승인:
  - Supabase migration 적용
  - 찜카/카모아/IMS 실제 write
  - launchd/restart/deploy
  - commit

## 12. 완료 보고 형식
- 완료 phase:
- 정책 반영 결과:
- 변경 파일:
- 검증 결과:
- 외부 write 여부:
- DB migration 적용 여부:
- 완료 문서 경로:
- 커밋:
- 남은 리스크:


## 13. 2026-06-29 pa.all 로컬 실행 결과
- 실행 범위: Phase 2~10 로컬 코드/테스트/문서 범위.
- 실행 제외: 외부 API write/save-run, Supabase migration apply/push, deploy/restart/launchd, commit, `.env*`/secret 수정.
- 구현 결과:
  - 공통 IMS required coverage builder 추가: `scripts/sync-coverage/build-ims-required-coverage.js`
  - read-only 전역 coverage verifier 추가: `scripts/sync-coverage/verify-external-block-coverage.js`
  - 찜카 unmanaged wall + child block split 정책 반영
  - 카모아 unmanaged holiday wall + date split 정책 반영
  - split/unmanaged/manual recovery sync event allowlist 및 테스트 보강
- 1차 Reviewer FIX 지적:
  1. 찜카 child block이 2개 이상으로 쪼개질 때 dedupe key가 source IMS ids 기준이라 일부 child가 누락될 수 있음.
  2. 카모아 실제 reconcile 경로에서 unmanaged wall 조회/분류가 `[]`로 비어 있음.
- FIX 반영:
  - 찜카 plan dedupe key를 `childBlockKey` 또는 range 포함 key로 변경.
  - 카모아 current holiday 조회/분류 helper 추가: mapping 없는 current holiday를 unmanaged wall로 분리.
  - 카모아 plan도 child holiday range 기준을 보존하고, 같은 IMS 날짜 변경은 change로 유지.
- 검증 결과:
  - `npm run test:zzimcar-sync` → 46 pass
  - `npm run test:carmore-sync` → 18 pass
  - `node --test server/logging/__tests__/syncLogger.test.js` → 10 pass
  - `node --test scripts/sync-coverage/__tests__/*.test.js` → 3 pass
  - `npm run build` → pass
  - `git diff --check` → pass
  - update 전제 검색 → 실행 코드 no matches
- 완료판정:
  - 로컬 코드/테스트 검증은 PASS.
  - 운영 완료는 아님. 실제 외부 플랫폼 read/write, DB migration 적용, 배포, launchd, commit은 별도 승인 필요.
- 새로 확인된 운영 schema gate:
  - 현재 `zzimcar_disable_time_sync_mappings`와 `carmore_holiday_sync_mappings`는 unique key가 `ims_reservation_id` 단일 기준이다.
  - 현재 repo도 `upsert(... onConflict: 'ims_reservation_id')`를 사용한다.
  - split child block 정책은 IMS 예약 1건이 여러 child block/holiday를 가질 수 있으므로, 운영 save-run 전 mapping schema와 repository upsert key를 child key/range 기준으로 확장해야 한다.
  - 이 작업은 Supabase migration 파일/운영 DB 적용이 걸리므로 별도 schema phase 승인 전에는 save-run 금지.
- 다음 게이트:
  1. schema phase PM/승인: child block key 또는 provider child range unique key 도입
  2. 운영 DB migration 적용 승인 여부 결정
  3. 실제 외부 read-only coverage 검증 승인 여부 결정
  4. save-run 보정 승인 여부 결정
  5. COMPLETE 문서 이동 및 commit 승인 여부 결정
