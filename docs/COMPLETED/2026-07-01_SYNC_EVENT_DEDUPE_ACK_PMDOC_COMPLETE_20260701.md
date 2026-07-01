# Sync Event Dedupe & Admin Ack PMDOC

## 0. 문서 정보
- 작성일: 2026-07-01
- 작성자/agent: OpenClaw `rentcar00_reservation_developer`
- 상태: COMPLETE
- 기준 브랜치: `dev`
- 기준 커밋: `9a92eb4 Complete external vehicle state live apply`
- 현재 브랜치 상태:
  - branch: `dev`
  - working tree: clean 확인 후 이 PMDOC 신규 작성
  - `origin/dev...dev`: 0 ahead / 0 behind
  - open PR: `#9 Complete IMS external vehicle state live apply` (`dev` → `master`)
- 목적: 찜카/카모아 unmanaged wall 같은 반복 운영 경고를 중복 row로 계속 쌓지 않고, 관리자 화면에서 확인/보존 처리를 할 수 있게 한다.
- 승인 범위: `sync_events` 중복 통합, ack 상태/액션 API, 관리자 화면 표시 개선, 테스트/build, 문서 COMPLETE/커밋/push/PR 업데이트.
- 관련 파일:
  - `supabase/migrations/20260629090500_create_sync_events.sql`
  - `server/logging/syncEventRepository.js`
  - `server/logging/syncLogger.js`
  - `api/admin/bookings.js`
  - `src/pages/AdminBookingsPage.jsx`
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - `scripts/carmore-sync/lib/reconcile-carmore-holidays.js`
- 완료 후 문서명: `docs/COMPLETED/2026-07-01_SYNC_EVENT_DEDUPE_ACK_PMDOC_COMPLETE_20260701.md`
- 상태/정책문서 업데이트 대상:
  - `PROJECT_STATE.md`
  - 필요 시 `docs/policies/RENTCAR00_POLICY.md`

## 1. 목적
- 목표:
  - 같은 `dedupe_key` 경고가 매 실행마다 새 row로 반복 표시되는 문제를 막는다.
  - 반복 발생은 하나의 이벤트에 `seen_count`, `last_seen_at`으로 누적한다.
  - 관리자가 운영 화면에서 “확인 완료/보존”을 누를 수 있게 한다.
  - 경고 설명을 사람이 판단 가능한 문구로 보여준다.
- 성공 기준:
  - `zzimcar:unmanaged_wall:231766` 같은 동일 경고가 10분마다 새 카드로 늘어나지 않는다.
  - 기존 unread 이벤트는 유지되고, 반복 발생 시 count/last seen만 갱신된다.
  - 관리자 화면에 차량, 기간, 외부 PID, 의미, 선택지가 표시된다.
  - ack API로 `acknowledged` 또는 `ignored` 상태 변경이 가능하다.
  - 외부 차단 삭제/흡수는 실행하지 않는다.
- 제외 범위:
  - 찜카/카모아 외부 차단 삭제.
  - unmanaged wall의 자동 mapping 흡수.
  - deploy.
  - launchd restart.
  - secret/runtime config 변경.

## 2. 현재 상태
- 확인한 상태:
  - 현재 branch: `dev`
  - `origin/dev...dev`: 0 / 0
  - 최근 커밋: `9a92eb4 Complete external vehicle state live apply`
  - open PR: `#9 Complete IMS external vehicle state live apply`
- 현재 구현:
  - `sync_events`에는 `ack_status`, `ack_key`, `dedupe_key`가 있다.
  - `ack_status` check는 현재 `not_required`, `unread`, `acknowledged`만 허용한다.
  - `syncEventRepository.persistSyncEventBestEffort()`는 현재 `.insert()`만 수행한다.
  - `dedupe_key` index/unique 제약은 현재 migration에 없다.
  - 관리자 예약 API는 `fetchRecentSyncEvents()`로 최근 이벤트 10건을 내려준다.
  - `AdminBookingsPage.jsx`는 최근 동기화 이벤트를 카드로 표시하지만 ack 버튼/상태 설명은 없다.
- 현재 문제:
  - unmanaged wall 이벤트는 `dedupeKey`가 있어도 매 주기마다 신규 insert된다.
  - 같은 경고가 반복 카드로 보이며 관리자 피로도가 높다.
  - ack를 할 수 있는 API/UI가 없다.
- 대표 사례:
  - `zzimcar:unmanaged_wall:231766`
  - 차량 `142호5773`
  - 기간 `2026-07-06 09:00 ~ 2026-07-07 15:00 KST`
  - 현재 정책상 자동 삭제하지 않고 보존해야 하는 수동/미관리 차단 경고.

## 3. 전체 변경 요약
- 변경점:
  - `sync_events`에 반복 감지용 컬럼과 dedupe unique 기준 추가.
  - 기존 중복 `dedupe_key` row 정리 migration 작성.
  - event persistence를 insert-only에서 dedupe-aware upsert/update로 변경.
  - ack 상태 변경 repository/API 추가.
  - 관리자 UI에 상태 설명, 반복 횟수, 마지막 감지, ack 버튼 추가.
- 변경대상:
  - Supabase migration 신규 파일
  - `server/logging/syncEventRepository.js`
  - `server/logging/__tests__/syncLogger.test.js`
  - `api/admin/bookings.js`
  - `src/pages/AdminBookingsPage.jsx`
  - 관련 docs
- 예상 영향:
  - 기존 운영 이벤트는 계속 저장된다.
  - dedupe_key가 있는 반복 이벤트만 한 row로 통합된다.
  - dedupe_key가 없는 이벤트는 기존처럼 insert된다.
- 주요 리스크:
  - live DB migration 필요.
  - 기존 중복 row 정리 기준을 잘못 잡으면 과거 이벤트 일부가 archive 처리될 수 있다.
  - `dedupe_key` unique를 전체 적용하면 과거 성공 이벤트(`ims:sync_success`)까지 1건만 남을 수 있으므로 부분 unique 기준이 필요하다.

## 4. Phase 목록

### Phase 1. 현재 데이터/스키마 확인
- 목적: live `sync_events` 중복 상황과 안전한 migration 기준을 확인한다.
- 변경점: 없음. 읽기/진단만 수행.
- 변경대상: 없음.
- 실행방법:
  - `sync_events` schema 확인.
  - `dedupe_key` 중복 count 확인.
  - unmanaged wall 중복 row 수 확인.
  - 성공 이벤트 dedupe_key 사용 현황 확인.
- 종료조건:
  - partial unique index 대상 기준 확정.
- 검증방법:
  - SQL select 결과 확인.
- 리스크:
  - Supabase 접근 실패 시 phase 중단.
- 출력보고:
  - 중복 dedupe_key 목록 요약.
  - 적용 가능한 index 조건.

### Phase 2. DB migration 작성
- 목적: 반복 이벤트 통합을 위한 DB 구조를 추가한다.
- 변경점:
  - `sync_events.last_seen_at timestamptz` 추가.
  - `sync_events.seen_count integer default 1` 추가.
  - 필요 시 `ack_note text`, `acked_at timestamptz` 추가.
  - `ack_status` check 확장: `not_required`, `unread`, `acknowledged`, `ignored`, `resolved`.
  - dedupe용 partial unique index 추가.
- 변경대상:
  - 신규 migration SQL.
- 실행방법:
  - dedupe 대상은 `requires_ack=true and dedupe_key is not null` 중심으로 제한한다.
  - 기존 중복은 최신 row를 canonical로 남기고 count/last_seen을 합산하는 SQL을 작성한다.
- 종료조건:
  - migration SQL inspection 완료.
  - 기존 성공 이벤트 보존 정책 충돌 없음.
- 검증방법:
  - SQL 직접 inspection.
  - 가능하면 local/static syntax 확인.
- 리스크:
  - live DB schema 변경 필요.
  - 기존 중복 정리 로직 오류.
- 되돌릴 방법:
  - 신규 index/column drop migration 별도 작성.
- 출력보고:
  - 추가 컬럼.
  - unique index 조건.
  - 중복 정리 기준.

### Phase 3. repository dedupe upsert 구현
- 목적: 반복 이벤트를 insert하지 않고 기존 row를 갱신한다.
- 변경점:
  - `persistSyncEventBestEffort()`에서 `requires_ack=true` + `dedupe_key` 존재 시 upsert/update 경로 사용.
  - 기존 row가 있으면:
    - `occurred_at` 또는 `last_seen_at` 갱신
    - `seen_count += 1`
    - `metadata.lastSeenRunId`, `metadata.lastSeenAt` 반영
    - `ack_status`는 이미 `acknowledged/ignored/resolved`면 덮어쓰지 않음
  - dedupe_key 없는 이벤트는 기존 insert 유지.
- 변경대상:
  - `server/logging/syncEventRepository.js`
  - tests
- 종료조건:
  - repository unit test 통과.
- 검증방법:
  - insert-only 이벤트 테스트.
  - duplicate warning update 테스트.
  - acknowledged 상태 보존 테스트.
- 리스크:
  - 모든 이벤트가 dedupe되면 운영 이력 손실 가능. 조건을 엄격히 제한한다.
- 되돌릴 방법:
  - repository 변경 revert.
- 출력보고:
  - dedupe 조건.
  - ack 상태 보존 여부.

### Phase 4. ack API 추가
- 목적: 관리자 화면에서 운영 이벤트를 확인 처리할 수 있게 한다.
- 변경점:
  - admin API에 sync event ack endpoint 추가.
  - 입력: event id 또는 ackKey/dedupeKey, action.
  - 허용 action: `acknowledged`, `ignored` 우선.
  - 외부 차단 삭제/흡수 action은 API에서 처리하지 않음.
- 변경대상:
  - `api/admin/bookings.js` 또는 별도 admin sync-events API.
  - `server/logging/syncEventRepository.js`
  - frontend service 필요 시.
- 종료조건:
  - 인증된 admin만 ack 가능.
  - ack 후 fetchRecentSyncEvents 결과에 상태 반영.
- 검증방법:
  - API unit/integration 가능한 범위.
  - 직접 handler inspection.
- 리스크:
  - 관리자 인증 우회 위험.
- 되돌릴 방법:
  - API route 변경 revert.
- 출력보고:
  - endpoint.
  - 허용 action.

### Phase 5. 관리자 UI 표시 개선
- 목적: 경고 의미와 조치 상태를 운영자가 이해하고 확인 처리할 수 있게 한다.
- 변경점:
  - SyncEventPanel에 상태 설명 추가.
  - unmanaged wall 문구를 사람이 읽는 형태로 변환.
  - 차량/기간/PID/반복 횟수/마지막 감지 표시.
  - 버튼: `확인 완료`, `보존 처리`.
  - `acknowledged/ignored` 이벤트는 접거나 낮은 톤으로 표시.
- 변경대상:
  - `src/pages/AdminBookingsPage.jsx`
  - admin booking API response shape 필요 시.
- 종료조건:
  - `zzimcar:unmanaged_wall:231766`이 “찜카 수동 차단 감지 / 보존 중 / 확인 필요”로 표시된다.
  - 반복 row가 아니라 반복 횟수로 표시된다.
- 검증방법:
  - build.
  - UI 데이터 shape inspection.
- 리스크:
  - 관리자 페이지가 예약 관리와 운영 이벤트를 함께 보여 피로도가 생길 수 있음.
- 되돌릴 방법:
  - UI 변경 revert.
- 출력보고:
  - 표시 문구.
  - 버튼 동작.

### Phase 6. 테스트/build/no-write 확인
- 목적: 운영 sync와 관리자 화면 변경이 깨지지 않았는지 확인한다.
- 변경점: 없음. 검증만 수행.
- 검증방법:
  - `node --test server/logging/__tests__/*.test.js`
  - `node --test scripts/zzimcar-sync/__tests__/*.test.js`
  - `node --test scripts/carmore-sync/__tests__/*.test.js`
  - `npm run build`
  - 필요 시 live no-write smoke.
- 종료조건:
  - 테스트/build 통과.
- 리스크:
  - live no-write smoke는 외부 조회를 포함하므로 실패 시 원인 분리 필요.
- 출력보고:
  - 테스트 결과.

### Phase 7. migration apply / launchd 모니터링
- 목적: dedupe migration을 live DB에 적용하고 반복 경고가 합쳐지는지 확인한다.
- 변경점:
  - live DB schema 변경.
  - launchd 반복 실행 후 sync_events 결과 확인.
- 변경대상:
  - Live Supabase DB.
- 실행방법:
  - migration apply 전 승인 재확인.
  - apply 후 찜카 reconcile 1~2회 관찰.
- 종료조건:
  - 같은 unmanaged wall이 신규 row로 늘지 않고 seen_count만 증가.
  - ack 버튼으로 상태 변경 가능.
- 검증방법:
  - DB select.
  - 관리자 API/UI 결과 확인.
- 리스크:
  - live DB 변경.
- 되돌릴 방법:
  - 신규 index/column rollback 계획 별도 승인.
- 출력보고:
  - seen_count 변화.
  - ack 상태 변경 확인.

### Final Phase. 문서 COMPLETE / 커밋 / push / PR 업데이트
- 목적: 결과를 문서화하고 dev/PR에 반영한다.
- 변경점:
  - PMDOC COMPLETE 이동.
  - `PROJECT_STATE.md` 업데이트.
  - 커밋.
  - origin/dev push.
  - 기존 PR #9 업데이트 또는 새 PR 판단.
- 변경대상:
  - docs
  - git commit/push
  - GitHub PR
- 종료조건:
  - COMPLETE 문서 생성.
  - 커밋/push 완료.
  - PR 본문 또는 코멘트에 migration/ack 변경 명시.
- 검증방법:
  - `git diff --check`
  - `git status --short`
  - PR 확인.
- 리스크:
  - 기존 PR 범위가 커질 수 있음.
- 되돌릴 방법:
  - revert commit 또는 PR에서 제외.
- 출력보고:
  - 커밋 해시.
  - PR URL.

## 5. 승인 및 중단 조건
- 승인 요청:
  - `이 PMDOC 기준으로 Phase 1부터 Final Phase까지 진행 승인`
- 중단 조건:
  - live sync_events 중복 데이터 정리 기준이 불명확함.
  - unique index 조건이 기존 이벤트 이력 보존과 충돌함.
  - 관리자 인증/권한 경로가 불명확함.
  - 테스트/build 실패.
  - migration apply 필요 시 별도 승인이 없거나 대상 DB 불명확.
  - 외부 차단 삭제/흡수 필요가 발생함.
- protected target 별도 승인 필요:
  - live DB migration apply.
  - launchd restart.
  - deploy.
  - secret/runtime config 수정.

## 6. 완료 보고 형식
- 완료 phase:
- 변경 파일:
- DB migration:
- dedupe 동작 결과:
- ack API/UI 결과:
- 검증 결과:
- COMPLETE 문서 경로:
- 커밋:
- push/PR:
- 남은 리스크:


## 7. 실행 결과
- 실행일: 2026-07-01 KST
- Phase 1 현재 데이터/스키마 확인: 완료
  - requires_ack + dedupe_key row: 179건 확인.
  - 중복 dedupe_key: `zzimcar:unmanaged_wall:231766` 159건, `carmore:unmanaged_wall:1605252` 6건, `carmore:unmanaged_wall:1605300` 4건, `carmore:unmanaged_wall:1605315` 3건, `carmore:unmanaged_wall:1605317` 2건.
- Phase 2 DB migration 작성/적용: 완료
  - migration: `supabase/migrations/20260701112000_dedupe_sync_events_ack.sql`
  - 추가: `last_seen_at`, `seen_count`, `acked_at`, `ack_note`.
  - ack 상태 확장: `ignored`, `resolved` 추가.
  - partial unique index: `requires_ack=true and dedupe_key is not null` 기준.
  - live Supabase apply 완료.
- Phase 3 repository dedupe update: 완료
  - `persistSyncEventBestEffort()`가 requires_ack + dedupe_key 이벤트는 기존 row update로 처리.
  - terminal ack 상태(`acknowledged`, `ignored`, `resolved`)는 반복 감지 시 덮어쓰지 않음.
- Phase 4 ack API: 완료
  - `POST /api/admin/bookings?action=sync-event-ack`
  - 허용 상태: `acknowledged`, `ignored`, `resolved`.
- Phase 5 관리자 UI 표시 개선: 완료
  - 반복 횟수, 마지막 감지, ack 상태 표시.
  - unmanaged wall은 수동/미관리 차단 설명과 PID/serial/기간을 표시.
  - 버튼: `확인 완료`, `보존 처리`.
- Phase 6 테스트/build: 완료
  - `node --test server/logging/__tests__/*.test.js`: 10 pass.
  - `node --test scripts/zzimcar-sync/__tests__/*.test.js`: 47 pass.
  - `node --test scripts/carmore-sync/__tests__/*.test.js`: 20 pass.
  - `npm run build`: pass.
- Phase 7 live dedupe 확인: 완료
  - `zzimcar:unmanaged_wall:231766` 기존 159 row → 1 row로 통합.
  - launchd 찜카 reconcile 1회 kickstart 후 신규 row 증가 없이 `seen_count` 159 → 160으로 증가 확인.
  - launchd status: `ai.otang.zzimcar-reconcile-sync` last exit code 0.
- Final Phase: 이 문서 COMPLETE, `PROJECT_STATE.md` 업데이트, 커밋/push/PR 업데이트 진행.

## 8. 남은 리스크 / 운영 메모
- 배포는 실행하지 않았다.
- 전체 launchd restart는 실행하지 않았고, dedupe live 확인을 위해 찜카 reconcile만 1회 kickstart했다.
- 외부 차단 삭제/흡수는 실행하지 않았다.
- `.env*`, secret, token, runtime config 값은 수정하지 않았다.
- 관리자 화면의 ack 버튼은 다음 배포 후 UI에서 사용 가능하다.
