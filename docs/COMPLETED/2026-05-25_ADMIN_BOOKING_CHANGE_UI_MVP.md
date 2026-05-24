# 2026-05-25 ADMIN BOOKING CHANGE UI MVP

## Completed
- 관리자 예약확인 화면에 예약 변경 접이식 패널을 추가했다.
- 변경 유형을 날짜 변경, 차량 변경, 날짜+차량 변경으로 제한했다.
- 차량 변경은 source car id 직접 입력이 아니라 차량번호/차량명/차량ID 검색 후 결과 선택으로 처리한다.
- 시작된 예약 강제 변경 UI를 제거하고 1차 MVP에서는 서버에서 차단한다.
- 예약 변경 저장은 `booking_orders`의 현재 날짜/시간/차량만 바꾼다.
- 가격 원장값은 유지한다.
  - `quoted_total_amount` 업데이트 없음
  - pricing snapshot 금액 필드 업데이트 없음
  - 차액 컬럼 추가 없음
- 고객 예약조회에는 변경된 현재 일정과 차량 표시명이 보이도록 `pricing_snapshot`의 차량 표시 필드만 갱신한다.
- 변경 전/후와 금액 유지 정책은 `reservation_status_events` payload에 기록한다.

## Verification
- `npm run build` 통과
- `git diff --check` 통과
- `node -c api/admin/bookings.js` 통과
- 가격 재계산/차액 저장 로직 제거 확인

## Not Included
- 배포
- DB migration
- 자동 결제/환불
- 차액 저장 컬럼
- 고객용 예약 변경 UI

## Remaining Risk
- 차량 검색은 같은 API 파일에서 1차 구현으로 처리되어 있어 데이터량이 커지면 별도 검색 최적화가 필요할 수 있다.
- 실제 운영 적용 전에는 테스트 예약으로 관리자 변경 플로우를 한 번 더 확인해야 한다.
