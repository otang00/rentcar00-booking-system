# 2026-06-15 Search Car Card Spec Right Align Complete

## 완료 범위
- 검색 결과 차량 카드에서 연식/연령/연료/인승 스펙 칩을 상단 오른쪽 빈공간에 우측 정렬했다.
- `바로예약 가능` 배지는 상단 왼쪽에 유지했다.
- 가격 행은 금액만 우측 정렬되도록 정리했다.

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
- 실제 모바일 화면에서 스펙 칩이 오른쪽 빈공간에 붙고 금액이 하단에서 잘 보이는지 육안 확인한다.
