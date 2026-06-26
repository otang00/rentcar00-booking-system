# 2026-06-15 Search Car Card Badge Layout Complete

## 완료 범위
- 검색 결과 차량 카드에서 `바로예약 가능` 배지를 차량명 오른쪽 영역으로 이동했다.
- 배지가 별도 세로 줄을 차지하지 않도록 정리해 가격 표시 공간을 확보했다.
- 모바일 폭에서 스펙 칩과 가격을 grid로 분리해 가격이 우선 보이도록 조정했다.

## 변경 파일
- `src/components/CarCard.jsx`
- `src/styles/components/car-card.css`

## 유지한 기준
- 예약 가능 여부 판단 로직은 변경하지 않았다.
- 가격 계산/API/DB/상세 진입 `detailToken` 흐름은 변경하지 않았다.
- 카드 표시 레이아웃만 수정했다.

## 검증
- `npm run build` 통과.
- `git diff --check` 통과.

## 남은 확인
- 실제 모바일 화면에서 긴 차량명과 7자리 이상 금액 조합을 육안 확인하면 가장 확실하다.
