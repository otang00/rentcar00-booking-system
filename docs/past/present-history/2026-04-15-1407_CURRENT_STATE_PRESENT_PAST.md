# CURRENT STATE

## 현재 기준점
- 현재 작업 기준 commit: `31f55f2`
- 의미: **DB 연결 전 포인트**
- 현재 preview는 배포 가능 상태이며, 홈페이지 검색/상세 흐름은 아직 기존 partner 프록시 기준 결과를 사용한다.

## 현재 살아있는 구조
- 프론트는 여전히 우리 서버 API만 호출한다.
- 검색 결과의 실제 source는 아직 `server/partner/*` 파싱 결과다.
- IMS 예약 DB 적재/동기화 baseline은 완료됐다.
- 하지만 검색 페이지는 아직 `reservations` 기반 가용성 계산으로 전환되지 않았다.

## 현재 완료된 것
### 1. IMS 예약 동기화 기반
- IMS 로그인 / fetch / normalize / upsert worker 완료
- `reservations`, `ims_reservations_raw`, `reservation_sync_runs`, `reservation_sync_errors` 기반 확보
- 실검증 기준 fetch/upsert 성공 이력 확보

### 2. 문서 기준점 정리
- 이전 present 문서는 `docs/past/present-history/` 로 이관
- 오늘부터 현행 기준은 아래 present 문서로 다시 잠근다.

### 3. 검색 shadow 모드 구축 (Phase 3)
- `/api/search-cars`에 Supabase 기반 shadow 검색 실행 및 diff 로깅 계측 완료
- `meta.shadow`로 실행 상태 노출, `search_shadow_diffs` + JSONL 로그 기록

## 지금 아직 안 된 것
- 검색 API가 우리 DB를 source of truth 로 읽는 구조 (Phase 5 목표)
- DB 결과를 partner 결과와 최대한 맞추는 보정 작업(Phase 4)
- 검색 결과와 상세 결과의 DB 기준 일치
- 관리자 페이지 / 로그인

## 현재 핵심 목표
다음 구현 목표는 **홈페이지 검색 결과를 우리 DB 기준으로 재현**하는 것이다.

단기 순서는 아래와 같다.
1. Phase 4 — shadow 로그를 근거로 DB 결과를 partner 수준에 맞추는 보정
2. Phase 5 — 품질 지표가 기준을 통과하면 검색 API source 를 DB로 전환

조건은 아래와 같다.
- 프론트 응답 shape는 최대한 유지
- 기존 partner 결과와 같은 결과를 먼저 재현
- 병행 비교 후 전환
- 관리자 페이지/로그인은 현재 범위에 넣지 않음

## 현재 우선 문서
1. `docs/present/CURRENT_STATE_PRESENT.md`
2. `docs/present/ROADMAP_PRESENT.md`
3. `docs/present/VALIDATION_PRESENT.md`
4. `docs/present/PARALLEL_WORKSTREAMS_PRESENT.md`
5. `docs/present/IMPLEMENTATION_RULES_PRESENT.md`
6. `docs/present/DECISIONS_PRESENT.md`
7. `docs/00_FINAL_GOAL.md`
8. `docs/04_PARTNER_SITE_REFERENCE.md`
9. `docs/05_DETAIL_DB_INTEGRATION_PHASE1.md`
10. `docs/06_EXTERNAL_PREVIEW_DEPLOY_RUNBOOK.md`
11. `docs/references/IMS_API_CALLS.md`

## 과거 문서 위치
- 이전 현행 문서: `docs/past/present-history/`
- IMS sync phase/history: `docs/past/ims-sync/`
- 오래된 설계/프로토타입: `docs/archive/`
