# RENTCAR00 Zzimcar sync implementation phases current

Last updated: 2026-04-29

이 문서는 찜카 후속 동기화 구현을 위한 실행 설계서다.
목표는 기존 IMS sync 자산을 유지한 채, 찜카 쪽 신규 구현 범위만 정확히 고정하는 것이다.

---

## Phase 1 — Mapping table

### 목적
찜카에 생성한 disable_time 을 추적하고 삭제 가능하게 만든다.

### 생성 대상
- migration 파일 1개
- 테이블: `public.zzimcar_disable_time_sync_mappings`

### 필수 컬럼
- `ims_reservation_id`
- `car_number`
- `zzimcar_vehicle_pid`
- `zzimcar_disable_time_pid`
- `start_at`
- `end_at`
- `sync_status`
- `last_synced_at`
- `last_error`
- `created_at`
- `updated_at`

### 제약
- `ims_reservation_id` unique
- `end_at > start_at`
- `sync_status` check 제약

### 종료 조건
- add/delete/change 추적 가능
- delete 시 필요한 pid 저장 가능

---

## Phase 2 — Zzimcar HTTP client

### 목적
브라우저 없이 찜카 로그인/조회/생성/삭제를 수행한다.

### 생성 대상
- `scripts/zzimcar-sync/lib/zzimcar-client.js`

### 책임 함수
- `login()`
- `findVehicleByCarNumber()`
- `getVehicleDetail()`
- `getDisableTimes()`
- `createDisableTime()`
- `deleteDisableTime()`

### 핵심 규칙
- 로그인 실패 시 즉시 중단
- 차번 매칭 0건/다건이면 실패 처리
- disable_time 삭제는 pid 기준

### 종료 조건
- HTTP 요청만으로 찜카 제어 가능
- 응답 normalize 규칙 고정

---

## Phase 3 — Repository layer

### 목적
원천 예약과 현재 mapping 상태를 읽고 쓸 수 있게 한다.

### 생성 대상
- `scripts/zzimcar-sync/lib/fetch-desired-ims-reservations.js`
- `scripts/zzimcar-sync/lib/zzimcar-sync-mapping-repo.js`

### 책임
- desired set 조회
- active mapping 조회
- active 저장
- deleted 갱신
- failure 상태 갱신

### desired 기준
- source: `ims_sync_reservations`
- include: `pending/confirmed/paid`
- filter: `end_at > now()`
- require: `car_number`

### 종료 조건
- reconcile 에 필요한 shape 고정
- DB read/write 책임 분리 완료

---

## Phase 4 — Reconcile engine

### 목적
desired 와 actual 을 비교해 add/delete/change 를 실행한다.

### 생성 대상
- `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
- `scripts/zzimcar-sync/run-zzimcar-reconcile-sync.js`

### 판단 기준
- key: `ims_reservation_id`
- compare:
  - `car_number`
  - `start_at`
  - `end_at`

### 실행 규칙
- add: actual 없음 → 생성
- delete: desired 없음 → 삭제
- change: 차량/시간 다름 → 삭제 후 재생성
- failure: 상태 기록 후 다음 실행에서 복구 가능해야 함

### 이번 phase 실제 변경 포인트
- `applyAddition()`
  - create 성공 후 `disableTimePid` 확보
  - 응답에 pid 가 비어 있으면 `getDisableTimes()` 재조회 후 exact match pid 회수
- duplicate 분기
  - 에러 문자열에 `VEHICLE_SCHEDULE_DUPLICATION_ERROR` 포함 시
  - 바로 실패 처리하지 않고 same window 재조회
  - exact match row 가 있으면 그 pid 를 회수해 계속 진행
- `createDisableTime()` 에서
  - `HTTP 400` 만 버리지 않고 body message 를 에러에 포함
  - reconcile 이 duplicate 여부를 문자열로 분기 가능하게 만듦
- change 경로
  - 기존 delete 후 새 add 수행
  - 새 add 에서 pid 확보 실패 시 mapping 저장 금지

### 성공 신호
- add 결과에 `disableTimePid` 존재
- duplicate 에러 발생 시에도 exact row 재조회로 pid 회수 가능
- change 결과에서 `deletion` 과 `addition.disableTimePid` 둘 다 존재

### 종료 조건
- dry-run summary 출력 가능
- save-run 시 mapping 반영 가능
- add smoke test 에서 생성 pid 확보 후 삭제 성공

---

## Phase 5 — Attach point preparation

### 목적
기존 IMS sync 뒤에 붙일 준비만 한다.

### 원칙
- 기존 IMS sync 파일은 수정하지 않는다.
- 찜카 실행기는 독립적으로 완성한다.
- 최종 attach 방식은 구현 완료 후 별도 결정한다.

### 종료 조건
- 찜카 실행기 단독 dry-run 가능
- attach 전에 필요한 입력/출력 계약 정리 완료

---

## 검증 게이트

### Gate 1
- migration SQL 검토 완료

### Gate 2
- unit tests green

### Gate 3
- dry-run summary 검증

### Gate 4
- save-run 소규모 실검증

### Gate 5
- cancel/delete/change 복구 확인

### 2026-04-29 Gate 5 상태
- change 실검증 완료
  - 대상: `imsReservationId=4133566`
  - 기존 pid: `219054`
  - 임시 변경 pid: `219059`
  - 원복 후 pid: `219060`
  - 검증: old pid 삭제 후 new pid 생성, 이후 원복까지 완료
- delete 실검증 완료
  - 임시 stale mapping: `TEMP-DELETE-1777439180764`
  - 생성 pid: `219061`
  - delete 후 mapping `sync_status=deleted`
  - delete 후 찜카 row 잔존 없음
- 최종 dry-run 재확인
  - `desired=48 / actual=1 / additions=47 / deletions=0 / changes=0 / unchanged=1 / errors=0`
  - `4133566` 는 최종 `unchanged`

### 2026-04-29 Gate 4 상태
- dry-run 구조 검증 완료
- migration 적용 전 결과: `desired=48 / actual=0 / additions=48 / deletions=0 / changes=0 / errors=0`
- migration 적용 전 blocker:
  - 원격 Supabase 에 `zzimcar_disable_time_sync_mappings` 미적용
  - 조회 오류 `PGRST205`
- 이후 집행:
  - `supabase db push --linked` 로 mapping migration 적용 완료
  - 테이블 조회 성공 확인
- 1건 save 검증 완료
  - target: `imsReservationId=4133566`
  - create pid: `219054`
  - mapping `sync_status=active`
- 재실행 dry-run 결과:
  - `desired=48 / actual=1 / additions=47 / changes=0 / unchanged=1 / errors=0`
  - `4133566` 는 `unchanged`

---

## 2026-04-29 실검증 메모

### 먼저 확인할 것
- `.env` 의 `ZZIMCAR_ID`, `ZZIMCAR_PASSWORD`
- 계정값부터 확인하지 않으면 로그인 실패를 코드 문제로 오판하게 됨

### 실검증 결과
- HTTP 로그인 성공 확인
- 차량조회 성공 확인
- 휴차시간 생성 성공 확인
- 휴차시간 삭제 성공 확인

### 실제 성공 신호
- 로그인 성공: `302 -> /`
- 로그인 실패: `302 -> /login?error`
- 차량조회 성공 예시: `carNumber=101하3049`, `vehiclePid=22304`
- 생성 성공 예시: body `success=true`, `msg="219046"`
- 삭제 성공 예시: body `success=true`
- 삭제 후 재조회에서 대상 row 미존재 확인

### 구현 시 꼭 고정할 값
- `startDtime`, `endDtime` 는 `YYYY-MM-DD HH:mm:ss`
- 초 없는 `YYYY-MM-DD HH:mm` 는 `400`
- 생성 pid 파싱 위치는 `body.msg`
- 중복 오류 메시지: `[VEHICLE_SCHEDULE_DUPLICATION_ERROR] 차량 스케줄이 중복되었습니다.`

---

## 핵심 리스크

### 1. 차번 매칭 실패
- normalize 규칙 고정
- 0건/다건 자동 선택 금지

### 2. mapping 없는 delete
- pid 없는 delete 금지

### 3. partial failure
- `sync_failed` / `delete_failed` 로 상태 보존
- 다음 실행 복구 가능 구조 유지

### 4. 기존 IMS 자산 오염
- IMS sync 수정 금지
- 신규 구현 범위는 `scripts/zzimcar-sync` 와 migration 에 한정

---

## 구현 준비 결론

현재 구현 준비 기준은 아래다.

- **IMS는 기존 자산 유지**
- **찜카 신규 구현만 진행**
- **attach 는 마지막 단계에서 별도 판단**
- **지금 당장 필요한 구현은 migration + HTTP client + repository + reconcile**
