# IMS 4320448 Existing External Block Mapping Absorb PM

## 0. 문서 정보
- 작성일: 2026-06-30
- 작성자/agent: OpenClaw / rentcar00_reservation_developer
- 상태: Complete - 2026-06-30
- 승인 범위: 기존 외부 차단을 삭제하지 않고, 라이브 DB mapping으로 흡수하는 B안 계획
- 관련 문서:
  - `PROJECT_STATE.md`
  - `docs/PHASE/2026-06-30_IMS_EXTERNAL_SYNC_SAFE_LIVE_CODE_ONLY_PM.md`
  - `docs/PHASE/2026-06-29_IMS_EXTERNAL_SYNC_CHILD_MAPPING_SCHEMA_PM.md`
- 완료 후 문서명: `docs/COMPLETED/2026-06-30_IMS_4320448_EXISTING_BLOCK_MAPPING_ABSORB_PM_COMPLETE_YYYYMMDD.md`
- 상태/정책문서 업데이트 대상:
  - `PROJECT_STATE.md`
  - 필요 시 sync 운영 문서

## 1. 목적
- 목표: IMS `4320448` / 차량 `142호5773` / `2026-06-30 10:00~2026-07-03 10:00 KST` 구간에 이미 존재하는 찜카/카모아 외부 차단을 삭제하지 않고, 라이브 DB mapping에 연결한다.
- 성공 기준:
  - 외부 차단은 끊기지 않는다.
  - save-run 시 중복 생성 대상에서 빠진다.
  - 찜카/카모아 mapping row가 IMS `4320448` 기준으로 생성된다.
  - read-only 검증에서 critical missing 0, warning 0 또는 managed covered 상태가 된다.
- 제외 범위:
  - 외부 차단 삭제
  - 외부 차단 재생성
  - Vercel deploy
  - launchd restart/kickstart
  - 전체 save-run
  - 운영 DB migration apply/push. 단, Phase 2에서 필요한 최소 DB DML mapping insert/upsert는 별도 승인 후 실행 가능

## 2. 현재 상태
- 확인한 파일/docs:
  - `PROJECT_STATE.md`
  - `scripts/zzimcar-sync/lib/zzimcar-sync-mapping-repo.js`
  - `scripts/carmore-sync/lib/carmore-sync-mapping-repo.js`
  - `supabase/migrations/20260629102000_update_external_sync_child_mapping_keys.sql`
- 현재 git 상태:
  - branch: `dev`
  - `dev...origin/dev [ahead 2]`
  - sync 관련 로컬 미커밋 변경 다수 존재
- 라이브 DB 상태:
  - `ims_sync_reservations`에 IMS `4320448` row 존재
  - `zzimcar_disable_time_sync_mappings`에 IMS `4320448` mapping 없음
  - `carmore_holiday_sync_mappings`에 IMS `4320448` mapping 없음
  - child key migration은 아직 라이브 DB에 적용되지 않음
  - 기존 mapping tables는 이미 라이브 DB에서 사용 중
- 외부 read-only 확인:
  - 찜카 vehiclePid `24098`, disableTimePid `231732`
  - 찜카 차단: `2026-06-30 10:00:00` ~ `2026-07-03 10:00:00` KST
  - 카모아 rentcarSerial `100748`, holidaySerial `1605223`
  - 카모아 휴무: `2026-06-30` ~ `2026-07-03`, memo `IMS 4320448`
- 현재 판정:
  - 실제 판매 차단은 이미 존재한다.
  - DB mapping만 비어 있어 reconcile이 addition으로 오판할 수 있다.
- 확인 필요:
  - 라이브 DB의 기존 unique index가 `ims_reservation_id` 단일 기준이므로, 이번 단건 mapping insert는 가능하지만 child split 다건 save-run은 아직 금지

## 3. 전체 변경 요약
- 변경점:
  - 기존 외부 차단 pid/serial을 DB mapping row로 연결한다.
  - 외부 차단 삭제/재생성 없이 mapping만 보강한다.
- 변경대상:
  - 라이브 DB table `zzimcar_disable_time_sync_mappings` 단건 insert/upsert
  - 라이브 DB table `carmore_holiday_sync_mappings` 단건 insert/upsert
  - 필요 시 `PROJECT_STATE.md`
- 예상 영향:
  - sync가 IMS `4320448`을 이미 managed 상태로 인식할 수 있다.
  - 외부 판매 차단은 유지된다.
- 주요 리스크:
  - DB write이므로 오입력 시 잘못된 외부 차단을 우리 관리 대상으로 흡수할 수 있다.
  - 현재 child key migration 미적용 상태이므로 child key 컬럼은 사용할 수 없다.
  - 기존 unique index 기준상 동일 IMS id는 provider별 table당 1개 mapping만 가능하다.

## 4. Phase 목록

### Phase 1. mapping 흡수 SQL 초안 작성
- 목적: 라이브 DB에 넣을 row 값을 정확히 고정한다.
- 변경점: 파일/DB 변경 없음. SQL 초안만 작성한다.
- 변경대상: 없음
- 실행방법:
  - IMS row 재조회
  - 외부 찜카 pid/카모아 serial 재조회
  - 기존 mapping 존재 여부 재확인
  - insert/upsert SQL 초안 작성
- 종료조건:
  - 찜카/카모아 각각 1건의 mapping row 값이 확정된다.
- 검증방법:
  - read-only SELECT 결과와 SQL 값 대조
- 리스크:
  - 외부 차단 시간이 IMS row와 불일치하면 중단
- 되돌릴 방법:
  - 초안 단계이므로 없음
- 출력보고:
  - SQL 초안, 대상 pid/serial, 미실행 명시

### Phase 2. 라이브 DB mapping 단건 반영
- 목적: 기존 외부 차단을 우리 mapping DB에 연결한다.
- 변경점:
  - 찜카 mapping 1건 insert/upsert
  - 카모아 mapping 1건 insert/upsert
- 변경대상:
  - `public.zzimcar_disable_time_sync_mappings`
  - `public.carmore_holiday_sync_mappings`
- 실행방법:
  - 사용자 별도 명시 승인 후 실행
  - 외부 API write 없이 DB DML만 실행
  - child key 컬럼은 아직 사용하지 않는다
- 종료조건:
  - 두 table 모두 IMS `4320448` mapping이 1건씩 존재한다.
- 검증방법:
  - DB SELECT
  - 외부 read-only 조회로 차단 유지 확인
- 리스크:
  - 잘못된 pid/serial 흡수
  - 기존 unique 충돌
- 되돌릴 방법:
  - 승인된 rollback SQL로 해당 IMS `4320448` mapping row 삭제 또는 `sync_status='deleted'` 처리
- 출력보고:
  - 실행 SQL 종류, 반영 row, 검증 결과

### Phase 3. no-write reconcile 재검증
- 목적: mapping 흡수 후 save-run 없이 addition 오판이 사라졌는지 확인한다.
- 변경점: 없음. read-only/no-write 실행만 한다.
- 변경대상: 없음
- 실행방법:
  - 찜카 no-write smoke
  - 카모아 no-write smoke
  - coverage verifier
- 종료조건:
  - IMS `4320448`이 addition 대상에서 빠진다.
  - critical missing 0
- 검증방법:
  - no-write smoke report
- 리스크:
  - child key migration 미적용 상태에서 일부 split child 검증은 여전히 제한됨
- 되돌릴 방법:
  - 읽기 전용이라 없음
- 출력보고:
  - provider별 managed/covered 결과

### Phase 4. code apply 시점 판단
- 목적: DB mapping 흡수 이후 코드 적용을 언제 할지 결정한다.
- 변경점: 판단/계획만. 배포/재시작은 별도 승인 전 금지
- 변경대상: 없음
- 실행방법:
  - 현재 로컬 dev 변경을 commit 가능한 단위로 정리
  - sync runner가 launchd에서 로컬 repo를 직접 보는 점 반영
  - code-only 보정은 DB mapping 반영 검증 후 commit
  - Vercel deploy는 홈페이지/API 영향이 있을 때만 별도 판단
- 종료조건:
  - `지금 커밋만`, `launchd 반영 전 보류`, `배포 필요`, `DB migration 후 적용` 중 하나로 판정
- 검증방법:
  - tests/build/no-write smoke
- 리스크:
  - launchd가 로컬 파일을 직접 보므로 commit 전 로컬 코드도 운영 runner에 영향 가능
- 되돌릴 방법:
  - commit 전: git diff revert
  - commit 후: revert commit
- 출력보고:
  - 코드 적용 추천 시점과 금지 항목

### Final Phase. 검수·완료판정·상태/정책문서 정리·문서 COMPLETE 변경·커밋
- 목적: mapping 흡수 작업을 완료 처리한다.
- 변경점:
  - 전체 변경 검수
  - 완료판정
  - `PROJECT_STATE.md` 업데이트
  - PM 문서 COMPLETE 이동/이름 변경
  - 커밋
- 변경대상:
  - `PROJECT_STATE.md`
  - 이 PM 문서
  - 관련 코드/테스트/migration 파일
- 실행방법:
  - 검증 결과 확인
  - 문서 정리
  - 사용자 승인 시 commit
- 종료조건:
  - DB mapping과 no-write 검증 결과가 문서에 남는다.
- 검증방법:
  - DB SELECT, 외부 read-only, no-write smoke, tests/build
- 리스크:
  - 운영 DB DML은 커밋으로 되돌릴 수 없으므로 rollback SQL 별도 보관 필요
- 되돌릴 방법:
  - DB rollback SQL
  - 코드 revert
- 출력보고:
  - 변경 파일, DB 반영 결과, 검증 결과, 커밋 여부, 남은 리스크

## 5. 승인 및 중단 조건
- 승인 요청:
  - 먼저 Phase 1만 승인받아 SQL 초안과 값 고정을 수행한다.
  - Phase 2는 라이브 DB write이므로 별도 명시 승인 필요.
- 중단 조건:
  - 외부 차단 값이 IMS `4320448`과 불일치
  - 기존 mapping이 이미 존재
  - DB unique 충돌
  - protected target 수정 필요
  - 외부 write 필요 발생
- protected target 별도 승인 필요 여부:
  - `.env*`, secret, token 수정 금지
  - 라이브 DB DML은 Phase 2 별도 승인 필요
  - DB migration apply/push는 이번 PM 범위 제외
  - 외부 API write/save-run 금지
  - deploy/restart 금지

## 6. 완료 보고 형식
- 완료 phase:
- 변경 파일:
- DB 반영:
- 검증 결과:
- 완료 문서 경로:
- 상태/정책문서 업데이트:
- 커밋:
- 남은 리스크:


## 7. 완료 결과
- 완료일: 2026-06-30
- DB 반영:
  - 찜카 mapping id `6ea5b5f0-2810-4ba1-b025-4a07cdafc2a6`
  - 카모아 mapping id `4081362f-c486-4b48-be2b-edc8746fd227`
- 검증:
  - DB SELECT: IMS `4320448` mapping provider별 1건 확인
  - 찜카 no-write smoke: IMS `4320448` unchanged, addition/replacement 아님
  - 카모아 no-write smoke: IMS `4320448` unchanged, addition/change 아님
  - targeted tests: 48 pass
  - build: pass
- 미실행/금지 유지:
  - 외부 save-run/write
  - 외부 차단 삭제/재생성
  - DB migration apply/push
  - deploy/restart/launchd
- 남은 리스크:
  - child key migration은 아직 라이브 DB 미적용
  - 전체 save-run 전에는 migration/schema gate와 추가 no-write 검증 필요
