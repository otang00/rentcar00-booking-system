# Carmore Filtered Save-Run Safety Fix PM

## 0. 문서 정보
- 작성일: 2026-06-30
- 작성자/agent: OpenClaw / rentcar00_reservation_developer
- 상태: Complete
- 승인 범위: 카모아 filtered save-run 재발 방지 코드 수정, 테스트, no-write 검증, 문서 COMPLETE, 커밋. 이 문서는 실행 승인이 아니며, 외부 API write/save-run, DB write/apply, deploy, launchd restart는 별도 승인 전 금지한다.
- 관련 문서:
  - `PROJECT_STATE.md`
  - `docs/COMPLETED/2026-06-30_IMS_EXTERNAL_SYNC_REMAINING_LIVE_APPLY_PM_COMPLETE_20260630.md`
  - `docs/COMPLETED/2026-06-30_IMS_4320448_EXISTING_BLOCK_MAPPING_ABSORB_PM_COMPLETE_20260630.md`
- 완료 후 문서명: `docs/COMPLETED/2026-06-30_CARMORE_FILTERED_SAVE_RUN_SAFETY_FIX_PM_COMPLETE_20260630.md`
- 상태/정책문서 업데이트 대상:
  - `PROJECT_STATE.md`
  - 필요 시 sync 운영 문서

## 1. 목적
- 목표: 카모아 `--imsReservationId` / `CARMORE_SYNC_ONLY_IMS_RESERVATION_ID` 필터 save-run이 desired만 좁히고 actual 전체를 deletion 대상으로 보는 결함을 제거한다.
- 성공 기준:
  - 카모아 filtered save-run 모드에서 전체 actual deletion이 불가능하다.
  - 필터 모드에서는 deletion/change 같은 파괴적 작업이 기본 차단되거나, actual scope가 동일 IMS로 제한된다.
  - 테스트가 동일 사고 재현 케이스를 막는다.
  - 최종 no-write smoke에서 카모아 desired 70 / actual 70 / unchanged 70 / errors 0 상태가 유지된다.
  - 찜카에는 회귀가 없다.
- 제외 범위:
  - 외부 카모아/찜카 save-run 실행
  - Supabase DB migration/apply/write
  - Vercel deploy
  - launchd restart/kickstart
  - `.env*`, secret, credential 수정

## 2. 현재 상태
- 확인한 파일/docs:
  - `PROJECT_STATE.md`
  - `scripts/carmore-sync/run-carmore-reconcile-sync.js`
  - `scripts/carmore-sync/lib/reconcile-carmore-holidays.js`
  - `scripts/carmore-sync/__tests__/reconcile-carmore-holidays.test.js`
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - `docs/COMPLETED/2026-06-30_IMS_EXTERNAL_SYNC_REMAINING_LIVE_APPLY_PM_COMPLETE_20260630.md`
- 현재 git 상태:
  - branch: `dev`
  - `dev...origin/dev`
  - 작업트리 clean 확인 후 이 PM 문서만 추가 대상
  - 최신 커밋: `cedb6a3 Complete IMS live apply recovery`
- 기존 구현/문서 상태:
  - 카모아 runner는 `--imsReservationId` / `--onlyImsReservationId` / `CARMORE_SYNC_ONLY_IMS_RESERVATION_ID` 값을 `reconcileCarmoreHolidays`에 전달한다.
  - `reconcileCarmoreHolidays`는 `onlyImsReservationId`가 있으면 `desiredRows`만 필터링한다.
  - `actualRows = fetchActiveMappings(...)`는 전체 active mapping을 가져온다.
  - 그 결과 filtered save-run에서 필터 밖 actual이 모두 deletion 후보가 될 수 있다.
  - 2026-06-30 사고에서 카모아 holiday 70건 deletion이 실제 발생했고, full recovery save-run과 mapping 재연결로 복구 완료했다.
  - 최종 카모아 no-write: desired 70 / actual 70 / additions 0 / deletions 0 / changes 0 / unchanged 70 / errors 0.
  - 최종 찜카 no-write: desired 70 / actual 69 / unmanagedWall 1 / additions 0 / deletions 0 / replacements 0 / unchanged 69 / errors 0.
- 확인 필요:
  - 카모아 filtered save-run을 완전 금지할지, 안전한 add-only/canary 모드로 제한할지 최종 선택.
  - 운영에서 필터 save-run이 필요한 실제 사용 시나리오.

## 3. 전체 변경 요약
- 변경점:
  - 카모아 filtered save-run guard 추가.
  - `onlyImsReservationId` 또는 `limit`이 있는 좁은 scope에서 deletion/change 실행을 막는다.
  - filtered no-write/dry-run은 진단용으로 유지하되, save-run은 위험 작업을 차단한다.
  - 동일 사고를 재현하는 테스트를 추가한다.
- 변경대상:
  - `scripts/carmore-sync/lib/reconcile-carmore-holidays.js`
  - `scripts/carmore-sync/run-carmore-reconcile-sync.js` 또는 테스트 export 필요 시 최소 변경
  - `scripts/carmore-sync/__tests__/reconcile-carmore-holidays.test.js`
  - `PROJECT_STATE.md`
  - 이 PM 문서
- 예상 영향:
  - 카모아 필터 save-run으로 전체 삭제가 재발하지 않는다.
  - 운영에서 단건 canary가 필요하면 별도 안전 모드 설계 전까지 save-run은 전체 no-write 검토 후 전체 기준으로만 판단한다.
- 주요 리스크:
  - guard가 너무 강하면 기존 단건 운영 도구가 막힐 수 있다.
  - actual scope 제한만으로 해결하면 필터 밖 deletion은 막지만, 같은 IMS의 split child 변경/delete는 여전히 위험할 수 있다.
  - save-run 코드 수정이 실제 외부 write 경로와 연결되어 있어 테스트 없이 반영하면 위험하다.

## 4. Phase 목록

### Phase 1. 사고 재현 테스트 고정
- 목적: filtered save-run에서 desired 1건 + actual 다건일 때 필터 밖 actual deletion이 발생하지 않아야 한다는 회귀 테스트를 먼저 만든다.
- 변경점:
  - 테스트 케이스 추가.
  - `onlyImsReservationId` 또는 필터 scope에서 deletion/change가 차단되는 기대값 고정.
- 변경대상:
  - `scripts/carmore-sync/__tests__/reconcile-carmore-holidays.test.js`
  - 필요 시 `scripts/carmore-sync/lib/reconcile-carmore-holidays.js` export 보강
- 실행방법:
  - 기존 `planReconcile` 단위 테스트에 filtered scope 시나리오 추가 또는 `reconcileCarmoreHolidays` 통합 단위 테스트 추가.
  - 케이스: desired A1만 필터, actual A1/A2/A3 존재, save-run scope에서는 A2/A3 deletion 금지.
- 종료조건:
  - 현재 코드 기준 실패하는 테스트가 사고 원인을 정확히 포착한다.
- 검증방법:
  - `node --test scripts/carmore-sync/__tests__/reconcile-carmore-holidays.test.js`
- 리스크:
  - 테스트가 실제 runner 경로가 아니라 plan 함수만 검증하면 사고 재현력이 부족할 수 있다.
- 되돌릴 방법:
  - 테스트 추가분 revert.
- 출력보고:
  - 실패/통과 여부와 사고 재현 포인트.

### Phase 2. filtered save-run guard 구현
- 목적: 좁은 scope save-run에서 외부 deletion/change가 실행되지 않게 한다.
- 변경점:
  - `onlyImsReservationId` 또는 `limit`이 설정된 상태에서 `shouldSave=true`이고 plan에 deletion/change가 있으면 실행 전 hard fail.
  - 또는 필터 모드 save-run 자체를 차단하고 no-write/dry-run만 허용한다.
  - 권장안: 필터 save-run은 기본 금지. 단건 복구는 별도 add-only 명시 옵션 설계 전까지 금지.
- 변경대상:
  - `scripts/carmore-sync/lib/reconcile-carmore-holidays.js`
  - 필요 시 `scripts/carmore-sync/run-carmore-reconcile-sync.js`
- 실행방법:
  - `isNarrowScope = Boolean(onlyImsReservationId) || Number(limit || 0) > 0` 판단 추가.
  - `shouldSave && isNarrowScope`이면 명확한 에러 메시지로 중단.
  - no-write smoke/dry-run은 허용하여 사전 확인은 가능하게 한다.
- 종료조건:
  - 필터 save-run은 외부 write 전에 실패한다.
  - 전체 save-run 경로는 기존 동작 유지.
- 검증방법:
  - 카모아 단위 테스트.
  - 필터 save-run mock/injected client 테스트에서 delete/create 호출 없음 확인.
- 리스크:
  - 긴급 단건 복구 자동화가 막힌다. 그러나 재삭제 리스크보다 안전하다.
- 되돌릴 방법:
  - guard commit revert.
- 출력보고:
  - 차단 조건, 에러 메시지, 허용되는 모드.

### Phase 3. 찜카 영향 검토 및 필요 시 동일 guard 적용
- 목적: 찜카에 동일한 CLI 필터는 없지만, 좁은 scope/limit save-run 경로가 생기거나 이미 있다면 같은 원칙을 적용한다.
- 변경점:
  - 현재 찜카 runner에는 `onlyImsReservationId` 경로가 없는 것으로 확인됨.
  - 추가 필터가 없다면 코드 변경 없음, 문서/테스트만 영향 없음으로 기록.
- 변경대상:
  - `scripts/zzimcar-sync/run-zzimcar-reconcile-sync.js`
  - `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
  - 필요 시 찜카 테스트
- 실행방법:
  - CLI/env option 재확인.
  - limit/필터성 옵션이 없다면 수정하지 않는다.
- 종료조건:
  - 찜카 동일 리스크 없음 또는 동일 guard 적용 완료.
- 검증방법:
  - `node --test scripts/zzimcar-sync/__tests__/reconcile-zzimcar-disable-times.test.js`
- 리스크:
  - 찜카 쪽에 숨은 필터가 있으면 놓칠 수 있다.
- 되돌릴 방법:
  - 찜카 변경분 revert.
- 출력보고:
  - 찜카 수정 여부와 근거.

### Phase 4. 로컬 검증 및 live no-write smoke
- 목적: 코드 수정 후 실제 운영 데이터 기준으로 외부 write 없이 안전성을 확인한다.
- 변경점: 없음. 검증만 실행.
- 변경대상: 없음.
- 실행방법:
  - targeted tests 실행.
  - 필요 시 `npm run build` 실행.
  - 카모아 no-write smoke 실행.
  - 찜카 no-write smoke 실행.
  - 카모아 filtered no-write는 허용되는지 확인하되 save-run은 실행하지 않는다.
- 종료조건:
  - 카모아 final no-write가 desired 70 / actual 70 / unchanged 70 / errors 0 유지.
  - 찜카 final no-write가 additions/deletions/replacements 0 유지.
  - filtered save-run은 외부 write 전 차단됨.
- 검증방법:
  - `node --test scripts/carmore-sync/__tests__/reconcile-carmore-holidays.test.js`
  - `node --test scripts/zzimcar-sync/__tests__/reconcile-zzimcar-disable-times.test.js`
  - `npm run build`
  - `NO_WRITE_SMOKE=true CARMORE_NO_WRITE_SMOKE=true node scripts/carmore-sync/run-carmore-reconcile-sync.js --no-write-smoke`
  - `NO_WRITE_SMOKE=true ZZIMCAR_NO_WRITE_SMOKE=true node scripts/zzimcar-sync/run-zzimcar-reconcile-sync.js --no-write-smoke`
- 리스크:
  - live no-write smoke가 외부 API read에 의존하므로 일시 장애 가능.
- 되돌릴 방법:
  - 코드 변경 revert.
- 출력보고:
  - 테스트/build/no-write smoke 결과.

### Phase 5. 운영 반영 판단
- 목적: 수정 코드가 라이브 runner와 Vercel 중 어디에 필요한지 판단한다.
- 변경점:
  - 필요 시 `origin/dev` push.
  - launchd runner가 로컬 repo를 직접 참조하므로 로컬 코드 변경만으로 runner 영향 가능성 확인.
  - Vercel deploy는 admin UI/API 필요성이 있을 때만 판단.
- 변경대상:
  - Git `origin/dev`
  - launchd runner는 restart하지 않음. 필요 시 별도 승인.
  - Vercel production은 기본 미실행.
- 실행방법:
  - git diff/status 확인.
  - 커밋 후 push.
  - 운영 runner 반영 방식 확인만 수행.
- 종료조건:
  - 수정 커밋이 remote에 올라가고, 운영 반영 필요/불필요 판단이 문서화된다.
- 검증방법:
  - `git status -sb`
  - `git log origin/dev -1`
- 리스크:
  - launchd가 즉시 로컬 파일을 참조하면 restart 없이도 다음 실행부터 새 코드가 사용될 수 있다.
- 되돌릴 방법:
  - revert commit.
- 출력보고:
  - 커밋 hash, push 여부, deploy/restart 여부.

### Final Phase. 검수·완료판정·상태/정책문서 정리·문서 COMPLETE 변경·커밋
- 목적: 수정 완료 여부를 판정하고 문서/상태를 실제와 맞춘다.
- 변경점:
  - 전체 변경 검수
  - 완료판정
  - 상태변경/정책변경 여부 판단
  - `PROJECT_STATE.md`, project docs, 정책/운영 문서 업데이트
  - PM 문서를 완료 위치로 이동 또는 이름 변경
  - 파일명에 `COMPLETE_20260630` 반영
  - 최종 커밋
- 변경대상:
  - `PROJECT_STATE.md`
  - 이 PM 문서
  - 관련 코드/테스트 파일
- 실행방법:
  - diff 검토.
  - 테스트/build/no-write evidence 확인.
  - 완료 문서 이동.
  - 커밋 및 필요 시 push.
- 종료조건:
  - 필터 save-run 재발 방지 코드가 테스트와 no-write smoke로 확인된다.
  - 완료 문서와 PROJECT_STATE가 최신 상태다.
- 검증방법:
  - git status clean.
  - 최종 커밋 hash 확인.
- 리스크:
  - 문서만 COMPLETE되고 실제 코드가 배포/운영 반영되지 않으면 재발 방지가 불완전하다.
- 되돌릴 방법:
  - commit revert.
- 출력보고:
  - 완료 phase, 변경 파일, 검증 결과, 완료 문서 경로, 커밋, 남은 리스크.

## 5. 승인 및 중단 조건
- 승인 요청:
  - Phase 1~Final 실행 승인 시 코드/테스트/문서 수정과 커밋까지 진행.
  - 외부 save-run/write, DB apply/write, deploy, launchd restart는 이번 PM 승인에 포함하지 않는다.
- 중단 조건:
  - 테스트로 사고 재현이 안 되는 경우.
  - filtered save-run 차단이 전체 save-run 정상 경로를 깨는 경우.
  - no-write smoke에서 카모아 additions/deletions/changes가 다시 발생하는 경우.
  - 찜카 no-write에서 additions/deletions/replacements가 발생하는 경우.
  - protected target 수정 필요 발생.
- protected target 별도 승인 필요 여부:
  - `.env*`, secret, credential 수정 없음.
  - DB migration/apply 없음.
  - 외부 API write/save-run 없음.
  - deploy/restart 없음.

## 6. 완료 보고 형식
- 완료 phase:
- 변경 파일:
- 검증 결과:
- 완료 문서 경로:
- 상태/정책문서 업데이트:
- 커밋:
- 남은 리스크:


## 7. 실행 결과 / 완료 로그
- 완료일: 2026-06-30
- Phase 1 완료: 카모아 회귀 테스트 2건 추가.
  - filtered desired rows가 필터 밖 actual을 deletion으로 계획하는 사고 재현 케이스 고정.
  - `assertCarmoreSaveScopeSafe`가 `onlyImsReservationId`/`limit` save-run을 차단하는 테스트 추가.
- Phase 2 완료: 카모아 filtered save-run guard 구현.
  - `shouldSave=true` + `onlyImsReservationId` 또는 `limit > 0`이면 실행 전 hard fail.
  - guard 위치는 `createRun` 전이라 필터 save-run 차단 시 sync run row와 외부 write가 발생하지 않는다.
  - no-write smoke/dry-run 필터는 진단용으로 허용.
- Phase 3 완료: 찜카 영향 검토.
  - `run-zzimcar-reconcile-sync.js`와 `reconcile-zzimcar-disable-times.js`에서 카모아와 같은 CLI/env IMS 필터 또는 limit save-run 경로 없음 확인.
  - 찜카 코드 변경 없음.
- Phase 4 검증 완료:
  - 카모아 테스트: 17 pass.
  - 찜카 테스트: 24 pass.
  - `npm run build`: pass.
  - 카모아 final no-write: desired 70 / actual 70 / unmanagedWall 0 / additions 0 / deletions 0 / changes 0 / unchanged 70 / errors 0.
  - 찜카 final no-write: desired 70 / actual 69 / unmanagedWall 1 / additions 0 / deletions 0 / replacements 0 / unchanged 69 / errors 0.
  - 카모아 filtered no-write `--imsReservationId 4320591`: no-write 진단은 허용되며 desired 1 / actual 70 / deletions 69 / unchanged 1로 사고 재현 위험이 계속 보인다.
  - direct guard check: filtered save-run과 limit save-run 모두 외부 write 전 차단 확인.
- Phase 5 운영 반영 판단:
  - Vercel deploy 미실행.
  - launchd restart/kickstart 미실행.
  - 수정 코드는 repo 파일 변경이므로 launchd가 다음 실행 때 로컬 repo를 참조하면 guard가 적용된다.
- 최종 판정:
  - COMPLETE.
  - 카모아 filtered save-run 재발 방지 완료.
  - 외부 save-run/write, DB write/apply, deploy, restart 없음.
