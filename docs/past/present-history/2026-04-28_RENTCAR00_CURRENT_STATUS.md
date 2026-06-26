# RENTCAR00 current status

Last updated: 2026-04-28

## 배포 기준
- branch: `feat/db-preview-home`
- latest commit: `072d834` — `feat: list active guest bookings`
- production alias: `https://rentcar00.com`
- verified deployment url: `https://rentcar00-booking-system-ntxy5mtlk-otang00s-projects.vercel.app`

## 오늘 마무리된 범위
### 비회원 예약 조회/취소 구조 정리
- 비회원 조회는 단건 자동선택이 아니라 활성 예약 리스트 반환으로 변경됨.
- 비회원 취소는 identity 3종(이름/휴대폰/생년월일) + `reservationCode` 지정 방식으로 변경됨.
- 조회 노출 상태는 현재 아래 3개 기준으로 잠금.
  - `confirmation_pending`
  - `confirmed_pending_sync`
  - `confirmed`
- 완료/취소/이용중 예약은 비회원 조회 리스트에서 제외됨.

### 검증 완료
- 로컬 테스트 통과
  - `node --test server/booking-core/__tests__/guestBookingUtils.test.js`
- 프론트 build 통과
  - `npm run build`
- 프로덕션 실테스트 완료
  - 테스트 예약 3건 생성
  - lookup 응답 확인
  - 특정 예약번호 cancel 확인
  - 재조회 시 취소 예약 제외 확인
  - 테스트 데이터 삭제 확인 완료

## 현재 제품 기준
### 예약 상태 흐름
- 신규 예약 생성 기본값은 `confirmation_pending + pending`
- 관리자 확인 후 `confirmed_pending_sync + paid` 로 전환
- `confirmation_pending` 는 차량 가용성 차단 대상이며 온라인 취소 가능 상태로 유지

### 회원/비회원 기준
- 회원 예약은 `booking_orders.user_id` 로 귀속됨.
- 비회원 조회/취소는 guest 예약만 대상으로 함.
- 회원 예약은 비회원 조회/취소 경로로 처리하지 않음.

## 문서 운영 기준
- 정책/장기 기준은 `docs/policies/` 에 남긴다.
- 지금처럼 현재 상태와 다음 실행 준비 문서만 `docs/present/` 에 둔다.
- 완료된 current/task 문서는 archive 또는 past 로 내린다.

## 지금 시점 요약
현재 운영 상태는:
- 예약 생성: confirmation pending 기반 동작
- 비회원 조회/취소: 다중 예약 충돌 없이 동작
- 회원 귀속 구조: 연결 완료
- 프로덕션 반영: 완료
