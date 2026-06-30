# IMS External Sync PR / Push / Deploy Readiness PM

## 0. 문서 정보
- 작성일: 2026-06-30
- 작성자/agent: OpenClaw / rentcar00_reservation_developer
- 상태: Draft
- 승인 범위: IMS external sync 관련 완료 커밋을 PR/merge/deploy 가능한 상태로 검수하고, PR 생성/업데이트, production deploy 준비, post-deploy smoke 계획까지 확정한다. 이 문서는 실행 승인이 아니며, PR 생성/merge, deploy, launchd restart, 외부 save-run/write, DB write/apply는 별도 승인 전 금지한다.
- 관련 문서:
  - `PROJECT_STATE.md`
  - `docs/COMPLETED/2026-06-30_IMS_4320448_EXISTING_BLOCK_MAPPING_ABSORB_PM_COMPLETE_20260630.md`
  - `docs/COMPLETED/2026-06-30_IMS_EXTERNAL_SYNC_REMAINING_LIVE_APPLY_PM_COMPLETE_20260630.md`
  - `docs/COMPLETED/2026-06-30_CARMORE_FILTERED_SAVE_RUN_SAFETY_FIX_PM_COMPLETE_20260630.md`
- 완료 후 문서명: `docs/COMPLETED/2026-06-30_IMS_EXTERNAL_SYNC_PR_DEPLOY_READINESS_PM_COMPLETE_20260630.md`
- 상태/정책문서 업데이트 대상:
  - `PROJECT_STATE.md`
  - 필요 시 sync 운영 문서

## 1. 목적
- 목표: 현재 `dev`에 완료된 IMS external sync / recovery / filtered save-run guard 변경을 GitHub PR과 production deploy까지 안전하게 넘길 준비를 한다.
- 성공 기준:
  - `dev`와 `origin/dev`가 일치하고 작업트리가 clean이다.
  - open PR 상태와 base branch(`master`) 기준 diff가 확인된다.
  - PR 생성 또는 기존 PR 업데이트 방향이 확정된다.
  - production deploy 전 검증 목록이 통과한다.
  - deploy 후 확인할 smoke 범위가 정해진다.
  - DB/external/save-run/launchd와 Vercel deploy의 책임 범위가 분리된다.
- 제외 범위:
  - 승인 없는 PR 생성/merge/close
  - 승인 없는 Vercel production deploy/rollback
  - 승인 없는 launchd restart/kickstart
  - 승인 없는 외부 카모아/찜카 save-run/write
  - 승인 없는 Supabase DB migration/apply/write
  - `.env*`, secret, credential 수정

## 2. 현재 상태
- 확인한 파일/docs:
  - `PROJECT_STATE.md`
  - 완료 PM 3건
  - `package.json`
  - `vercel.json`
  - GitHub PR 상태
- 현재 git 상태:
  - branch: `dev`
  - `dev...origin/dev`
  - 작업트리 clean
  - 최신 커밋: `37127ff Guard Carmore filtered save runs`
  - 직전 주요 커밋:
    - `cedb6a3 Complete IMS live apply recovery`
    - `e856a61 Add IMS external sync live apply plan`
    - `3ae8278 Complete IMS external sync mapping absorb`
    - `d3dcfe7 Connect sync runners to common logger`
    - `5eb3ca4 Add common sync logger`
- GitHub 상태:
  - 현재 open PR 없음.
  - 로컬 branch: `dev`, `master`.
  - remote branch: `origin/dev`, `origin/master`.
- 기존 구현/문서 상태:
  - 라이브 DB migration 적용 완료.
  - 카모아 복구 완료.
  - 카모아 filtered save-run guard 완료.
  - `origin/dev` push 완료.
  - Vercel production deploy는 아직 미실행.
  - launchd restart/kickstart는 미실행.
- 확인 필요:
  - PR base를 `master`로 할지 최종 확인.
  - Vercel 자동 preview/deploy 연결 여부.
  - production deploy를 PR merge 후 Vercel Git integration으로 할지, CLI/manual deploy로 할지.
  - deploy 후 admin sync UI/API smoke 범위.

## 3. 전체 변경 요약
- 변경점:
  - `dev`의 완료 커밋 묶음을 `master` 반영 후보로 검수한다.
  - PR을 생성/업데이트할 준비를 한다.
  - production deploy 전후 smoke를 정의한다.
- 변경대상:
  - GitHub PR: `dev -> master`
  - 필요 시 GitHub merge commit
  - 필요 시 Vercel production deployment
  - 문서: `PROJECT_STATE.md`, 이 PM 문서
- 예상 영향:
  - production 홈페이지/API/admin에 sync logger/admin event 관련 변경이 반영될 수 있다.
  - sync runner 코드는 launchd가 로컬 repo를 참조하므로 Vercel deploy와 별도다.
  - DB schema는 이미 live 반영되어 있으므로 deploy는 schema 적용 작업이 아니다.
- 주요 리스크:
  - PR diff에 IMS sync 외 이전 dev 누적 변경이 포함될 수 있다.
  - production deploy는 홈페이지/API 전체에 영향 가능.
  - Vercel deploy가 sync runner launchd 반영과 같다고 오판하면 운영 판단이 꼬일 수 있다.
  - PR merge 후 자동 production deploy가 켜져 있으면 merge 자체가 배포 트리거가 될 수 있다.

## 4. Phase 목록

### Phase 1. PR 기준점/범위 검수
- 목적: `dev -> master` PR에 포함될 diff와 커밋 범위를 고정한다.
- 변경점: 없음. read-only 검수.
- 변경대상: 없음.
- 실행방법:
  - `git fetch origin`
  - `git status -sb`
  - `git log --oneline origin/master..origin/dev`
  - `git diff --stat origin/master...origin/dev`
  - open PR 재확인
- 종료조건:
  - PR 대상 commit 범위와 파일 범위가 확인된다.
- 검증방법:
  - GitHub open PR 없음/있음 확인
  - diff stat 확인
- 리스크:
  - IMS 외 dev 누적 변경이 함께 PR에 포함될 수 있다.
- 되돌릴 방법:
  - read-only라 없음.
- 출력보고:
  - base/head, 커밋 수, 핵심 파일 범위, PR 생성 가능/보류 판정.

### Phase 2. 배포 전 검증 gate
- 목적: PR/merge/deploy 전 현재 dev가 안전한지 재검증한다.
- 변경점: 없음. 검증만 실행.
- 변경대상: 없음.
- 실행방법:
  - `git diff --check`
  - `node --test scripts/carmore-sync/__tests__/reconcile-carmore-holidays.test.js`
  - `node --test scripts/zzimcar-sync/__tests__/reconcile-zzimcar-disable-times.test.js`
  - `npm run build`
  - 카모아 no-write smoke
  - 찜카 no-write smoke
- 종료조건:
  - 테스트/build/no-write smoke 모두 PASS.
- 검증방법:
  - 카모아 no-write: additions/deletions/changes/errors 0.
  - 찜카 no-write: additions/deletions/replacements/errors 0.
- 리스크:
  - live no-write smoke는 외부 API read 상태에 영향을 받는다.
- 되돌릴 방법:
  - 변경 없음.
- 출력보고:
  - 검증 결과와 deploy 가능/보류 판정.

### Phase 3. PR 생성 또는 업데이트
- 목적: GitHub에 `dev -> master` PR을 생성하거나 기존 PR을 업데이트한다.
- 변경점:
  - GitHub PR 생성/본문 작성 가능.
- 변경대상:
  - GitHub PR
- 실행방법:
  - PR 제목 예: `Complete IMS external sync live apply and safety guard`
  - 본문에 포함:
    - DB migration 적용 완료 사실
    - 카모아 복구 완료 사실
    - filtered save-run guard 완료 사실
    - 검증 결과
    - deploy/launchd/save-run 미실행 범위
- 종료조건:
  - PR URL 확보.
- 검증방법:
  - `gh pr view`
  - PR diff 확인
- 리스크:
  - PR 생성 자체는 외부 상태 변경이다.
  - base/head 오류 가능.
- 되돌릴 방법:
  - PR close 또는 수정.
- 출력보고:
  - PR 번호/URL, base/head, 본문 요약.

### Phase 4. PR review / merge 판단
- 목적: PR을 바로 merge할지, 리뷰/CI 확인 후 merge할지 결정한다.
- 변경점:
  - 승인 시 PR merge 가능.
- 변경대상:
  - `master`
  - GitHub PR 상태
- 실행방법:
  - PR checks 확인.
  - diff 재검토.
  - merge method 결정: merge commit / squash / rebase 중 repo 기준 확인.
  - 승인 후 merge.
- 종료조건:
  - `origin/master`가 PR 변경을 포함하거나, merge 보류 사유가 문서화된다.
- 검증방법:
  - `git fetch origin`
  - `git log origin/master -1`
  - PR merged 상태 확인
- 리스크:
  - merge가 자동 production deploy를 트리거할 수 있다.
  - master에 누적 변경이 한 번에 반영된다.
- 되돌릴 방법:
  - revert PR merge commit.
- 출력보고:
  - merge 여부, merge commit, 자동 deploy 트리거 여부.

### Phase 5. Vercel production deploy 준비/실행 판단
- 목적: production deploy가 필요한지 확인하고, 승인 시 실행한다.
- 변경점:
  - 승인 시 Vercel production deployment 가능.
- 변경대상:
  - Vercel production
  - 홈페이지/API/admin runtime
- 실행방법:
  - Vercel project/link 확인.
  - Git integration 자동 배포 여부 확인.
  - 이미 merge로 production deploy가 시작됐는지 확인.
  - 수동 deploy가 필요하면 별도 승인 후 실행.
- 종료조건:
  - production deploy URL과 commit hash 확인 또는 deploy 보류 사유 확정.
- 검증방법:
  - Vercel deployment inspect/status.
  - production URL smoke.
- 리스크:
  - production 홈페이지/API 영향.
  - env/runtime config 문제.
  - deploy 실패/partial rollback 필요.
- 되돌릴 방법:
  - Vercel previous deployment rollback.
- 출력보고:
  - deploy 실행 여부, URL, commit, rollback 후보.

### Phase 6. post-deploy smoke
- 목적: production 반영 후 운영 영향이 없는지 확인한다.
- 변경점: 없음. read-only smoke.
- 변경대상: 없음.
- 실행방법:
  - 홈페이지 기본 페이지 HTTP 확인.
  - admin sync event/API 관련 read-only 확인 가능 시 확인.
  - 카모아/찜카 no-write smoke 재확인.
  - filtered save-run guard는 CLI direct check로 확인. 외부 save-run은 실행하지 않는다.
- 종료조건:
  - production smoke와 sync no-write가 PASS.
- 검증방법:
  - HTTP status / build artifact / no-write summary.
- 리스크:
  - admin UI는 인증/SSO 때문에 assistant가 직접 확인 못 할 수 있다.
- 되돌릴 방법:
  - smoke 실패 시 Vercel rollback 또는 follow-up fix PM.
- 출력보고:
  - production smoke 결과, 남은 사용자 확인 필요.

### Final Phase. 검수·완료판정·상태/정책문서 정리·문서 COMPLETE 변경·커밋
- 목적: PR/merge/deploy 준비 또는 실행 결과를 완료 처리한다.
- 변경점:
  - 전체 변경 검수
  - 완료판정
  - `PROJECT_STATE.md` 업데이트
  - PM 문서를 COMPLETED로 이동
  - 파일명에 `COMPLETE_20260630` 반영
  - 필요 시 최종 문서 커밋/push
- 변경대상:
  - `PROJECT_STATE.md`
  - 이 PM 문서
- 실행방법:
  - PR/deploy/smoke evidence 정리.
  - 완료 문서 이동.
  - 문서 커밋 및 push.
- 종료조건:
  - 실제 PR/merge/deploy 상태와 문서가 일치한다.
- 검증방법:
  - git status clean.
  - PR/deploy URL 확인.
- 리스크:
  - deploy를 보류했는데 COMPLETE로 오기재하면 운영 상태 혼동 가능.
- 되돌릴 방법:
  - 문서 commit revert.
- 출력보고:
  - 완료 phase, PR, merge, deploy, smoke, 커밋, 남은 리스크.

## 5. 승인 및 중단 조건
- 승인 요청:
  - Phase 1~2는 read-only 검수/검증.
  - Phase 3 PR 생성은 GitHub write라 별도 승인 필요.
  - Phase 4 merge는 master 변경 및 자동 deploy 가능성이 있어 별도 승인 필요.
  - Phase 5 Vercel production deploy/rollback은 별도 승인 필요.
  - Phase 6 smoke는 read-only/no-write만 허용.
- 중단 조건:
  - `origin/master...origin/dev` diff가 예상보다 넓거나 IMS 외 위험 변경 포함.
  - tests/build/no-write smoke 실패.
  - PR base/head 불명확.
  - merge가 자동 production deploy를 유발하는데 승인 범위가 불명확.
  - Vercel env/runtime 문제.
  - launchd restart나 외부 save-run이 필요해지는 경우.
  - protected target 수정 필요 발생.
- protected target 별도 승인 필요 여부:
  - `.env*`, secret, credential 수정 금지.
  - DB write/apply 금지.
  - 외부 save-run/write 금지.
  - deploy/restart는 별도 승인.

## 6. 완료 보고 형식
- 완료 phase:
- PR:
- Merge:
- Deploy:
- Smoke:
- 변경 파일:
- 완료 문서 경로:
- 상태/정책문서 업데이트:
- 커밋:
- 남은 리스크:


## 7. 진행 중 결정 로그
- 2026-06-30 11:16 KST: Phase 2 no-write smoke 중 live 예약 데이터 변화로 카모아 후보가 `4321373 addition`에서 `4308172 change`로 바뀌는 것을 확인했다.
- 사용자 지시: 라이브에서 계속 추가/변경되는 것이므로 no-write 0건 고정 때문에 PR/배포를 멈추지 말고, 코드 push/PR/배포를 끝내 정상화한다.
- 적용 판단: no-write drift는 운영 데이터 변화로 기록한다. 외부 save-run/write는 계속 금지하고, PR/merge/deploy 정상화만 진행한다.
