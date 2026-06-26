# 2026-04-28 RENTCAR00 예약 시스템 시뮬레이션 점검

## 목적
- 회원/비회원 예약 생성, 조회, 취소 흐름을 코드 기준으로 시뮬레이션한다.
- 충돌 가능 지점을 분리한다.
- 정책 변경 없이도 이해해야 하는 현재 동작을 잠근다.

## 기준 커밋
- `8608453`

## 확인 범위
- `src/components/CarDetailSection.jsx`
- `api/guest-bookings/[action].js`
- `api/member/bookings.js`
- `server/booking-core/guestBookingService.js`
- `server/booking-core/guestBookingUtils.js`
- `src/pages/GuestBookingsPage.jsx`

---

## 1. 현재 예약 생성 시뮬레이션

### 1-1. 비회원 예약 생성
- 로그인 안 한 사용자가 예약.
- 예약 OTP를 완료해야 생성 가능.
- 생성 레코드:
  - `booking_orders.user_id = null`
  - `booking_channel = website`
  - `booking_status = confirmation_pending`
  - `payment_status = pending`
- 조회용 보조키:
  - `booking_lookup_keys.customer_phone`
  - `booking_lookup_keys.customer_birth`

### 1-2. 회원 예약 생성 - 잠금 유지
- 로그인 회원이 상세 진입.
- 운전자 정보는 프로필 기준 잠금 상태.
- 수정하지 않으면 `member_profile_locked` 흐름.
- 서버는 `user_id = authUser.id` 로 저장.
- 즉 이 예약은 회원 예약으로 취급된다.

### 1-3. 회원 예약 생성 - 수정 후 OTP
- 로그인 회원이 `수정` 진입.
- 기존 운전자 정보와 OTP 상태 초기화.
- 다시 입력 후 예약 OTP 완료 필요.
- 생성 시에도 `user_id = authUser.id` 로 저장된다.
- 즉 운전자 정보가 다른 사람이어도 예약 소유권은 로그인 계정에 귀속된다.

---

## 2. 현재 조회/취소 시뮬레이션

### 2-1. 비회원 예약 조회
입력값:
- 이름
- 휴대폰번호
- 생년월일

매칭 순서:
1. `booking_orders.customer_name`
2. `booking_orders.customer_phone_last4`
3. `booking_lookup_keys` 해시 exact match
4. exact match 중 `user_id` 가 없는 예약을 첫 번째로 반환

해석:
- 비회원 예약은 회원/비회원 누구든 동일 정보면 조회 가능.
- 회원 예약은 exact match 여도 `user_id` 가 있으면 `member_booking_only` 로 차단.

### 2-2. 비회원 예약 취소
- 조회와 같은 매칭 로직을 사용.
- exact match 중 `user_id` 없는 예약 1건만 취소 대상으로 잡는다.
- 회원 예약이면 `member_booking_only` 로 차단한다.

### 2-3. 회원 예약 조회/취소
- `api/member/bookings.js`
- 항상 `user_id = authUser.id` 기준.
- reservationCode 단건 조회도 `user_id + reservationCode` 조건.
- 즉 계정 소유 예약만 보인다.

---

## 3. 시뮬레이션 결과 - 충돌 후보

### A. 높음 — 동일 인물의 다중 비회원 예약 충돌
상황:
- 같은 이름/휴대폰/생년월일로 비회원 예약이 여러 건 존재.

현재 동작:
- 비회원 조회는 가장 최근 guest exact match 1건만 반환.
- 비회원 취소도 같은 방식으로 1건만 취소 대상으로 잡는다.

리스크:
- older guest booking 을 UI에서 지정 조회할 수 없다.
- 사용자가 의도한 예약이 아닌 최근 예약이 먼저 잡힐 수 있다.
- 비회원 취소가 잘못된 예약에 적용될 가능성이 있다.

원인:
- 비회원 조회/취소 입력에 `reservationCode` 가 없음.
- `findBookingOrderByGuestLookup()` 가 exact match 중 첫 guest order 를 선택.

### B. 중간 — 회원이 다른 운전자 정보로 만든 예약의 소유권 불일치 체감
상황:
- 회원이 수정 후 다른 사람 정보로 예약.

현재 동작:
- 운전자 정보는 다른 사람일 수 있어도 `user_id = authUser.id` 로 저장.
- 따라서 그 운전자 본인은 비회원 조회로 접근 불가.
- 로그인한 회원 계정에서만 보인다.

리스크:
- “운전자”와 “예약 소유 계정”이 다를 수 있음.
- 운영/고객응대에서 누가 조회/취소 가능한지 혼선이 생길 수 있음.

### C. 중간 — 동일 신원으로 회원 예약 + 비회원 예약이 같이 있을 때 비회원 조회의 결과 모호성
상황:
- 같은 이름/휴대폰/생년월일로
  - 회원 예약 1건
  - 비회원 예약 1건 이상 존재

현재 동작:
- member booking 이 exact match 여도 guest booking 이 하나라도 있으면 guest booking 을 반환.
- guest booking 이 없고 member booking 만 exact match 이면 `member_booking_only` 로 차단.

리스크:
- 사용자는 “같은 정보인데 왜 어떤 건 보이고 어떤 건 안 보이지?”를 느낄 수 있다.
- member booking 존재 사실이 guest booking 뒤에 가려질 수 있다.

### D. 중간 — 비회원 예약의 회원 전환/귀속 없음
상황:
- 비회원으로 예약 후 나중에 회원가입/로그인.

현재 동작:
- 기존 guest booking 은 `user_id = null` 그대로 남는다.
- member bookings 목록에는 자동 노출되지 않는다.

리스크:
- 사용자는 같은 본인 정보라도 회원 예약내역에서 과거 비회원 예약을 기대할 수 있다.
- 현재 구조는 자동 귀속을 지원하지 않는다.

### E. 낮음(설계 인지 필요) — completion token 은 인증 분리와 별도 경로
상황:
- 예약 완료 후 발급된 completion token 을 보유.

현재 동작:
- completion token 경로는 auth 없이 완료 화면 조회 가능.

리스크:
- 토큰이 노출되면 해당 예약 완료 정보는 볼 수 있다.
- 현재는 의도된 설계로 보이지만, 토큰 취급을 민감정보처럼 다뤄야 한다.

---

## 4. 현재 코드 기준 해석

### 보안/권한 측면에서 이미 막힌 것
- 비회원 조회로 회원 예약 직접 열람: 차단됨
- 비회원 취소로 회원 예약 취소: 차단됨
- 회원 예약 단건 조회를 다른 회원이 보기: `user_id` 기준으로 차단됨

### 제품/운영 측면에서 아직 거친 것
- 비회원 다중 예약 분기
- guest → member 귀속 부재
- 회원이 다른 운전자로 만든 예약의 책임 주체/조회 권한 명확화

---

## 5. 권고 우선순위

### 우선순위 1
비회원 조회/취소에 `reservationCode` 를 추가하는 방향 검토.

이유:
- 현재 가장 현실적인 충돌 지점.
- 다중 예약/오취소/오조회 위험을 줄일 수 있다.

### 우선순위 2
회원이 다른 운전자 정보로 만든 예약의 정책을 명문화.

선택지:
- A. 지금처럼 로그인 계정 소유로 고정
- B. 운전자 identity 에도 일부 조회권 부여

### 우선순위 3
비회원 예약의 회원 귀속 기능 여부 결정.

---

## 6. 이번 점검에서 확인 못 한 것
- 실제 운영 데이터에서 동일 identity 다중 예약 빈도
- 사장님이 직접 보고한 “수정 안 한 회원인데 OTP 요구” 런타임 버그의 실세션 재현
- completion token 노출 경로 점검

즉 이번 문서는 정적 코드 시뮬레이션 결과다.
실운영 재현은 별도 검증이 필요하다.
