# EXECUTION MASTER PRESENT

## 목적
다음 수정 phase를 시작하기 전에, 현재 구조와 검증 사실을 **단일 기준 문서**로 잠근다.
이 문서만 현재 실행 기준으로 사용한다.

## 기준점
- 브랜치: `feat/db-preview-home`
- 현재 active present 문서: 이 문서 1개만 사용
- 이전 current/present/agent 문서: `docs/past/doc-lock-2026-04-17/` 로 이관 완료
- Phase 1, Phase 2 완료 커밋: `69543bb`

## 현재 실행 체크포인트
- Phase 1 완료: `cars` 저장 구조 잠금 완료
- Phase 2 완료: 기존 5분 IMS sync 워커에 차량 상태 sync 연결 완료
- Phase 3 완료: 검색 후보 단계에 `ims_can_general_rental = true` 반영 완료
- 다음 active 작업은 **상세 일치화** 1건으로 잠근다

## 현재 잠금 상태
### 1. 검색 기준
현재 공개 검색은 **일대차 검색** 기준으로 본다.

### 2. 현재 검색 후보 조회 사실
검색 후보는 현재 아래 조건만 사용한다.
- `cars.active = true`
- `rent_age <= driverAge`

파일:
- `server/search-db/repositories/fetchCandidateCars.js`

즉, 아직 IMS 차량관리의 대여 가능 플래그는 검색에 반영되지 않았다.

### 3. 현재 예약 차단 기준
예약 차단은 IMS 예약 sync 데이터를 기준으로 동작한다.
현재 sync 소스는 아래 API다.
- `GET /v2/company-car-schedules/reservations`

이 API는 예약/스케줄 정보용이며, 차량관리 on/off의 기준 소스가 아니다.

## 이번에 검증된 IMS 차량관리 사실
### 1. 차량관리 기준 API
차량관리 플래그 확인용 API:
- `GET /v2/rent-company-cars?page=1&state=all&per_page=200`

이 API는 예약/스케줄 API가 아니라 **차량관리 목록 API**다.

### 2. 차량별 on/off 필드
차량 목록 `list[*]` 에 아래 필드가 존재한다.
- `can_general_rental`
- `can_monthly_rental`
- `is_day_off`
- `using_state`

의미:
- `can_general_rental`: 일대차 가능 여부
- `can_monthly_rental`: 월대차 가능 여부
- `is_day_off`: 차량 휴무 여부
- `using_state`: 현재 차량 상태 텍스트

샘플 검증:
- `233063 / 177호3413`
  - `can_general_rental: true`
  - `can_monthly_rental: true`
- `224219 / 142호4782`
  - `can_general_rental: true`
  - `can_monthly_rental: false`

### 3. 저장 단위
이 플래그는 **차량 단위**로 저장하고 반영해야 한다.
같은 `car_group_id` 안에서도 값이 섞이는 사례를 확인했다.
즉 그룹 단위 저장/필터는 오답 가능성이 있다.

검증 예시:
- 그룹 `22318`
  - `207612` → `can_general_rental=true`, `can_monthly_rental=true`
  - `207611` → `can_general_rental=false`, `can_monthly_rental=false`

따라서 저장/필터 기준 키는 그룹이 아니라 **`source_car_id`** 다.

### 4. 현재 검증 수치
- 총 차량: 58
- `can_general_rental = false`: 16대
- `can_monthly_rental = false`: 19대

## 현재 검색에 주는 의미
현재 검색 흐름은 아래 순서로 이해한다.
1. 차량 후보 조회
2. 예약 overlap 차단
3. 그룹 dedupe

따라서 차량관리 on/off 반영은 그룹 dedupe 뒤가 아니라 **차량 후보 단계에서 먼저** 걸러야 한다.

정답 순서:
1. `cars.active = true`
2. `rent_age <= driverAge`
3. `ims_can_general_rental = true`
4. 예약 overlap 차단
5. 그룹 dedupe

## 다음 실행 목표
다음 실행은 아래 순서로 간다.

1. 검색 필터 반영
2. 상세 일치화

월대차 확장은 위 2단계가 끝난 뒤 다음 단계로 본다.

## 다음 phase 원칙
1. 먼저 문서 기준점부터 확인한다.
2. 차량 상태는 **source_car_id 기준**으로 반영한다.
3. 그룹 dedupe 전에 차량 필터가 먼저 적용되어야 한다.
4. 저장 구조를 먼저 잠그고, 그 다음 sync 와 검색 반영으로 간다.
5. 저장 위치는 `cars` 테이블로 고정하고 별도 테이블은 만들지 않는다.
6. 컬럼은 검색 반영에 필요한 최소 범위만 둔다.

## 실행 phase 잠금
### Phase 1. 저장 구조 잠금
목적:
- 차량관리 on/off 상태를 검색 반영에 필요한 최소 구조로 먼저 확정한다.

Phase 1 확정안:
- 저장 위치: `cars` 테이블
- 별도 테이블: 사용하지 않음
- 기준 키: `source_car_id`
- 저장 필드:
  - `ims_can_general_rental boolean`
  - `ims_can_monthly_rental boolean`
  - `ims_vehicle_synced_at timestamptz`
- 보조 컬럼:
  - 추가하지 않음

이유:
- 현재 검색/상세가 `cars` 를 직접 읽는다.
- 검색 반영 핵심은 일대차/월대차 가능 여부다.
- `is_day_off`, `using_state` 는 현재 범위에서 직접 사용하지 않으므로 넣지 않는다.
- 최소 컬럼만 두는 편이 더 덜 헷갈리고 이후 조건도 단순해진다.

Phase 1 세부 단계:
1. 현재 `cars` 스키마와 검색/상세 조회 지점 재확인
2. 추가 컬럼 최종안 확정
3. null/default 정책 확정
4. Phase 2 sync 입력 shape 확정
5. migration 범위 확정
6. Phase 1 종료 조건 문서화

Phase 1 확인 포인트:
- 저장 위치가 `cars` 로 충분한가
- 키 기준이 `source_car_id` 로 명확한가
- 컬럼이 검색 반영에 필요한 최소 범위인가
- 컬럼명이 검색 조건에 바로 붙기 쉬운가
- 미수집 상태와 false 상태를 구분할 수 있는가

Phase 1 정책 잠금:
- `ims_can_general_rental`: nullable boolean
- `ims_can_monthly_rental`: nullable boolean
- `ims_vehicle_synced_at`: nullable timestamptz
- null 의미: 아직 sync 되지 않음
- false 의미: IMS 기준 비활성/off
- true 의미: IMS 기준 활성/on

Phase 1 종료 조건:
- 저장 위치가 `cars` 로 확정되어 있다
- 키 기준이 `source_car_id` 로 잠겨 있다
- 저장 필드가 3개로 고정되어 있다
- null/default 정책이 문서에 명시되어 있다
- Phase 2 에서 바로 구현 가능한 입력 shape 가 정리되어 있다
- migration 범위가 컬럼 추가로만 잠겨 있다

### Phase 2. IMS 차량 상태 sync 추가
상태:
- 완료

실행 기준:
- 기존 5분 sync 워커 진입점: `scripts/ims-sync/run-ims-reservation-sync.js`
- launchd 실행 스크립트: `scripts/ims-sync/run-launchd.sh`
- 차량 상태 fetch: `GET /v2/rent-company-cars?page=1&state=all&per_page=200`
- `id` 를 `source_car_id` 와 매핑
- 기존 `cars` row 만 `source_car_id` 기준 update
- 응답에 없는 차량은 건드리지 않음
- 신규 insert 는 하지 않음

실측 검증:
- IMS 차량 수: 58
- `cars` 매칭 수: 58
- 미매칭 수: 0
- `can_general_rental=false`: 16
- `can_monthly_rental=false`: 19
- `ims_vehicle_synced_at` 반영 차량 수: 58

종료 상태:
- DB에 차량별 on/off 상태가 실제 저장됨

### Phase 3. 검색 필터 반영
상태:
- 완료

목적:
- 현재 공개 검색에서 일대차 off 차량을 제외한다.

반영 기준:
- `fetchCandidateCars` 에 `ims_can_general_rental = true` 조건 추가
- 차량 후보 단계에서 먼저 필터 적용
- null 은 통과시키지 않고 `true` 만 통과시킨다
- 예약 overlap 차단과 그룹 dedupe 전에 적용한다

확인 파일:
- `server/search-db/repositories/fetchCandidateCars.js`
- 검색 경로 호출 지점
- 관련 테스트 또는 샘플 검증 스크립트

실측 검증:
- active + 연령 통과 차량: 58
- `ims_can_general_rental = true` 적용 후 후보: 42
- 제외 차량: 16
- 후보 결과 내 `ims_can_general_rental !== true`: 0

종료 상태:
- 일대차 off 차량이 검색 결과에서 빠진다
- 필터 순서가 문서 기준과 일치한다

### Phase 4. 상세 일치화
목적:
- 검색과 상세의 노출 기준을 일치시킨다.

반영 기준:
- 상세 조회도 같은 차량 상태 기준 적용
- 직링크 진입 정책까지 같이 정리

종료 조건:
- 검색과 상세가 같은 차량 상태 기준으로 동작한다

## Phase 1 실행 준비 상태
다음에 바로 시작할 수 있도록 Phase 1 준비 항목을 아래로 고정한다.

### Phase 1 시작 전 확인할 파일
- `supabase/migrations/20260414000000_create_cars.sql`
- `server/search-db/repositories/fetchCandidateCars.js`
- `server/detail/buildDbCarDetailDto.js`
- `scripts/pricing/build-group-pricing-preview.js`
- IMS 차량관리 응답 샘플 기준

### Phase 1 검증 결과
- `cars` 테이블에는 이미 `source_car_id bigint not null unique` 가 있다.
- 검색은 `fetchCandidateCars.js` 에서 `cars.select('*')` 를 사용한다.
- 상세는 `buildDbCarDetailDto.js` 내부 `fetchCarRow()` 에서 `cars.select('*')` 를 사용한다.
- 내부 preview 스크립트는 `cars` 에서 `source_group_id,name,display_name` 만 읽는다.
- 따라서 새 컬럼 3개를 `cars` 에 추가해도 현재 검색/상세/preview 읽기 구조와 충돌하지 않는다.

### Phase 1 체크리스트
- [ ] 저장 위치를 `cars` 로 유지
- [ ] 별도 테이블 미사용 확정
- [ ] 기준 키를 `source_car_id` 로 잠금
- [ ] 저장 필드를 3개로 잠금
- [ ] nullable 정책 잠금
- [ ] Phase 2 sync 입력 shape 잠금
- [ ] migration 범위를 컬럼 추가만으로 잠금

### Phase 1에서 바로 결정된 것
- 저장 위치: `cars`
- 기준 키: `source_car_id`
- 저장 필드:
  - `ims_can_general_rental`
  - `ims_can_monthly_rental`
  - `ims_vehicle_synced_at`
- 제외 필드:
  - `ims_is_day_off`
  - `ims_using_state`

### Phase 1 예상 sync 입력 shape
- `source_car_id`
- `ims_can_general_rental`
- `ims_can_monthly_rental`
- `ims_vehicle_synced_at`

### Phase 1 산출물
- 스키마 변경안 1개
- 필드 의미 표 1개
- Phase 2 sync 입력 shape 초안 1개

## 추천 방향
현재 기준 추천 순서는 아래다.
1. Phase 1 저장 구조 잠금
2. Phase 2 차량 상태 sync
3. Phase 3 검색 반영
4. Phase 4 상세 일치화

## 문서 잠금 규칙
- 이 문서를 다음 실행 기준 문서로 사용한다.
- 추가 current 문서는 만들지 않는다.
- phase 종료 후 이 문서는 `past/` 로 이동한다.
