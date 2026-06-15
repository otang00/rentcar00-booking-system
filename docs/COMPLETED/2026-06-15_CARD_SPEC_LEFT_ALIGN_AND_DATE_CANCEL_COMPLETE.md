# 2026-06-15 Card Spec Left Align and Date Cancel Complete

## 완료 범위
- 검색 결과 차량 카드의 스펙 한 줄을 왼쪽 정렬로 변경했다.
- 날짜 선택 모달에서 시작일만 선택된 상태로 같은 날짜를 다시 누르면 선택이 취소되도록 했다.
- 랜딩 검색 플로우와 검색조건 변경 플로우에 동일하게 적용했다.

## 변경 파일
- `src/styles/components/car-card.css`
- `src/components/LandingHero.jsx`
- `src/components/SearchConditionEditor.jsx`

## 유지한 기준
- 가격 계산/API/DB/검색 결과 데이터는 변경하지 않았다.
- 날짜 유효성 범위, 최대 검색 기간, 반납일 선택 규칙은 변경하지 않았다.
- UI 정렬과 선택 취소 분기만 추가했다.

## 검증
- `npm run build` 통과.
- `git diff --check` 통과.

## 남은 확인
- 프리뷰에서 스펙 줄 왼쪽 정렬과 시작일 재클릭 취소 UX를 모바일 기준으로 육안 확인한다.
