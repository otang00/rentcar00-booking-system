# 2026-04-14 19:32 / f5555a8 / IMS SYNC WORKER PHASE PLAN

## 목적
IMS 예약 목록을 주기적으로 수집해 Supabase에 적재하는 워커를 단계별로 구현한다.

## 기준점
- 시작점: `GET /v2/company-car-schedules/reservations`
- 종료점: 주기 실행 워커가 IMS 예약을 Supabase에 upsert
- 제외 범위: 목록 API, 상세 API, 가격 계산, 예약 생성

---

## Phase 1. API 기준 잠금
### 작업
- IMS 동기화 단일 엔드포인트 확정
- 쿼리 파라미터 기본값 확정
- active 예약 기준 확정 (`end_at > now()`)
- 페이지네이션/조회 기간 규칙 확정

### 종료 조건
- 요청 규칙 문서화 완료
- 샘플 요청 1개 확정
- 샘플 응답 기준 payload 1개 확보

### 검증
- 문서 기준으로 동일 요청 재현 가능

---

## Phase 2. 필드 매핑 잠금
### 작업
- IMS 응답 → DB 컬럼 매핑표 작성
- 필수/선택 필드 구분
- `ims_reservation_id` / 차량식별자 / 상태 / 기간 컬럼 고정

### 종료 조건
- 매핑표 완료
- 미확정 필드와 리스크 분리 완료

### 검증
- 샘플 payload 1개를 손으로 DB row 로 변환 가능

---

## Phase 3. DB 스키마 확정
### 작업
- `ims_reservations_raw`
- `reservations`
- `reservation_sync_runs`
- `reservation_sync_errors`
- unique/index/check 설계

### 종료 조건
- SQL 초안 작성 완료
- upsert key 확정

### 검증
- 스키마만 봐도 raw → normalized → log 흐름 설명 가능

---

## Phase 4. 워커 구조 확정
### 작업
- repo 내부 별도 worker 스크립트 경로 결정
- 환경변수 정리
- auth 주입 방식 결정
- 3분 주기/재시도 규칙 확정

### 종료 조건
- 실행 경로와 책임 분리 완료
- 운영 방식 문서화 완료

### 검증
- 사람이 실행 위치와 주기 설정 방식을 바로 이해 가능

---

## Phase 5. 수집기 구현
### 작업
- IMS API 호출 코드
- 페이지네이션
- raw 저장
- sync run 기록

### 종료 조건
- 수동 1회 실행 성공
- raw row 저장 확인
- sync run 기록 확인

### 검증
- 동일 조건 재실행 시 fetch 결과 재현 가능

---

## Phase 6. 정규화 + upsert 구현
### 작업
- parser 구현
- status 매핑
- `ims_reservation_id` 기준 upsert
- active 예약 기준 반영

### 종료 조건
- 샘플 데이터 upsert 성공
- 중복 실행 시 idempotent 확인

### 검증
- 같은 payload 2번 넣어도 row 중복 없음

---

## Phase 7. 주기 실행 검증
### 작업
- 스케줄 등록
- 연속 실행 점검
- 실패 재시도 확인

### 종료 조건
- 최소 2~3회 연속 정상 실행
- 중복/누락/폭주 없음

### 검증
- sync run 로그로 연속 성공 확인 가능

---

## 기본 운영안
- 평시 주기: 3분
- 실패 직후 재시도: 1회 짧게
- 운영 기준 active 예약: `end_at > now()`
- 앱 조회는 `reservations` 기준
