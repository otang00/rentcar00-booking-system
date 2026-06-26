# RENTCAR00_ADMIN_MENU_CURRENT

## 문서 상태
- 상태: active present
- 용도: 관리자 메뉴 1차 실행 전 기준 문서
- 기준 브랜치: `feat/db-preview-home`
- 연관 current 문서:
  - `docs/present/RENTCAR00_RESERVATION_CURRENT.md`
  - `tasks/task_20260422_admin_menu_preflight.md`

---

## 1. 목적
현재 살아있는 예약과 확정대기 예약을 운영자가 누락 없이 확인할 수 있는 관리자 메뉴 최소 구조를 정의한다.

## 2. 이번 범위
- 구현 전 설계/검증만 진행한다.
- 관리자 메뉴 1차 범위는 `조회 + 필터 + 검색 + 상세/확정 진입` 까지로 본다.
- 수정/수동상태변경/환불처리/배차처리는 1차 범위에서 제외한다.

## 3. 현재 구현된 기반
1. 예약 원장: `booking_orders`
2. 예약 생성 상태: `confirmation_pending + pending`
3. 메일 확정 처리: `/admin/booking-confirm`
4. 확정 후 상태: `confirmed_pending_sync + paid`
5. 회원 예약내역/상세/취소 화면
6. 비회원 예약조회/취소 화면
7. 상태 이벤트 로그: `reservation_status_events`
8. 차량번호 저장: `pricing_snapshot.carNumber`

## 4. 현재 비어 있는 운영 기능
1. 운영자 전체 목록 없음
2. 살아있는 예약 한눈 보기 없음
3. 상태별 필터 UI 없음
4. 차량번호 중심 검색 없음
5. 메일 외 누락 방지용 대기함 없음
6. 관리자 진입 메뉴 없음

## 5. 관리자 메뉴 1차 원칙
1. 운영자가 가장 먼저 봐야 하는 것은 `확정대기` 다.
2. 그 다음은 `현재 살아있는 예약` 이다.
3. 차량번호는 운영상 가장 중요한 표시 필드다.
4. 시스템 내부 충돌 검증 키는 기존 `car_id / source_car_id` 를 유지한다.
5. 메일 링크 방식은 유지하되, 관리자 메뉴가 운영 기준 화면이 된다.

## 6. 1차 화면 구성 제안
### 메뉴명
- `예약관리`

### 기본 탭
- `확정대기`
- `살아있는 예약`
- `취소 예약`

### 기본 검색
- 차량번호
- 예약번호
- 고객명

### 기본 행 액션
- 상세 보기
- 예약 확정(확정대기만)
- 메일 링크 재확인용 상세 이동

## 7. 살아있는 예약 정의 후보
### 권장안
- `confirmation_pending`
- `confirmed_pending_sync`
- `confirmed`
- `in_use`

### 제외
- `cancelled`
- `completed`

## 8. 데이터 소스 기준
### 목록 기준 테이블
- `booking_orders`

### 차량번호 표시 기준
- 1순위: `pricing_snapshot.carNumber`
- 2순위: `cars.car_number` join 또는 보조 보정

### 상태 표시 기준
- `src/services/bookingViewModel.js` 기준 재사용 권장

## 9. 가장 중요한 연결점
1. 현재 member API 는 자기 예약 전용이라 관리자 목록으로 재사용하면 안 된다.
2. 관리자 목록 API 는 별도 경로로 분리해야 한다.
3. `/admin/booking-confirm` 는 현재 링크 기반이라 추후 role 보호를 덧씌울 수 있게 독립 유지가 낫다.
4. 목록과 상세의 상태 라벨은 동일한 변환 규칙을 써야 한다.
5. 차량번호는 메일/목록/상세에서 같은 우선순위로 보여야 한다.

## 10. 구현 전 잠글 결정
1. 목록 API 경로
2. 상태 필터 세트
3. 기본 정렬
4. 검색 파라미터 규칙
5. 카드형/테이블형 UI 선택
6. 권한 도입 순서

## 10-1. 이번 문서에서 잠그는 권장 기준
1. 경로
   - 관리자 목록: `/admin/bookings`
   - API: `GET /api/admin/bookings`
2. 기본 탭
   - `확정대기`
3. 상태 그룹
   - pending: `confirmation_pending`
   - active: `confirmation_pending`, `confirmed_pending_sync`, `confirmed`, `in_use`
   - cancelled: `cancelled`
4. 기본 정렬
   - `pickup_at asc`, tie-breaker `created_at desc`
5. 검색 규칙
   - 차량번호: contains
   - 예약번호: exact 우선
   - 고객명: contains
6. 1차 UI 형식
   - 모바일 대응을 위해 카드형 우선, 데스크톱에서도 동일 컴포넌트 재사용 권장
7. 1차 액션
   - 상세 보기
   - 확정대기 건 확정
   - 수정/삭제/환불/배차 처리 제외

## 11. 권장 실행 순서
1. 살아있는 예약 정의 잠금
2. 관리자 목록 API contract 잠금
3. UI 구조 잠금
4. 회귀 검증 시나리오 잠금
5. 그 다음 구현 착수

## 11-1. 구체적 실행안
### phase 1. 조회 기준 잠금
- 산출물
  - 상태 그룹 상수
  - 검색 필드 규칙
  - 차량번호 우선순위 규칙
- 종료 조건
  - 목록/상세/메일의 상태 기준이 문서상 일치

### phase 2. API 설계
- 산출물
  - `GET /api/admin/bookings` request/response contract
  - pagination 기본값
  - empty/error response 규칙
- 종료 조건
  - member/guest/admin 각 API 책임이 분리됨

### phase 3. UI 설계
- 산출물
  - `/admin/bookings` 와이어 기준
  - 탭, 검색, 액션 배치안
  - 모바일 표시 우선순위
- 종료 조건
  - 차량번호, 상태, 대여일시가 첫 화면에서 보임

### phase 4. 연결 설계
- 산출물
  - 목록 → 상세/확정 연결 규칙
  - 기존 `/admin/booking-confirm` 재사용 범위
- 종료 조건
  - 메일 링크 흐름과 관리자 메뉴 흐름이 충돌하지 않음

### phase 5. 권한 설계
- 산출물
  - 1차 링크 기반 유지 범위
  - 2차 `otang00` admin role 도입 포인트
- 종료 조건
  - 추후 권한 추가 시 경로/컴포넌트 재작업 최소화

### phase 6. 구현 전 회귀 검증 계획
- 산출물
  - 예약 생성, 확정, 취소, 조회 기준 시나리오
- 종료 조건
  - 기존 회원/비회원/메일 흐름에 영향 포인트가 전부 목록화됨

## 11-2. API 응답 최소 필드
- `id`
- `reservationNumber`
- `carNumber`
- `carName`
- `customerName`
- `pickupAt`
- `returnAt`
- `bookingStatus`
- `paymentStatus`
- `createdAt`
- `canConfirm`
- `detailPath`

## 11-3. 연결상 주의점
1. `bookingViewModel` 의 상태 라벨 규칙을 관리자 메뉴도 재사용해야 한다.
2. 차량번호는 `pricing_snapshot.carNumber` 우선 사용이 안전하다.
3. 오래된 예약에 차량번호가 비어 있으면 fallback 규칙이 필요하다.
4. `confirmed_pending_sync` 는 운영상 살아있는 예약에서 빠지면 안 된다.
5. 관리자 목록은 member API 를 확장하지 말고 별도 API 로 유지해야 한다.

## 12. 구현 전 검증 포인트
- 메일 링크 기반 확정이 관리자 메뉴 도입 후에도 그대로 동작하는가
- 회원/비회원 조회와 관리자 조회가 역할 충돌 없이 분리되는가
- 상태 그룹 정의가 가용성 차단 규칙과 충돌하지 않는가
- 차량번호를 운영자가 계속 동일 위치에서 확인할 수 있는가
- 향후 `otang00` admin role 추가 시 API/화면을 다시 갈아엎지 않아도 되는가

## 13. 현재 권장 결론
- 관리자 메뉴는 지금 바로 착수할 가치가 있다.
- 다만 이번 턴에서는 구현하지 않는다.
- 먼저 `목록 기준 / 상태 그룹 / 검색 기준 / 권한 도입 순서` 를 문서로 잠그고 들어간다.
