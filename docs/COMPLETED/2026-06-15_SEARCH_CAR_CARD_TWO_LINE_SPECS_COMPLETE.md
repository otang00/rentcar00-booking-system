# 2026-06-15 Search Car Card Two Line Specs Complete

## 완료 범위
- 차량 카드 스펙 표시를 2줄 구조로 재배치했다.
- 상단 줄: 왼쪽 `바로예약 가능`, 오른쪽 `연식 + 나이`.
- 하단 가격 줄: 왼쪽 `연료 + 인승`, 오른쪽 가격.

## 변경 파일
- `src/components/CarCard.jsx`
- `src/styles/components/car-card.css`

## 유지한 기준
- 가격 계산/API/DB/검색 결과 데이터는 변경하지 않았다.
- 예약 가능 상태 판단 로직은 변경하지 않았다.
- UI 레이아웃만 수정했다.

## 검증
- `npm run build` 통과.
- `git diff --check` 통과.

## 남은 확인
- 프리뷰에서 긴 차량명/긴 연식 문구/7자리 이상 가격 조합을 모바일 폭에서 육안 확인한다.
