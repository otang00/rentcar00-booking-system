# Search 30 Day Delivery Hotfix Complete

## 완료 범위
- 홈페이지 검색 API의 30일 제한 검증을 KST 기준으로 맞췄다.
- 반납일이 오늘 기준 30일째인 경우 production 서버 timezone 차이로 `invalid_search_query`가 나는 문제를 수정했다.
- 조건변경 모달에서 회사/딜리버리 지역 정보 조회가 실패하면 주소 선택 목록이 비는 문제를 줄이기 위해 company fallback 병합 함수를 추가했다.

## 변경 파일
- `server/search/searchState.js`
- `src/services/company.js`

## 동작 기준
- 서버 검색 검증은 `YYYY-MM-DD HH:mm` 값을 KST 벽시계 시각으로 해석한다.
- 30일 제한의 기준일도 KST 오늘 00:00 기준으로 계산한다.
- 회사 정보 조회 결과의 `deliveryCostList`가 비어 있을 때는 기존 fallback company의 목록을 유지한다.

## 검증
- 서버 validation 직접 확인: `2026-05-30 20:00 ~ 2026-06-29 19:00` 유효 처리
- `node --check server/search/searchState.js` 통과
- `npm run build` 통과

## 남은 리스크 / 후속
- production 배포 후 동일 조건 URL로 `/api/search-cars` 200 확인이 필요하다.
- 조건변경 모달 주소 목록은 production에서 실제 화면 확인이 필요하다.
