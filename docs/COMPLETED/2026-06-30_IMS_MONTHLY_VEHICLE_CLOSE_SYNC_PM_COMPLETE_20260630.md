# IMS 차량 flags 기반 외부 차량 상태 Sync PM

## 0. 문서 정보
- 작성일: 2026-06-30
- 작성자/agent: OpenClaw / rentcar00_reservation_developer
- 상태: COMPLETE
- 승인 범위: dev 브랜치에서 IMS 차량 flags와 active monthly 예약을 기준으로 카모아/찜카 외부 차량 상태를 맞추고, provider별 분리 mapping table로 상태 이력을 저장하는 코드·테스트·문서 변경 계획 수립.
- 실행 제외: 외부 실제 write, IMS POST, Supabase migration apply, deploy, launchd restart, `.env*`/secret 수정.
- 관련 문서:
  - `PROJECT_STATE.md`
  - `PROJECT_DOCUMENTATION_RULES.md`
  - `~/.openclaw/skills/manual/manuals/ims-api/README.md`
  - `~/.openclaw/skills/manual/manuals/carmore-api/README.md`
  - `~/.openclaw/skills/manual/manuals/zzimcar-api/README.md`
- 완료 후 문서명: `docs/COMPLETED/2026-06-30_IMS_MONTHLY_VEHICLE_CLOSE_SYNC_PM_COMPLETE_20260630.md`

## 1. 확정 정책

### 1-1. 기준
- 외부 상태는 매 실행 시 현재 IMS 기준에 맞춘다.
- 별도 유예 판단 단계는 두지 않는다.
- 현재 IMS 기준이 열림이면 외부도 연다.
- 현재 IMS 기준이 닫힘이면 외부도 닫는다.
- 단, active monthly 예약이 있으면 연장 가능성 때문에 최우선으로 차량 전체를 닫는다.

### 1-2. IMS 입력값
- 차량 flags:
  - `can_general_rental`: 일차/일반대여 열림 여부
  - `can_monthly_rental`: 월차/월대여 열림 여부
- 예약:
  - `detail.rental_type = monthly`
  - active monthly 예약 존재 여부

### 1-3. 카모아 결정 규칙
- active monthly 있음 → `appFlag=0`, `monthFlag=0`
- active monthly 없음 + `can_general_rental=true` → `appFlag=1`
- active monthly 없음 + `can_general_rental=false` → `appFlag=0`
- active monthly 없음 + `can_monthly_rental=true` → `monthFlag=1`
- active monthly 없음 + `can_monthly_rental=false` → `monthFlag=0`

### 1-4. 찜카 결정 규칙
- active monthly 있음 → 차량 게시 닫음: `isPublish=0`
- active monthly 없음 + `can_general_rental=false` → 차량 게시 닫음: `isPublish=0`
- active monthly 없음 + `can_general_rental=true` → 차량 게시 연다: `isPublish=1`
- `can_monthly_rental=false`만으로 찜카 차량 전체를 닫지 않는다.
- 찜카에는 별도 30일/월차 상품 열고닫기 API가 없는 것으로 정책을 잠근다.
- 따라서 `can_monthly_rental`은 찜카 상태 결정에 사용하지 않는다.

## 2. 현재 확인된 API

### IMS
- 차량 조회: `GET /v2/rent-company-cars`
- flags 변경: `POST /v2/rent-company-cars/{carId}/flags`
  - `{ "can_general_rental": false|true }`
  - `{ "can_monthly_rental": false|true }`
- 실제 IMS POST는 이 PM 범위에서 실행하지 않는다.

### 카모아
- 차량 조회: `get/JSON/rentcarInventory.php`
- 차량 스위치 저장: `set/carmoreSettingCar.php`
  - 일차: `appFlag=0/1`
  - 월차: `monthFlag=0/1`

### 찜카
- 차량 조회: `GET /vehicle/vehicle/paging`
- 차량 게시 저장: `PUT /vehicle/vehicle/publish/{vehiclePid}`
  - 닫기: `{ "isPublish": 0 }`
  - 열기: `{ "isPublish": 1 }`
- 별도 30일/월차 상품 열림·닫힘 API는 없음으로 정책 확정.
- 찜카는 차량 게시 `isPublish`만 상태 sync 대상이다.

## 3. Phase 목록

### Phase 1. IMS 기준 state builder
- 목적: 차량별 확정 외부 상태를 산출한다.
- 변경점:
  - IMS 차량 flags 수집.
  - active monthly 예약 수집.
  - 차량별 결정값 산출.
- 변경대상:
  - 신규 경로: `scripts/external-vehicle-state-sync/build-ims-vehicle-state.js`
  - tests
- 실행방법:
  - read-only.
  - 외부/DB write 없음.
- 종료조건:
  - 차량별 결정값 출력:
    - `carmoreAppFlag`
    - `carmoreMonthFlag`
    - `zzimcarIsPublish`
- 검증방법:
  - unit test
  - live read-only sample smoke

### Phase 2. 카모아 state planner no-write
- 목적: IMS 결정값과 카모아 actual을 비교해 실행할 상태값을 산출한다.
- 변경점:
  - 차량번호→카모아 `serial`, `appFlag`, `monthFlag` 조회 helper.
  - `set/carmoreSettingCar.php` payload builder.
- 변경대상:
  - `scripts/carmore-sync/lib/carmore-client.js`
  - 신규 planner/tests
- 실행방법:
  - no-write에서는 payload만 출력.
  - 실제 write 금지.
- 종료조건:
  - 카모아 일차/월차 상태값이 확정 출력됨.
- 검증방법:
  - unit test
  - live read-only lookup smoke
  - build

### Phase 3. 찜카 state planner no-write
- 목적: IMS 결정값과 찜카 actual을 비교해 실행할 상태값을 산출한다.
- 변경점:
  - 차량번호→`vehiclePid`, `isPublish` 조회 helper.
  - `PUT /vehicle/vehicle/publish/{vehiclePid}` payload builder.
- 변경대상:
  - `scripts/zzimcar-sync/lib/zzimcar-client.js`
  - 신규 planner/tests
- 실행방법:
  - active monthly 또는 `can_general_rental=false`이면 `isPublish=0`.
  - active monthly 없음 + `can_general_rental=true`이면 `isPublish=1`.
  - `can_monthly_rental`은 찜카 결정에 사용하지 않음.
- 종료조건:
  - 찜카 차량 게시 상태값이 확정 출력됨.
- 검증방법:
  - unit test
  - live read-only lookup smoke
  - build

### Phase 4. provider별 상태 저장 table + write guard 설계
- 목적: 카모아/찜카 상태 모델을 섞지 않고, 실제 write 전에 관측값/결정값/적용값/근거를 provider별로 저장한다.
- DB 원칙:
  - 공통 단일 테이블을 만들지 않는다.
  - 카모아와 찜카는 외부 id, 상태 필드, payload 구조가 다르므로 분리 table로 관리한다.
  - 가격 truth인 `pricing_hub_*`는 그대로 가격 전용으로 유지한다.
  - 나중에 pricing hub 외부 배포 이력이 필요하면 `carmore_price_sync_mappings`, `zzimcar_price_sync_mappings`를 별도 phase에서 만든다.
- 신규 table 1: `carmore_vehicle_state_sync_mappings`
  - `car_number`
  - `local_car_id`
  - `ims_car_id` / IMS `source_car_id`
  - `carmore_rentcar_serial`
  - `observed_app_flag`, `observed_month_flag`
  - `decided_app_flag`, `decided_month_flag`
  - `applied_app_flag`, `applied_month_flag`
  - `active_monthly_reservation_ids` jsonb
  - `reason` text 또는 jsonb: `active_monthly`, `ims_general_flag`, `ims_monthly_flag`
  - `sync_status`, `last_synced_at`, `last_error`
  - `metadata`, `created_at`, `updated_at`
- 신규 table 2: `zzimcar_vehicle_state_sync_mappings`
  - `car_number`
  - `local_car_id`
  - `ims_car_id` / IMS `source_car_id`
  - `zzimcar_vehicle_pid`
  - `observed_is_publish`
  - `decided_is_publish`
  - `applied_is_publish`
  - `active_monthly_reservation_ids` jsonb
  - `reason` text 또는 jsonb: `active_monthly`, `ims_general_flag`
  - `sync_status`, `last_synced_at`, `last_error`
  - `metadata`, `created_at`, `updated_at`
- 변경대상:
  - `supabase/migrations/*create_carmore_vehicle_state_sync_mappings.sql`
  - `supabase/migrations/*create_zzimcar_vehicle_state_sync_mappings.sql`
  - provider별 repository/tests
  - write guard/tests
- 실행방법:
  - migration 파일 작성만. apply는 별도 승인.
  - no-write에서는 DB write 없음.
  - 실제 외부 write 금지.
- 종료조건:
  - provider별 분리 schema, repository, write guard test 준비.

### Phase 5. 통합 no-write smoke
- 목적: IMS → 카모아 → 찜카 상태 결정을 한 번에 확인한다.
- 변경점:
  - 신규 runner: `scripts/external-vehicle-state-sync/run-external-vehicle-state-sync.js`
  - package script.
- 실행방법:
  - `--no-write-smoke` 또는 `NO_WRITE_SMOKE=true` 필수.
  - 실제 save mode는 guard로 차단.
- 종료조건:
  - provider별 결정 상태와 provider별 mapping 저장 예정값이 출력됨.
  - 실행 시 적용할 확정 상태로 출력됨.
- 검증방법:
  - unit tests
  - no-write smoke
  - `npm run build`

### Final Phase. 검수·문서 COMPLETE·커밋
- 목적: 승인된 구현 범위 완료 여부를 검수하고 문서/커밋을 정리한다.
- 변경점:
  - 전체 diff 검수
  - `PROJECT_STATE.md`, 정책문서, IMS/카모아/찜카 매뉴얼 업데이트
  - PM 문서를 `docs/COMPLETED`로 이동/이름 변경
  - 최종 커밋
- 검증방법:
  - `git diff --check`
  - 관련 tests
  - `npm run build`
  - 통합 no-write smoke
- 종료조건:
  - 승인 phase 완료, 검증 통과, 완료 문서 정리, 커밋 해시 보고.

## 4. 중단 조건
- IMS flags endpoint/payload가 확인 내용과 다름.
- 카모아/찜카 차량번호 매칭이 0건 또는 다건.
- `.env*`, secret, credential 수정 필요 발생.
- 외부 write/save-run, DB migration apply, deploy, launchd restart 필요 발생.

## 5. 별도 승인 필요
- IMS flags 실제 POST
- 카모아/찜카 실제 상태 write
- Supabase migration apply
- production deploy/restart/launchd
- `.env*`, secret, credential 수정

## 6. 완료 보고 형식
- 완료 phase:
- 변경 파일:
- 검증 결과:
- 완료 문서 경로:
- 상태/정책문서 업데이트:
- 커밋:
- 남은 리스크:


---

## 7. 완료 결과
- 완료일: 2026-06-30
- 완료 phase: Phase 1~5, Final
- 구현 요약:
  - IMS 차량 flags + active monthly 예약 기반 desired state builder 추가.
  - 카모아 `appFlag/monthFlag` provider planner 추가.
  - 찜카 `isPublish` provider planner 추가.
  - provider별 분리 mapping table migration 파일 추가.
  - save-run hard fail guard 추가.
  - 통합 no-write smoke runner 추가.
  - package script `external-vehicle-state:smoke` 추가.
- 신규 DB migration 파일:
  - `supabase/migrations/20260630191000_create_carmore_vehicle_state_sync_mappings.sql`
  - `supabase/migrations/20260630191100_create_zzimcar_vehicle_state_sync_mappings.sql`
- 실제 DB apply: 미실행. 별도 승인 필요.
- 외부 write: 미실행.
- IMS flags POST: 미실행.
- deploy/restart/launchd: 미실행.

## 8. 검증 결과
- 신규 테스트: `node --test scripts/external-vehicle-state-sync/__tests__/*.test.js` → 4 pass
- 카모아 기존 테스트: `npm run test:carmore-sync` → 20 pass
- 찜카 기존 테스트: `npm run test:zzimcar-sync` → 47 pass
- build: `npm run build` → pass
- 제한 live no-write smoke: `--limit=3` → pass, write 없음
- 전체 live no-write smoke:
  - IMS vehicles: 60
  - active monthly vehicles: 27
  - 카모아 setState 17 / unchanged 43 / errors 0
  - 찜카 setState 15 / unchanged 45 / errors 0
  - wroteExternal false
  - wroteDb false

## 9. 남은 별도 승인 항목
- Supabase migration apply
- 카모아/찜카 실제 상태 write save-run
- IMS flags 실제 POST
- production deploy
- launchd restart/kickstart
