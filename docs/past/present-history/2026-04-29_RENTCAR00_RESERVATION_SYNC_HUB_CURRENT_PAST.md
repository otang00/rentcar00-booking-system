# RENTCAR00 reservation sync hub current

Last updated: 2026-04-29

이 문서는 RENTCAR00 예약 동기화 작업의 현재 범위를 잠그는 기준 문서다.
이번 단계는 통합 허브 전체 구현이 아니다.
**기존 IMS sync 결과를 읽어 찜카 휴차시간에 반영하는 후속 동기화만 구현한다.**

---

## 1. 이번 단계 목표

### 목표
- 기존 IMS sync가 적재한 `ims_sync_reservations` 를 읽는다.
- 찜카 차량별 `disable_time` 에 예약 시간대를 반영한다.
- 예약 취소/시간 변경 시 찜카 반영 상태를 정리한다.

### 한 줄 정의
이번 작업은 **`ims_sync_reservations` → 찜카 disable_time 후속 동기화기** 구현이다.

### 성공 기준
- 살아있는 IMS 예약은 찜카에서 같은 차량/시간대로 판매되지 않는다.
- 취소되거나 종료된 예약은 찜카 휴차시간에서 제거된다.
- 동일 예약을 중복 생성하지 않는다.
- 우리가 생성한 찜카 휴차시간만 삭제한다.

### 이번 단계 비포함
- IMS sync 자체 수정
- 찜카 → IMS 자동 예약 생성
- IMS ↔ 찜카 양방향 동기화
- 홈페이지 예약 원장 재설계
- 결제/회원/관리자 시스템 통합

---

## 2. 기준 원천과 역할

### IMS sync
- `ims_sync_reservations` 가 이번 단계의 유일한 원천 데이터다.
- 기존 IMS sync 실행기는 이미 동작 중인 선행 자산이다.
- 이번 단계에서 IMS sync 자체는 수정 대상이 아니다.

### 찜카
- 찜카는 판매 채널이다.
- 이번 단계에서 찜카는 예약 생성 채널이 아니라 **판매 차단 반영 대상**이다.

### 추가 저장소
- 찜카 반영 결과 추적용 mapping 테이블 1개를 추가한다.

---

## 3. 구조 결정

### 신규 DB 구조
추가 테이블 수:
- 1개

역할:
- `ims_reservation_id`
- `car_number`
- `zzimcar_vehicle_pid`
- `zzimcar_disable_time_pid`
- `start_at`
- `end_at`
- `sync_status`
- `last_synced_at`
- `last_error`
를 저장한다.

필요 이유:
- 찜카 삭제 API는 `disable_time pid` 가 필요하다.
- 우리가 만든 결과물만 안전하게 삭제하려면 pid 저장이 필요하다.

---

## 4. 동작 규칙

### 규칙 1
원천 조회는 항상 `ims_sync_reservations` 기준이다.

### 규칙 2
반영 대상은 차단 상태 예약만 포함한다.
- `pending`
- `confirmed`
- `paid`

### 규칙 3
제거 대상은 아래다.
- `cancelled`
- `completed`
- `failed`
- 종료 시각 경과 예약
- 더 이상 desired set 에 없는 예약

### 규칙 4
동기화 판단은 `desired set vs actual set` 비교로 한다.

### 규칙 5
삭제는 mapping 테이블의 `zzimcar_disable_time_pid` 기준으로만 수행한다.

### 규칙 6
IMS sync 자산은 수정하지 않는다.
- 신규 구현은 찜카 후속 단계에만 한정한다.

### 규칙 7
운영 엔트리포인트는 현재 1개로 고정한다.
- LaunchAgent: `~/Library/LaunchAgents/ai.otang.premove-ims-sync.plist`
- wrapper: `scripts/ims-sync/run-launchd.sh`
- worker: `scripts/ims-sync/run-ims-reservation-sync.js`
- 미사용 attach/pipeline 경로는 운영 기준에서 제거한다.

---

## 5. 찜카 연동 기준

### 구현 방식
- 브라우저 자동화가 아니라 HTTP 호출 기준으로 구현한다.

### 확인된 경로
- `POST /login`
- `GET /vehicle/vehicle/paging`
- `POST /vehicle/vehicle/detail/{pid}`
- `GET /vehicle/vehicle/{vehiclePid}/disable_time`
- `PUT /vehicle/disable_time`
- `DELETE /vehicle/disable_time`

### 구현 의미
- 로그인 세션 취득 가능
- 차번 → 차량 pid 조회 가능
- disable_time 조회/생성/삭제 가능

---

## 6. 최종 동기화 로직

### Step 1
`ims_sync_reservations` 에서 desired set 생성

### Step 2
mapping 테이블에서 actual set 조회

### Step 3
add
- desired 에 있고 actual 에 없으면 생성

### Step 4
delete
- actual 에 있고 desired 에 없으면 삭제

### Step 5
change
- 같은 `ims_reservation_id` 의 차량/시간이 바뀌면 삭제 후 재생성

---

## 7. 구현 범위 결론

이번 단계 구현 범위는 아래로 고정한다.

- **기존 IMS sync는 유지**
- **신규 구현은 찜카 후속 동기화만**
- **신규 DB 구조는 mapping 테이블 1개만**
- **찜카 연동은 HTTP 기반 add/delete/change reconcile**
- **운영 IMS entrypoint는 기존 launchd 경로 1개만 유지**
- **미사용 `run-reservation-sync-pipeline.js` 는 제거**
