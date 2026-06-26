# IMPLEMENTATION RULES

## 목적
남은 우선순위를 하나씩 처리할 때 범위가 새지 않게 잠근다.

## Canonical 경로
- 검색 endpoint: `api/search-cars.js`
- 검색 상태: `server/search/searchState.js`
- 검색 로직: `server/search-db/*`
- 프론트 검색 소비: `src/services/cars.js`
- 상세 endpoint: `api/car-detail.js`

## 절대 규칙
### Rule 1. 검색에서 partner 부활 금지
- 검색 문제를 해결하려고 partner 검색 경로를 다시 넣지 않는다.

### Rule 2. 우선순위 하나씩만 처리
- 현재 우선순위 외 범위를 같이 수정하지 않는다.
- delivery 작업 중 상세/예약까지 건드리지 않는다.

### Rule 3. 코드 수정과 DB 추가를 구분
- 먼저 현재 문제가 코드인지 데이터인지 판정한다.
- 코드로 못 푸는 항목만 DB 추가로 넘긴다.

### Rule 4. 응답 shape 선변경 금지
- `src/services/cars.js` 가 기대하는 shape 를 먼저 깨지 않는다.

### Rule 5. 검증 없는 종료 금지
- 수정/DB추가 후 같은 재현 쿼리로 반드시 다시 확인한다.

## DB 추가 원칙
- 최소 schema 부터 추가한다.
- 추가 이유와 대상 쿼리를 먼저 적는다.
- 우선순위는 delivery 관련 -> 가격표/운영 설정 순으로 본다.
- 가격 phase 에서는 차량 개별 row 기준 임시 가격표를 늘리지 않고, `PRICE_SYSTEM_PRESENT.md` 의 그룹 기준 스키마만 사용한다.
- 가격 계산은 비율 추정이 아니라 엑셀의 구간별 명시 가격을 우선 사용한다.
- 그룹명 매핑은 임시 문자열 하드코딩이 아니라 `ims_group_id` 기준으로 최종 잠근다.

## 금지
- 문제를 하드코딩으로 덮기
- partner 결과를 조용히 섞기
- 검색과 상세를 한 번에 같이 전환하기
