# IMS External Sync Remaining Live Apply PM

## 0. 문서 정보
- 작성일: 2026-06-30
- 작성자/agent: OpenClaw / rentcar00_reservation_developer
- 상태: Draft
- 승인 범위: 남은 전체 적용 준비 계획. 이 문서는 실행 승인이 아니며, phase별 승인 전 DB migration/apply, deploy, launchd, save-run은 금지한다.
- 관련 문서:
  - `PROJECT_STATE.md`
  - `docs/COMPLETED/2026-06-30_IMS_4320448_EXISTING_BLOCK_MAPPING_ABSORB_PM_COMPLETE_20260630.md`
  - `docs/PHASE/2026-06-29_IMS_EXTERNAL_SYNC_CHILD_MAPPING_SCHEMA_PM.md`
  - `docs/PHASE/2026-06-29_IMS_EXTERNAL_SYNC_SPLIT_BLOCK_POLICY_PM.md`
  - `docs/PHASE/2026-06-30_IMS_EXTERNAL_SYNC_SAFE_LIVE_CODE_ONLY_PM.md`
- 완료 후 문서명: `docs/COMPLETED/2026-06-30_IMS_EXTERNAL_SYNC_REMAINING_LIVE_APPLY_PM_COMPLETE_YYYYMMDD.md`
- 상태/정책문서 업데이트 대상:
  - `PROJECT_STATE.md`
  - 필요 시 sync 운영 문서

## 1. 목적
- 목표: IMS external sync의 남은 작업을 안전하게 라이브 적용 가능한 순서로 정리한다.
- 성공 기준:
  - 로컬 `dev`의 완료 커밋이 원격 기준에 정리된다.
  - 라이브 DB schema가 child mapping과 sync event 기록을 지원한다.
  - no-write smoke에서 save-run 전 위험 목록이 분리된다.
  - save-run은 migration/schema/no-write gate 통과 후에만 제한적으로 실행 가능하다.
  - 외부 수동 차단을 삭제하거나 중복 생성하지 않는다.
- 제외 범위:
  - 승인 없는 push/deploy/restart/launchd 변경
  - 승인 없는 Supabase migration apply/push
  - 승인 없는 외부 save-run/write
  - `.env*`, secret, token, credential 수정

## 2. 현재 상태
- 확인한 파일/docs:
  - `PROJECT_STATE.md`
  - completed PM: `2026-06-30_IMS_4320448_EXISTING_BLOCK_MAPPING_ABSORB_PM_COMPLETE_20260630.md`
  - phase PMs: split block, child mapping schema, safe live code-only
- 현재 git 상태:
  - branch: `dev`
  - `dev...origin/dev [ahead 3]`
  - 작업트리 clean
  - 최신 커밋: `3ae8278 Complete IMS external sync mapping absorb`
- 기존 구현/문서 상태:
  - no-write smoke 경로 있음
  - split block / unmanaged wall / coverage verifier 구현 있음
  - child key migration 파일 있음
  - sync_events migration 파일 있음
  - IMS `4320448` 기존 외부 차단은 DB mapping으로 흡수 완료
- 라이브 상태:
  - 라이브 DB에는 기존 mapping table이 운영 중
  - child key migration은 아직 라이브 DB 미적용
  - sync_events migration은 아직 라이브 DB 미적용
  - Vercel production은 6/28 배포본 기준
  - launchd는 로컬 repo의 sync runner 경로를 직접 참조한다
- 확인 필요:
  - 원격 push/PR/merge 전략
  - production deploy target
  - migration apply 방식
  - save-run 대상 provider와 범위

## 3. 전체 변경 요약
- 변경점:
  - 남은 적용을 `source control -> schema -> no-write smoke -> controlled save-run -> deploy/operation docs` 순서로 고정한다.
- 변경대상:
  - GitHub `origin/dev` / 필요 시 PR 또는 master merge
  - Supabase migrations
  - Vercel deployment
  - launchd runner 운영 상태 확인
  - sync 운영 문서/PROJECT_STATE
- 예상 영향:
  - sync runner와 admin logging/reporting이 최신 코드 기준으로 동작한다.
  - DB mapping은 IMS 1건 -> 여러 child block/holiday 구조를 준비한다.
- 주요 리스크:
  - migration 전에 save-run을 실행하면 child mapping 추적이 깨질 수 있다.
  - no-write 결과의 addition/deletion을 검토하지 않고 save-run하면 외부 차단을 중복 생성/삭제할 수 있다.
  - launchd가 로컬 repo를 직접 보기 때문에 로컬 코드 변경이 운영 runner에 바로 영향을 줄 수 있다.

## 4. Phase 목록

### Phase 1. 원격 기준점 정리
- 목적: 현재 로컬 완료 커밋을 원격 기준으로 안전하게 정리한다.
- 변경점:
  - 필요 시 `origin/dev` push
  - 필요 시 PR/merge 기준 확정
- 변경대상:
  - Git remote `origin/dev`
- 실행방법:
  - `git status`, `git log`, `git diff origin/dev...HEAD` 확인
  - push 전 커밋 범위 확인
  - 승인 후 push
- 종료조건:
  - 원격 `origin/dev`가 로컬 완료 커밋을 포함한다.
- 검증방법:
  - `git status -sb`
  - `git log origin/dev -1`
- 리스크:
  - 원격 브랜치에 의도치 않은 커밋 포함 가능
- 되돌릴 방법:
  - push 전 중단
  - push 후에는 revert commit 또는 force 금지 기준 별도 판단
- 출력보고:
  - push 여부, commit hash, 원격 상태

### Phase 2. DB migration 적용 준비 검수
- 목적: migration을 apply하기 전에 SQL 안전성을 재검수한다.
- 변경점: 없음. 검수/준비만 한다.
- 변경대상:
  - `supabase/migrations/20260629090500_create_sync_events.sql`
  - `supabase/migrations/20260629102000_update_external_sync_child_mapping_keys.sql`
- 실행방법:
  - 현재 라이브 schema read-only 확인
  - migration SQL 순서 확인
  - 기존 unique index 유지/child unique 추가 확인
  - rollback/보류 기준 작성
- 종료조건:
  - migration apply 가능/보류 판정이 나온다.
- 검증방법:
  - read-only metadata/SELECT
  - SQL 직접 inspection
- 리스크:
  - 기존 unique index와 child unique index 병존 시 code path 충돌 가능
- 되돌릴 방법:
  - apply 전이면 변경 없음
- 출력보고:
  - migration별 apply 여부, 보류 조건, rollback 후보

### Phase 3. DB migration apply
- 목적: 라이브 DB가 sync_events와 child mapping key를 지원하게 한다.
- 변경점:
  - `sync_events` table 생성
  - 찜카 `child_block_key` 추가/backfill/not null/new unique index
  - 카모아 `child_holiday_key` 추가/backfill/not null/new unique index
  - 기존 `ims_reservation_id` 단일 unique index는 이 phase에서 drop하지 않는다.
- 변경대상:
  - Supabase live DB schema
- 실행방법:
  - Phase 2 통과 후 별도 승인으로 migration apply
  - apply 직후 schema cache/column/index 확인
- 종료조건:
  - child key columns와 sync_events table이 read-only SELECT로 확인된다.
- 검증방법:
  - DB metadata/SELECT
  - no-write smoke 준비 확인
- 리스크:
  - migration apply 실패 시 schema partial 적용 가능
- 되돌릴 방법:
  - 실패 위치 확인 후 별도 rollback SQL 또는 보수적 중단
- 출력보고:
  - 적용 migration, 확인 column/index/table, 실패 여부

### Phase 4. post-migration no-write smoke
- 목적: migration 이후 실제 save-run 전 위험 대상을 분리한다.
- 변경점: 없음. no-write/read-only 실행만 한다.
- 변경대상: 없음
- 실행방법:
  - IMS no-write smoke
  - 찜카 no-write smoke
  - 카모아 no-write smoke
  - coverage verifier
- 종료조건:
  - provider별 additions/deletions/replacements/unchanged/errors 집계가 나온다.
  - 수동/기존 차단은 unmanaged/manual covered WARN 또는 managed로 분리된다.
- 검증방법:
  - no-write smoke output
  - DB write/external write 미발생 확인
- 리스크:
  - additions/deletions가 예상보다 크면 save-run 금지
- 되돌릴 방법:
  - 읽기 전용이라 없음
- 출력보고:
  - save-run 가능/보류/부분 가능 판정

### Phase 5. controlled save-run canary
- 목적: 전체 save-run 전에 가장 좁은 범위로 실제 write 경로를 검증한다.
- 변경점:
  - 외부 provider write 가능
  - mapping write 가능
- 변경대상:
  - 찜카/카모아 외부 차단
  - mapping DB
- 실행방법:
  - Phase 4에서 안전하다고 판정된 범위만 선택
  - 가능하면 provider별 1건 canary 또는 명시 필터 범위로 실행
  - 실행 후 즉시 read-only 검증
- 종료조건:
  - 외부 차단 생성/삭제/수정과 DB mapping이 일치한다.
  - rollback 필요 없음 또는 rollback 완료
- 검증방법:
  - provider read-only 조회
  - DB SELECT
  - coverage verifier
- 리스크:
  - 외부 write 실패/부분 성공
  - 잘못된 deletion
- 되돌릴 방법:
  - 실행 전 산출한 rollback/manual recovery 절차
- 출력보고:
  - 실제 적용 건수, 실패 건수, rollback 필요 여부

### Phase 6. provider별 full save-run 판단 및 실행
- 목적: canary 후 전체 또는 provider별 save-run을 결정한다.
- 변경점:
  - 승인된 provider/range에 한해 save-run 실행
- 변경대상:
  - 찜카/카모아 외부 차단
  - mapping DB
  - sync_events
- 실행방법:
  - Phase 5 성공 후 provider별 실행
  - additions/deletions/replacements 목록 사전 검토
  - 실행 후 즉시 read-only smoke
- 종료조건:
  - errors 0 또는 실패 건이 분리되어 manual recovery 상태가 된다.
- 검증방법:
  - sync summary
  - DB SELECT
  - external read-only
  - coverage verifier
- 리스크:
  - 외부 플랫폼 제한/중복/삭제 실패
- 되돌릴 방법:
  - 실패 건별 manual recovery log와 rollback 절차
- 출력보고:
  - provider별 최종 동기화 상태

### Phase 7. Vercel/admin live deploy 판단
- 목적: sync logger/admin UI/API 변경을 production에 반영할지 결정한다.
- 변경점:
  - 필요 시 production deploy
- 변경대상:
  - Vercel production deployment
- 실행방법:
  - build 통과 확인
  - preview 확인 필요 시 preview 먼저 확인
  - production deploy는 별도 승인 후 실행
- 종료조건:
  - admin UI/API가 sync_events와 sync 상태를 표시한다.
- 검증방법:
  - build
  - deployment inspect
  - admin API/UI smoke
- 리스크:
  - 홈페이지/API production 영향
- 되돌릴 방법:
  - Vercel previous deployment rollback
- 출력보고:
  - 배포 URL, commit, smoke 결과

### Final Phase. 검수·완료판정·상태/정책문서 정리·문서 COMPLETE 변경·커밋
- 목적: 남은 전체 적용을 완료 처리한다.
- 변경점:
  - 전체 변경 검수
  - 완료판정
  - `PROJECT_STATE.md`, 관련 PM 문서 업데이트
  - PM 문서를 COMPLETED로 이동/이름 변경
  - 최종 커밋
- 변경대상:
  - `PROJECT_STATE.md`
  - 이 PM 문서
  - 필요 시 sync 운영 문서
- 실행방법:
  - 모든 phase evidence 확인
  - 문서 COMPLETE 처리
  - 커밋/푸시 여부 정리
- 종료조건:
  - migration/save-run/deploy 상태가 문서와 실제 상태에서 일치한다.
- 검증방법:
  - git status
  - DB/external/deploy smoke evidence
- 리스크:
  - 일부 provider만 완료된 경우 전체 COMPLETE 불가
- 되돌릴 방법:
  - 코드 revert, DB rollback/manual recovery, Vercel rollback 중 해당 영역별 적용
- 출력보고:
  - 완료 phase, 검증 결과, 커밋, 남은 리스크

## 5. 승인 및 중단 조건
- 중단 조건:
  - no-write smoke에서 예상 밖 deletion/replacement 다수 발견
  - migration apply 실패 또는 partial state
  - 외부 write 실패/부분 성공
  - secret/protected target 수정 필요
  - launchd/restart 필요가 새로 발생
  - 기존 수동 차단 삭제 위험 발생
- 별도 승인 필요:
  - push
  - Supabase migration apply/push
  - 외부 save-run/write
  - Vercel deploy/rollback
  - launchd restart/kickstart
  - `.env*` 또는 credential 수정

## 6. 현재 추천 순서
1. Phase 1: origin/dev 정리
2. Phase 2: migration SQL 재검수
3. Phase 3: DB migration apply
4. Phase 4: post-migration no-write smoke
5. Phase 5: controlled canary save-run
6. Phase 6: provider별 full save-run 판단
7. Phase 7: Vercel/admin deploy 판단
8. Final: 문서 COMPLETE와 커밋
