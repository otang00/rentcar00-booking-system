# RENTCAR00 Zzimcar automation execution current

Last updated: 2026-04-29

이 문서는 찜카 후속 동기화 구현의 실행 기준만 정리한 문서다.
대상은 `ims_sync_reservations` 를 읽어 찜카 `disable_time` 을 맞추는 로직이다.

---

## 1. 범위

### 포함
- `ims_sync_reservations` 조회
- 차번 기준 찜카 차량 식별
- 찜카 `disable_time` 조회
- 신규 휴차시간 생성
- 취소/종료 예약 삭제
- 시간/차량 변경 시 재생성
- mapping 테이블 상태 갱신

### 제외
- IMS sync 수정
- IMS live API 재설계
- 브라우저 자동화 재구축
- 찜카 예약 생성

---

## 2. 입력 기준

원천 테이블:
- `public.ims_sync_reservations`

포함 상태:
- `pending`
- `confirmed`
- `paid`

제외 상태:
- `cancelled`
- `completed`
- `failed`

기본 필터:
- `end_at > now()`
- `car_number is not null`

---

## 3. 찜카 연동 기준

### 환경값
- `ZZIMCAR_ID`
- `ZZIMCAR_PASSWORD`
- 2026-04-29 실검증 중 `.env` 에 비밀번호가 잘못 중복 저장되어 있었음
- 오입력 예: `oyk96bh81*oyk96bh81*`
- 정상값 예: `oyk96bh81*`

### 로그인/조회/반영 경로
- 로그인: `POST /login`
- 차량검색: `GET /vehicle/vehicle/paging`
- 차량상세: `POST /vehicle/vehicle/detail/{pid}`
- 휴차시간 조회: `GET /vehicle/vehicle/{vehiclePid}/disable_time`
- 휴차시간 생성: `PUT /vehicle/disable_time`
- 휴차시간 삭제: `DELETE /vehicle/disable_time`

### 로그인 성공/실패 신호값
- 성공: `302 -> https://admin.zzimcar.com/`
- 실패: `302 -> https://admin.zzimcar.com/login?error`
- 쿠키: `SESSION=<value>`
- 로그인 실패 시 HTTP 클라이언트 문제로 단정하지 말고, 먼저 `.env` 계정값 오입력 여부부터 확인

### 차량 식별 기준
- 1차 기준: `car_number`
- 비교 전 공백 제거 정규화 수행
- 0건 또는 다건 매칭은 실패로 기록하고 자동 선택하지 않는다.
- 실검증 차번 예: `101하3049`
- 실검증 `vehiclePid`: `22304`

### 휴차시간 생성 요청 형식
- URL: `PUT /vehicle/disable_time`
- `Content-Type: application/json; charset=utf-8`
- `lang: ko`
- body 필드
  - `disableClass: "vehicle"`
  - `vehiclePid`
  - `startDtime`
  - `endDtime`

### 휴차시간 시간 형식
- 필수 형식: `YYYY-MM-DD HH:mm:ss`
- 예: `2026-04-29 15:39:00`
- `YYYY-MM-DD HH:mm` 로 보내면 `HTTP 400`
- 관리자 웹 UI도 `jquery datetimepicker` 의 `HH:mm:ss` 형식을 사용함

### 휴차시간 생성 성공/실패 신호값
- 성공 응답 예시
  - status: `200`
  - body: `{"msg":"219046","code":null,"data":null,"success":true}`
- 생성 pid 는 `body.pid` 가 아니라 `body.msg`
- 실패 예시 1: 시간 형식 오류 → `HTTP 400`
- 실패 예시 2: 중복 시간대 → `[VEHICLE_SCHEDULE_DUPLICATION_ERROR] 차량 스케줄이 중복되었습니다.`

### 휴차시간 삭제 요청 형식
- URL: `DELETE /vehicle/disable_time`
- body: `{ "pid": "219046" }`
- 성공 응답 예시
  - status: `200`
  - body: `{"msg":null,"code":null,"data":null,"success":true}`
- 삭제 후 재조회에서 대상 row 가 사라져야 진짜 성공으로 본다.

---

## 4. 신규 테이블 기준

테이블명:
- `public.zzimcar_disable_time_sync_mappings`

역할:
- IMS 예약 1건과 찜카 disable_time 1건의 대응 관계를 저장한다.

최소 필드:
- `ims_reservation_id`
- `car_number`
- `zzimcar_vehicle_pid`
- `zzimcar_disable_time_pid`
- `start_at`
- `end_at`
- `sync_status`
- `last_synced_at`
- `last_error`

상태값:
- `active`
- `deleted`
- `sync_failed`
- `delete_failed`

---

## 5. 실행 로직

### add
- desired 에 있고 active mapping 이 없으면 생성
- 생성 성공 시 mapping 저장

### delete
- active mapping 이 있는데 desired 에 없으면 삭제
- 삭제 성공 시 mapping 상태를 `deleted` 로 변경

### change
- 같은 `ims_reservation_id` 의 차량번호/시작/종료가 달라지면
- 기존 disable_time 삭제
- 새 disable_time 생성
- mapping 갱신

### failure
- 생성 실패 시 `sync_failed`
- 삭제 실패 시 `delete_failed`
- 다음 실행에서 복구 가능해야 한다.

---

## 6. 코드 경계

### 수정 금지 범위
- `scripts/ims-sync/run-ims-reservation-sync.js`
- 기존 IMS sync 내부 로직

### 신규 구현 범위
- `scripts/zzimcar-sync/lib/zzimcar-client.js`
- `scripts/zzimcar-sync/lib/fetch-desired-ims-reservations.js`
- `scripts/zzimcar-sync/lib/zzimcar-sync-mapping-repo.js`
- `scripts/zzimcar-sync/lib/reconcile-zzimcar-disable-times.js`
- `scripts/zzimcar-sync/run-zzimcar-reconcile-sync.js`
- mapping migration 파일

---

## 7. 검증 기준

### 단위 검증
- 차번 정규화
- 차량검색 응답 파싱
- payload 생성
- add/delete/change 계획 계산

### 실행 검증
- dry-run 에서 desired/actual/add/delete/change summary 출력
- save-run 에서 생성/삭제 결과와 mapping 상태 반영 확인

### 2026-04-29 구조 검증 결과
- migration 적용 전 dry-run 결과:
  - `desiredCount: 48`
  - `actualCount: 0`
  - `additionsCount: 48`
  - `deletionsCount: 0`
  - `changesCount: 0`
  - `errorsCount: 0`
- migration 적용 전 blocker:
  - `public.zzimcar_disable_time_sync_mappings` 테이블 미존재
  - 조회 오류: `PGRST205`
  - message: `Could not find the table 'public.zzimcar_disable_time_sync_mappings' in the schema cache`
- migration 적용:
  - `supabase db push --linked --dry-run` → 대상 migration 1건 확인
  - `supabase db push --linked` → `20260429131000_create_zzimcar_disable_time_sync_mappings.sql` 적용 완료
- migration 적용 후 확인:
  - mapping 테이블 조회 성공
  - 초기 row count: `0`
- 1건 save 검증:
  - target `imsReservationId`: `4133566`
  - `carNumber`: `101하3049`
  - create pid: `219054`
  - mapping row 저장 성공
  - `sync_status: active`
- 재실행 dry-run 확인:
  - `desiredCount: 48`
  - `actualCount: 1`
  - `additionsCount: 47`
  - `unchangedCount: 1`
  - target `4133566` 는 `unchanged` 로 분류
- 의미:
  - migration 적용 완료
  - mapping 저장 경로 확인 완료
  - 재실행 시 동일 건 중복 생성 안 함

### 2026-04-29 change/delete 실검증 결과
- change 대상: `imsReservationId=4133566`
- change 검증:
  - 기존 pid `219054` 삭제
  - 임시 변경 pid `219059` 생성
  - 원복 pid `219060` 생성
  - 최종 mapping 은 원래 `start_at/end_at` 기준 `active` 유지
- delete 검증:
  - 임시 stale mapping `TEMP-DELETE-1777439180764` 생성
  - 생성 pid `219061`
  - delete 수행 후 mapping `sync_status=deleted`
  - 찜카 재조회 결과 해당 pid 잔존 없음
- 최종 구조 재확인:
  - `desiredCount: 48`
  - `actualCount: 1`
  - `additionsCount: 47`
  - `deletionsCount: 0`
  - `changesCount: 0`
  - `unchangedCount: 1`
  - `4133566` 는 `unchanged`

### 안전 규칙
- mapping 없는 delete 금지
- 차번 다건 매칭 시 자동 진행 금지
- 로그인 실패 시 즉시 중단

---

## 8. 운영 엔트리포인트 정리

### 현재 운영 IMS 경로
- LaunchAgent: `~/Library/LaunchAgents/ai.otang.premove-ims-sync.plist`
- wrapper: `scripts/ims-sync/run-launchd.sh`
- worker: `scripts/ims-sync/run-ims-reservation-sync.js`
- interval: `300s`
- lock: `/tmp/premove-ims-sync.lock`

### 정리 원칙
- `scripts/ims-sync/run-reservation-sync-pipeline.js` 는 미사용 중간 파일로 판단한다.
- 운영 attach 경로로 오인될 수 있으므로 제거한다.
- zzimcar 는 기존 IMS worker 내부에 억지로 붙이지 않는다.
- 이후 운영 연결은 별도 실행기 기준으로 다시 잠근다.

### zzimcar 별도 실행기
- LaunchAgent: `~/Library/LaunchAgents/ai.otang.zzimcar-reconcile-sync.plist`
- wrapper: `scripts/zzimcar-sync/run-launchd.sh`
- worker: `scripts/zzimcar-sync/run-zzimcar-reconcile-sync.js`
- interval: `600s`
- lock: `/tmp/premove-zzimcar-reconcile.lock`
- save mode: `.env` 의 `ZZIMCAR_SYNC_SAVE=true` 일 때만 실제 반영
- 기본값: `ZZIMCAR_SYNC_SAVE=false` (dry-run)

## 9. 결론

이번 구현은 아래로 고정한다.

- **IMS는 기존 자산 유지**
- **찜카 후속 동기화만 신규 구현**
- **mapping 테이블 1개 추가**
- **HTTP 기반 reconcile 로직으로 add/delete/change 처리**
- **운영 IMS entrypoint는 기존 launchd 경로 유지**
- **미사용 pipeline 파일은 제거**
