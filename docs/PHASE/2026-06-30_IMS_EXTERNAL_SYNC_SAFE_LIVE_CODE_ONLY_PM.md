# IMS External Sync Safe Live Code-Only PM

## 0. 문서 정보
- 작성일: 2026-06-30
- 작성자/agent: OpenClaw / rentcar00_reservation_developer
- 상태: Draft
- 승인 범위: 아직 실행 승인 전. 이 문서는 안전 적용 계획과 현재 상태 고정용이다.
- 관련 문서:
  - `PROJECT_STATE.md`
  - `docs/PHASE/2026-06-29_IMS_EXTERNAL_SYNC_SPLIT_BLOCK_POLICY_PM.md`
  - `docs/PHASE/2026-06-29_IMS_EXTERNAL_SYNC_CHILD_MAPPING_SCHEMA_PM.md`
- 완료 후 문서명: `docs/COMPLETED/2026-06-30_IMS_EXTERNAL_SYNC_SAFE_LIVE_CODE_ONLY_PM_COMPLETE_YYYYMMDD.md`
- 상태/정책문서 업데이트 대상:
  - `PROJECT_STATE.md`
  - 필요 시 sync 운영 문서

## 1. 목적
- 목표: save-run 없이 코드/검사 로직만 안전하게 정리하고, 라이브 DB/외부 플랫폼 write 없이 현재 차단 상태를 정확히 판정한다.
- 성공 기준:
  - `mapping 없음 = 차단 없음`으로 단정하지 않는다.
  - 라이브 DB migration, 외부 save-run, 외부 create/update/delete 없이 read-only smoke만 가능하다.
  - IMS `4320448` / `142호5773` / `2026-06-30T01:00:00.000Z~2026-07-03T01:00:00.000Z` missing 판정을 수동 차단 가능성과 분리해 재검증한다.
- 제외 범위:
  - 외부 차단 생성/삭제/수정
  - Supabase migration apply/push
  - launchd restart/kickstart
  - Vercel production deploy
  - commit/push

## 2. 현재 상태
- 확인한 파일/docs:
  - `PROJECT_STATE.md`
  - `docs/PHASE/2026-06-29_IMS_EXTERNAL_SYNC_SPLIT_BLOCK_POLICY_PM.md`
  - `docs/PHASE/2026-06-29_IMS_EXTERNAL_SYNC_CHILD_MAPPING_SCHEMA_PM.md`
  - `package.json`
  - `vercel.json`
  - sync 관련 scripts/lib/test 파일 목록
- 현재 git 상태:
  - branch: `dev`
  - `dev...origin/dev [ahead 2]`
  - 최근 sync 관련 커밋: `5eb3ca4 Add common sync logger`, `d3dcfe7 Connect sync runners to common logger`
  - 미커밋 변경 다수 존재
  - staged 변경 없음
- 기존 구현/문서 상태:
  - split block 정책 로컬 구현과 테스트는 통과 기록이 있다.
  - no-write smoke 경로가 로컬 코드에 추가되어 있다.
  - coverage smoke는 WARN이며, IMS `4320448` 구간이 찜카/카모아 missing으로 기록되어 있다.
  - 단, 이 missing은 라이브 수동 차단 여부를 DB/외부 read-only로 재확인해야 한다.
- 라이브 코드/DB 상태 판단:
  - 로컬 미커밋 변경은 라이브 반영 상태가 아니다.
  - `origin/dev`에도 현재 미커밋 변경은 올라가 있지 않다.
  - Vercel 프로젝트 연결 정보는 있으나, 현재 production 배포 commit은 별도 확인 필요다.
  - 문서상 Supabase migration apply/push는 미실행이다.
  - 직접 라이브 DB SELECT는 아직 하지 않았다.
- 확인 필요:
  - 실제 production 배포 commit
  - launchd가 어떤 파일 경로/commit의 runner를 실행 중인지
  - 라이브 DB에 sync_events / child mapping migration이 적용됐는지 read-only 확인
  - IMS `4320448` 구간이 외부 플랫폼에서 수동 차단으로 막혀 있는지 read-only 확인

## 3. 전체 변경 요약
- 변경점:
  - save-run 없이 read-only 판정 정확도를 높이는 코드/검증 경로만 정리한다.
  - 외부 기존 수동 차단은 unmanaged wall로 인정하고 자동 흡수/삭제하지 않는다.
  - missing 판정은 `진짜 미차단`, `수동 차단으로 커버`, `확인 불가`로 분리한다.
- 변경대상 후보:
  - `scripts/sync-coverage/*`
  - `scripts/zzimcar-sync/*`
  - `scripts/carmore-sync/*`
  - 관련 테스트
  - `PROJECT_STATE.md`
- 예상 영향:
  - 외부 판매처 상태를 바꾸지 않고 판정/리포트만 더 보수적으로 만든다.
- 주요 리스크:
  - launchd runner가 로컬 작업트리 코드를 직접 사용 중이면, 미커밋 코드와 운영 실행 코드 경계가 불명확하다.
  - 라이브 DB schema 미적용 상태에서 child mapping save-run을 실행하면 mapping 추적이 깨질 수 있다.
  - 수동 차단을 자동 차단으로 오인하면 중복 차단 생성 위험이 있다.

## 4. Phase 목록

### Phase 1. 현재 live/code/db 기준점 read-only 고정
- 목적: 무엇이 라이브에 반영됐고 무엇이 로컬에만 있는지 분리한다.
- 변경점: 없음. 조회/조사만 한다.
- 변경대상: 없음.
- 실행방법:
  - git diff/status 확인
  - Vercel production deployment commit 확인
  - launchd service가 참조하는 runner 경로 확인
  - Supabase schema는 read-only metadata/SELECT로 migration 적용 여부만 확인
- 종료조건:
  - live code, local dirty code, live DB schema 상태가 표로 정리된다.
- 검증방법:
  - 명령 출력/조회 결과 첨부
- 리스크:
  - protected target 또는 secret이 필요하면 중단한다.
- 되돌릴 방법:
  - 읽기 전용이므로 되돌릴 변경 없음.
- 출력보고:
  - 라이브 반영됨 / 로컬만 있음 / 확인 필요 구분표

### Phase 2. code-only 판정 보정
- 목적: `mapping 없음 = 외부 미차단` 단정을 제거하고, 수동 차단 가능성을 별도 상태로 리포트한다.
- 변경점:
  - coverage verifier와 provider reconcile summary에서 unmanaged wall / manual coverage / missing을 분리한다.
  - save-run 경로는 건드리지 않거나 기본 잠금 상태를 유지한다.
- 변경대상 후보:
  - `scripts/sync-coverage/verify-external-block-coverage.js`
  - `scripts/sync-coverage/build-ims-required-coverage.js`
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - `scripts/carmore-sync/lib/reconcile-carmore-holidays.js`
  - 관련 테스트
- 실행방법:
  - 코드 수정
  - 단위 테스트 추가/수정
  - no-write smoke 테스트
- 종료조건:
  - save-run 없이 리포트 상태가 PASS/WARN/FAIL/UNKNOWN으로 분리된다.
- 검증방법:
  - `node --test ...`
  - `npm run build`
  - no-write smoke에서 DB/external write 미호출 확인
- 리스크:
  - 기존 save-run 로직과 리포트 로직이 섞여 있으면 범위 초과 가능. 발견 시 중단한다.
- 되돌릴 방법:
  - git diff 기준 코드 revert
- 출력보고:
  - 변경 파일, 테스트 결과, 남은 UNKNOWN 목록

### Phase 3. read-only smoke 재실행
- 목적: 실제 운영 데이터 기준으로 IMS `4320448` 구간을 다시 판정한다.
- 변경점: 없음. 실행은 read-only/no-write만 허용.
- 변경대상: 없음.
- 실행방법:
  - IMS 조회
  - 찜카 current disable_time 조회
  - 카모아 current holiday 조회
  - mapping DB SELECT
  - coverage verifier 실행
- 종료조건:
  - `4320448` 구간이 `진짜 미차단`, `수동 차단 커버`, `확인 불가` 중 하나로 분리된다.
- 검증방법:
  - no-write smoke report
  - DB/external write 미발생 근거
- 리스크:
  - 인증/권한 문제로 조회 실패 가능
- 되돌릴 방법:
  - 읽기 전용이므로 되돌릴 변경 없음.
- 출력보고:
  - provider별 PASS/WARN/FAIL/UNKNOWN와 근거

### Phase 4. code-only 배포 가능성 판단
- 목적: save-run 없이 코드만 라이브에 올릴 수 있는지 판단한다.
- 변경점: 판단/계획만. 배포는 별도 승인 전 금지.
- 변경대상: 없음.
- 실행방법:
  - 변경 파일이 Vercel/API에 영향 있는지, launchd runner에만 영향 있는지 분리
  - migration 없이 배포 가능한 코드인지 확인
  - feature flag 또는 save default off 확인
- 종료조건:
  - 배포 가능 / 배포 보류 / launchd 별도 반영 필요 중 하나로 판정
- 검증방법:
  - build/test 결과
  - no-write smoke 결과
- 리스크:
  - launchd runner가 자동 실행 중이면 코드 반영 시 즉시 운영 동작에 영향 가능
- 되돌릴 방법:
  - 배포 전이면 변경 없음. 배포 후는 이전 deployment rollback 별도 승인 필요.
- 출력보고:
  - 추천 적용 방식과 승인 필요 항목

### Final Phase. 검수·완료판정·상태/정책문서 정리·문서 COMPLETE 변경·커밋
- 목적: 승인된 범위가 모두 끝났는지 검수하고 문서/커밋 기준을 정리한다.
- 변경점:
  - 전체 변경 검수
  - 완료판정
  - 상태변경/정책변경 여부 판단
  - `PROJECT_STATE.md`, project docs, 정책/운영 문서 업데이트
  - PM 문서를 완료 위치로 이동 또는 이름 변경
  - 파일명에 `COMPLETE_YYYYMMDD` 반영
  - 최종 커밋
- 변경대상:
  - 관련 코드/테스트
  - `PROJECT_STATE.md`
  - 이 PM 문서
- 실행방법:
  - 별도 Reviewer 검수 또는 분리 검수
  - 테스트/build/no-write smoke 결과 확인
  - 문서 정리
  - 사용자 승인 시 commit
- 종료조건:
  - save-run/DB migration/deploy 없이 code-only 안전 상태가 문서화된다.
- 검증방법:
  - 테스트/build/smoke evidence
  - git diff review
- 리스크:
  - 운영 DB/외부 플랫폼 미확인 항목은 COMPLETE가 아니라 HOLD로 남긴다.
- 되돌릴 방법:
  - commit 전: git diff revert
  - commit 후: revert commit
- 출력보고:
  - 변경 파일, 검증 결과, 완료 문서 경로, 커밋 여부, 남은 리스크

## 5. 승인 및 중단 조건
- 승인 요청:
  - 먼저 Phase 1만 승인받아 live/code/db 기준점을 read-only로 고정한다.
  - Phase 2 코드 수정은 Phase 1 보고 후 별도 승인받는다.
- 중단 조건:
  - live DB write 필요 발견
  - 외부 create/update/delete 필요 발견
  - launchd/restart 필요 발견
  - protected target 수정 필요 발견
  - 현재 dirty work와 새 수정 범위 충돌
- protected target 별도 승인 필요 여부:
  - `.env*`, secret, token, credential 수정 금지
  - Supabase migration apply/push 별도 승인 필요
  - Vercel deploy 별도 승인 필요
  - launchd restart/kickstart 별도 승인 필요
  - 외부 save-run/write 별도 승인 필요

## 6. 완료 보고 형식
- 완료 phase:
- 변경 파일:
- 검증 결과:
- 완료 문서 경로:
- 상태/정책문서 업데이트:
- 커밋:
- 남은 리스크:
