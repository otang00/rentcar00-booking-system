# 2026-05-26 CAR GROUP POLICY AND VEHICLE AVAILABILITY PHASE PLAN

## Purpose
차량그룹 기준 가격정책을 다시 정리하고, 관리자 메뉴에서 차량 1대별 운영 노출 상태를 제어하는 phase를 잠근다.

## Baseline
- 가격 계산은 `source_group_id` 기준 가격정책 연결 구조를 사용한다.
- 예약 직전 availability 최종 검사는 `source_car_id` 1대 기준이다.
- 가격정책 정리는 주로 `price_policy_groups` 연결 문제다.
- 차량 운영 노출 제어는 현재 별도 local 관리자 필드가 없다.
- 최근 완료:
  - `docs/COMPLETED/2026-05-26_FINAL_PRICE_ROUNDING.md`
  - `docs/COMPLETED/2026-05-25_ADMIN_BOOKING_CHANGE_UI_MVP.md`

## Phase 1. 문서/운영 기준 잠금
- 목적:
  - 현재 목표와 active phase를 차량그룹 가격정책 정리 + 차량운영관리 기준으로 고정한다.
- 수정 대상:
  - `docs/GOAL/CURRENT_GOAL_LOCK.md`
  - `docs/PHASE/2026-05-26_CAR_GROUP_POLICY_AND_VEHICLE_AVAILABILITY_PHASE_PLAN.md`
  - stale phase 문서 정리
- 종료 조건:
  - active goal / active phase가 현재 작업 기준과 일치한다.
- 검증:
  - 문서 위치와 역할이 GOAL / PHASE / COMPLETED / ARCHIVE 기준에 맞는다.

## Phase 2. 차량그룹 가격정책 연결 정리 준비
- 목적:
  - 차량그룹별로 어떤 가격정책을 볼지 운영자가 수정할 수 있는 검토용 자료를 고정한다.
- 대상:
  - 검토용 HTML / JSON 산출물
  - 그룹명 / 차량번호 / 연결 가격정책 정리표
- 종료 조건:
  - 운영자가 그룹명 / 차량번호 / 가격정책 연결만 수정할 수 있는 자료 확보
  - 실제 반영 전 검토 가능한 상태
- 검증:
  - 산출물 열람 가능
  - 변경값 JSON 추출 가능
- 리스크:
  - HTML 산출물 가독성/호환성 문제가 다시 생길 수 있음

## Phase 3. 차량운영관리 메뉴 설계
- 목적:
  - 관리자 메뉴에서 차량 1대별 운영 가능 상태를 제어하는 구조를 설계한다.
- 대상:
  - 관리자 메뉴 `/admin/cars` 후보
  - 차량별 local 운영 필드 설계
- 포함:
  - `대여가능`
  - `15+일 대여`
- 종료 조건:
  - UI / API / DB 필드 / 검색 반영 조건이 문서로 잠김
- 검증:
  - 현재 검색 조건과 충돌 없이 설명 가능해야 함
- 리스크:
  - `active`, `ims_can_general_rental` 같은 기존 필드와 역할이 섞이면 운영 혼선 발생

## Phase 4. 차량운영관리 구현
- 목적:
  - 관리자 메뉴 / API / 검색 필터를 실제 반영한다.
- 예상 대상:
  - `src/components/AdminNav.jsx`
  - `src/App.jsx`
  - 신규 `src/pages/AdminCarsPage.jsx`
  - 신규 `src/services/adminCarsApi.js`
  - 신규 `api/admin/cars.js`
  - `server/search-db/repositories/fetchCandidateCars.js`
  - 필요 시 `supabase/migrations/*`
- 종료 조건:
  - 체크된 차량만 노출
  - 15일 이상 검색에서만 `15+일 대여` 조건 반영
  - 예약 직전 1대 기준 중복검사 유지
- 검증:
  - build
  - 검색 조건 테스트
  - 관리자 화면 상태 저장 확인
- 리스크:
  - DB migration 포함 가능
  - 운영 필드와 IMS sync 해석 충돌 가능

## Stop Conditions
- 같은 차량그룹 기준 정리와 차량 1대별 운영 상태 정리가 한 phase 안에서 섞여 범위가 커질 때
- IMS 원본 필드를 직접 덮어써야만 구현되는 구조가 나올 때
- 검색 노출 기준과 예약 직전 최종 중복검사 기준이 충돌할 때

## Verification Notes
- 가격정책 정리는 코드보다 연결표 기준 검증을 우선한다.
- 차량운영관리 구현 시에는 1~14일 검색과 15일 이상 검색을 분리 검증한다.
- 최종 예약 가능 여부는 계속 `source_car_id` 기준 확인 흐름을 유지해야 한다.
