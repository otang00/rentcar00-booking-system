# 2026-06-15 Search Car Card Spec Single Row Complete

## 완료 범위
- 검색 결과 차량 카드에서 `바로예약 가능` 배지를 제거했다.
- 기존 배지 줄을 스펙 전용 한 줄로 바꿨다.
- `연식 / 나이 / 연료 / 인승`을 한 줄에 우측 정렬했다.
- 가격 줄은 가격만 우측 정렬되도록 단순화했다.

## 변경 파일
- `src/components/CarCard.jsx`
- `src/styles/components/car-card.css`

## 유지한 기준
- 가격 계산/API/DB/검색 결과 데이터는 변경하지 않았다.
- 예약 가능 여부 판단 로직은 변경하지 않았다.
- UI 표시 구조만 변경했다.

## 검증
- `npm run build` 통과.
- `git diff --check` 통과.
- 배지/상하단 분리 class 잔여 참조 없음 확인.

## 남은 확인
- 프리뷰에서 100만원대 금액과 스펙 한 줄이 모바일 폭에서 잘 보이는지 육안 확인한다.
