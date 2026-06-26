# 2026-05-28 목록/상세 CSS 재정리 Phase

## 목적
현재 프리뷰와 거의 동일한 화면을 유지하면서, 목록/상세 UI 변경 과정에서 누적된 CSS 꼬임과 임시 override를 정리한다.

## 기준점
- 기능/API/DB/env/결제 로직은 수정하지 않는다.
- 현재 목록/상세 UI 방향은 유지한다.
- 딜리버리 모달, 날짜/컬러프리뷰 모달, 검색/상세 스타일의 책임 구역을 분리한다.
- 임시 주석(`Final`, `Late override`, `legacy`)과 불필요한 `!important`를 제거한다.
- 각 단계는 `npm run build`, `git diff --check`, grep 검색으로 검증한다.

## CSS 책임 구역
- `src/styles/components/delivery-modal.css`: 딜리버리 지역선택 모달 전용
- `src/styles/components/color-preview-modal.css`: 컬러프리뷰/날짜/연령 모달 전용
- `src/styles/components/modal.css`: 공통 모달/backdrop/기타 남은 모달 기본 스타일
- `src/styles/components/car-card.css`: 검색 목록 차량 카드
- `src/styles/search.css`: 검색 결과 페이지 조합, 검색 요약, 상태카드
- `src/styles/pages/detail.css`: 차량 상세, 예약 폼, 예약 확인창
- `src/styles/pages/landing.css`: 랜딩 전용 hero/search-card만 담당

## Phase
1. 딜리버리 모달 CSS 분리
2. 컬러프리뷰/날짜 모달 CSS 분리
3. 검색/상세 스타일 경계 정리
4. 최종 검증 및 프리뷰 배포

## 검증 체크리스트
- `Final`, `Late override`, `legacy.css`, `search-inline-reset` 잔여 검색
- 딜리버리 selector가 delivery 전용 파일 중심으로 위치
- 랜딩 파일이 딜리버리 모달을 직접 제어하지 않음
- `npm run build` 통과
- `git diff --check` 통과
- 빌드 산출 JS/CSS 용량 보고

## 중단 조건
- 현재 프리뷰와 화면 차이가 크게 발생
- PC/모바일 딜리버리 모달 중 하나라도 명확히 깨짐
- 기능 로직 변경 필요 발생
- 빌드 실패
