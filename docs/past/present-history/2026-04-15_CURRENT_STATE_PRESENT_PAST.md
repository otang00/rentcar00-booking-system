# CURRENT STATE

## 현재 기준
`premove-clone`은 브랜드형 랜딩 셸 안에서
**검색 → 차량 목록 → 차량 상세/예약 준비** 흐름을 하나의 서비스처럼 연결한 렌터카 예약 프론트다.

## 현재 살아있는 사용자 흐름
1. `/` 진입
2. 대여/반납 일정 + 딜리버리 지역 + 연령 선택
3. 딜리버리 위치가 확정된 상태로 검색 실행
4. 검색 결과 노출
5. 차량 선택 후 `/cars/:carId` 진입
6. 상세에서 차량/가격/보험/예약자 정보 확인
7. 예약 요청 직전 검증

## 현재 구조
- 프론트는 partner/IMS를 직접 호출하지 않는다.
- `api/search-cars.js`, `api/car-detail.js`를 통해 서버 프록시를 거친다.
- 서버는 `server/partner/*`에서 partner 검색/상세를 파싱해 프론트용 DTO로 가공한다.
- 메인 검색이 딜리버리 확정의 source of truth다.
- 상세에서는 날짜/시간과 딜리버리 위치를 수정하지 않고 읽기 전용으로 노출한다.
- 상세는 메인에서 확정된 검색 조건을 소비하는 예약 확인 화면이다.

## 현재 예약 일정 규칙
- 과거 일시는 선택 불가
- 대여는 현재 시각 기준 3시간 이후부터 가능
- 운영 시간은 매일 `09:00 ~ 21:00`
- 반납은 대여 시각 기준 최소 1일(24시간) 이후부터 가능
- 대여 기간은 최대 30일

## 현재 상세 데이터 기준
- 현재 상세 API `api/car-detail.js` 는 partner 상세 파싱 DTO를 그대로 프론트에 공급한다.
- 상세 전환 1차의 목표는 프론트 응답 shape를 유지한 채, 차량 기본 정보 source만 Supabase `public.cars` 쪽으로 옮길 준비를 마치는 것이다.
- 상세 전환 1차의 source 분리 기준은 `docs/05_DETAIL_DB_INTEGRATION_PHASE1.md` 를 따른다.

## 현재 문서 원칙
- 현재 기준 문서는 `docs/README.md`, `docs/present/CURRENT_STATE_PRESENT.md`, `docs/00_FINAL_GOAL.md`, `docs/present/IMS_SYNC_PRESENT.md`, `docs/present/DECISIONS_PRESENT.md`, `docs/04_PARTNER_SITE_REFERENCE.md`, `docs/05_DETAIL_DB_INTEGRATION_PHASE1.md`, `docs/references/*`만 우선 본다.
- phase별 검토/잠금 문서는 `docs/past/` 로 내린다.
- 더 오래된 설계/작업 지시문은 `docs/archive/` 에 둔다.
