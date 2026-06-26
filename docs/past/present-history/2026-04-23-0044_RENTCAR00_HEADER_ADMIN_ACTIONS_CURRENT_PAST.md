# RENTCAR00_HEADER_ADMIN_ACTIONS_CURRENT

## 문서 상태
- 상태: completed; archive ready
- 용도: 헤더 상태 분기 + 관리자 예약목록/상세 액션 확장 완료 기록 문서
- 기준 브랜치: `feat/db-preview-home`
- 직전 완료 문서:
  - `docs/past/present-history/2026-04-23-0008_RENTCAR00_HEADER_CURRENT_PAST.md`
  - `docs/past/present-history/2026-04-22-2251_RENTCAR00_ADMIN_MENU_CURRENT_PAST.md`
- 연관 current 문서:
  - `docs/present/LOGIN_SYSTEM_CURRENT.md`
  - `docs/present/RENTCAR00_RESERVATION_CURRENT.md`

---

## 0. 이번 문서에서 잠그는 범위
이번 문서는 아래 3가지를 한 번에 잠근다.

1. 헤더 로그인 상태별 우측 메뉴 분기
2. 관리자 예약목록 → 관리자 상세 진입 구조
3. 관리자 상세에서 예약 확정 / 예약 취소 액션 추가 범위

이번 문서는 실행 준비용으로 시작했으며,
현재는 구현/커밋/배포/버그수정까지 완료된 상태다.

---

## 완료 결과
1. 헤더 상태 분기 반영 완료
   - 비로그인: `로그인 + 비회원 예약조회`
   - 회원: `예약목록 + 로그아웃`
   - 관리자: `관리자 예약목록 + 로그아웃`
2. 관리자 예약상세에 `예약 확정`, `예약 취소`, `관리자 예약목록` 복귀 버튼 반영 완료
3. 관리자 취소 API 추가 완료
4. 관리자 취소 시 raw/camelCase 키 불일치 버그 수정 완료
5. 빌드 검증 및 운영 배포 완료

## 구현 중 확인된 최종 원인 메모
- 관리자 취소 API에서 `cancelBookingOrder()` 에 serialize 된 booking 객체를 넘겨
  `booking_status / payment_status / pickup_at` 를 읽지 못하던 버그가 있었다.
- 수정 후에는 token lookup 결과의 raw DB row 를 `cancelBookingOrder()` 에 전달한다.

## 남은 후속 단계
1. 관리자 상세 조회/확정도 관리자 세션 기준으로 추가 보호할지 결정
2. 관리자 목록 카드에서 즉시 취소 버튼까지 둘지 결정
3. 필요 시 관리자 상세를 token 기반에서 관리자 보호형 상세 경로로 재구성

---

## 1. 완료 처리 후 넘기는 기존 범위
### 완료로 보는 항목
1. 공통 헤더 1종 통합
2. 워드마크 기준 헤더 정리
3. 모바일 한 줄 헤더 유지
4. 상세 페이지 결제 방식 선택 UI 비노출

### 이번 current 에서 제외하는 항목
1. 헤더 비주얼 재정의
2. 로고 자산 교체
3. 모바일 메뉴 시스템 재설계
4. 결제 시스템 실연동

---

## 2. 현재 코드 기준 확인 사실
### 2-1. 헤더
- 현재 헤더는 `src/components/Layout.jsx` 의 `Header` 단일 컴포넌트다.
- 현재는 로그인 여부만 보고 메뉴를 나눈다.
- 로그인 상태에서도 `비회원 예약조회` 가 유지된다.
- 관리자 전용 메뉴 분기는 아직 없다.

### 2-2. 회원 예약
- 회원 예약목록 경로: `/reservations`
- 회원 예약상세 경로: `/reservations/:reservationCode`
- 회원 취소 API 는 이미 있다.

### 2-3. 관리자 예약
- 관리자 목록 경로: `/admin/bookings`
- 관리자 상세 경로: `/admin/booking-confirm?token=...`
- 목록 화면은 있다.
- 상세 화면은 있다.
- 상세 화면의 현재 액션은 `예약 확정` 만 있다.
- 관리자 취소 전용 API 는 현재 프론트 서비스 레이어에 없다.

### 2-4. 관리자 판별
- 클라이언트: `src/utils/adminAccess.js`
- 서버: `server/auth/adminAccess.js`
- 기준: admin email whitelist

---

## 3. 이번 작업 목표
### 목표 A. 헤더 상태 분기 수정
- 비로그인: `로그인` + `비회원 예약조회`
- 회원 로그인: `예약목록` + `로그아웃`
- 관리자 로그인: `관리자 예약목록` + `로그아웃`

### 목표 B. 관리자 흐름 정리
- 관리자 로그인 시 헤더에서 바로 `/admin/bookings` 진입 가능
- 목록에서 상세 진입 가능
- 상세에서 `예약 확정`, `예약 취소` 가능

### 목표 C. 구현 순서 명확화
- 중간에 어디서 멈추고 검증할지 phase 단위로 고정
- 관리자 취소 API 유무를 phase 중간 리스크 게이트로 둔다

---

## 4. 핵심 리스크
### R1. 관리자 취소 API 부재 가능성
현재 확인된 것은 아래뿐이다.
- 관리자 목록 API: `GET /api/admin/bookings`
- 관리자 상세/확정 API: `/api/admin/booking-confirm`
- 회원 취소 API: `/api/member/bookings/[reservationCode]/cancel`
- 비회원 취소 API: `/api/guest-bookings/cancel`

즉, 관리자 상세에서 바로 쓰는 전용 취소 API 는 아직 보이지 않는다.

### R2. 관리자 상세가 현재 token 기반
`/admin/booking-confirm` 는 token 기반 조회/확정 구조다.
이 구조를 유지한 채 취소를 넣을지,
관리자 인증 보호를 더 얹을지 먼저 정해야 한다.

### R3. 헤더 메뉴 상태 분기와 권한 분기 결합
헤더는 렌더 시점에 다음을 같이 알아야 한다.
- 로그인 여부
- 관리자 여부
- 이동 경로 우선순위
잘못 넣으면 일반 회원에게 관리자 메뉴가 잠깐 보이거나,
관리자 로그인 직후 메뉴가 한 박자 늦게 바뀔 수 있다.

### R4. 한 줄 헤더 폭 유지
현재 헤더는 모바일 한 줄 고정 상태다.
`관리자 예약목록` 버튼은 텍스트가 길어서 폭 부담이 크다.
따라서 이번 범위에서는
- 버튼 라벨 길이,
- 버튼 padding,
- 폭 유지
를 같이 봐야 한다.

### R5. 상태 액션 충돌
관리자 상세에서
- `confirmation_pending` 에는 확정 가능
- `cancelled` 에는 확정 불가
- 이미 확정된 건 중복 확정 불가
- 취소 가능 상태 정의가 필요
이 조건을 문서상 먼저 잠가야 한다.

---

## 5. 리스크 게이트 포함 권장 phase

### Phase 0. 기준 잠금
#### 목적
이번 작업 범위와 멈춤 지점을 먼저 잠근다.

#### 산출물
- 본 current 문서
- phase별 종료 조건
- 리스크 게이트 정의

#### 종료 조건
- 승인 전 구현 금지 상태로 기준 문서가 잠김

---

### Phase 1. 헤더 상태 분기만 수정
#### 목적
로그인 상태별 메뉴를 올바르게 노출한다.

#### 구현 범위
- `src/components/Layout.jsx`
- 필요 시 `src/utils/adminAccess.js` 재사용 방식 정리

#### 실구현 리스트
1. `useAuth()` 에서 `user`, `profile` 기반 이메일 읽기
2. `isAdminEmail()` 로 관리자 여부 계산
3. 비로그인 메뉴 렌더 유지
4. 일반 회원 메뉴를 `/reservations` 로 교체
5. 관리자 메뉴를 `/admin/bookings` 로 교체
6. 로그인 후에도 `비회원 예약조회` 비노출
7. 로그아웃 동작 유지

#### 리스크
- 관리자 여부 계산 시점 지연
- 모바일 한 줄 폭 초과

#### 검증
- 비로그인 메뉴 확인
- 회원 로그인 메뉴 확인
- 관리자 로그인 메뉴 확인
- 모바일 360/390/430 폭 확인

#### 종료 조건
- 상태별 메뉴가 정확히 분기됨
- 헤더 한 줄 유지

---

### Phase 2. 관리자 상세 액션 구조 점검
#### 목적
관리자 상세에서 어떤 액션을 어떤 조건에 노출할지 잠근다.

#### 구현 범위
- `src/pages/AdminBookingConfirmPage.jsx`
- `src/services/adminBookingConfirmApi.js`
- 필요 시 신규 admin cancel service/API

#### 실구현 리스트
1. 관리자 상세의 현재 booking status 분기 정리
2. 확정 버튼 노출 조건 잠금
3. 취소 버튼 노출 조건 잠금
4. 처리 후 메시지/상태 갱신 방식 잠금
5. 목록 복귀 링크 기준 잠금

#### 리스크 게이트
- 관리자 취소 API 가 없으면 여기서 멈춤
- API 추가 필요 시 다음 phase에서 서버 작업 분리

#### 검증
- `confirmation_pending` 상세 진입 시 확정 가능 여부
- `cancelled` 상세 진입 시 버튼 비노출 여부
- 이미 확정된 건 중복 처리 방지

#### 종료 조건
- 상세 액션 규칙이 코드와 문서에서 일치

---

### Phase 3. 관리자 취소 API 추가 또는 연결
#### 목적
관리자 상세에서 예약 취소를 실제로 처리한다.

#### 구현 범위 후보
- 신규 `api/admin/booking-cancel` 또는
- 기존 `api/admin/booking-confirm` 확장 여부 판단
- `server/booking-core/guestBookingService.js` 의 `cancelBookingOrder` 재사용 가능성 검토

#### 실구현 리스트
1. token 기반 취소 허용 여부 결정
2. 관리자 인증 필요 여부 결정
3. 서버 route 추가 또는 기존 route 확장
4. `cancelBookingOrder` 재사용 연결
5. `requestedBy` / eventType 를 admin 용으로 분리
6. 응답 booking payload 정리
7. 프론트 cancel service 연결

#### 리스크
- 기존 member/guest cancel 규칙과 충돌 가능
- token 기반 상세에서 관리자 보호가 느슨할 수 있음

#### 검증
- 취소 성공 후 booking status 갱신
- payment status 가 기존 규칙대로 반영되는지 확인
- 취소 후 확정 버튼 비노출
- 중복 취소 방지

#### 종료 조건
- 관리자 상세에서 취소 동작 가능
- 상태 전이 규칙이 기존 시스템과 충돌하지 않음

---

### Phase 4. 관리자 목록 ↔ 상세 연결 검증
#### 목적
목록과 상세, 액션 후 상태반영을 한 흐름으로 검증한다.

#### 구현 범위
- `src/pages/AdminBookingsPage.jsx`
- `src/pages/AdminBookingConfirmPage.jsx`
- 관련 admin API

#### 실구현 리스트
1. 목록 → 상세 진입 링크 확인
2. 상세 처리 후 목록 재조회 시 상태 반영 확인
3. pending / active / cancelled 탭에서 이동 흐름 확인
4. 상세 하단 복귀 링크 정리

#### 검증
- pending 에서 상세 → 확정 후 active 반영
- pending 또는 active 에서 상세 → 취소 후 cancelled 반영
- 잘못된 token / 없는 예약 처리 확인

#### 종료 조건
- 관리자 운영 흐름이 한 사이클로 이어짐

---

### Phase 5. 최종 회귀 검증
#### 목적
기존 회원/비회원/관리자 흐름 충돌 여부를 확인한다.

#### 검증 리스트
1. 비로그인 헤더
2. 회원 로그인 헤더
3. 관리자 로그인 헤더
4. 회원 예약목록/상세/취소
5. 비회원 예약조회/취소
6. 관리자 예약목록/상세/확정/취소
7. 빌드 통과

#### 종료 조건
- 기존 사용자 흐름 회귀 없음

---

## 6. 이번 작업에서 수정될 가능성이 높은 파일 목록
### 프론트
- `src/components/Layout.jsx`
- `src/pages/AdminBookingsPage.jsx`
- `src/pages/AdminBookingConfirmPage.jsx`
- `src/services/adminBookingConfirmApi.js`
- 필요 시 `src/styles.css`

### 서버/API
- `api/admin/booking-confirm.js`
- 신규 admin cancel API 가능
- `server/booking-core/bookingConfirmationService.js`
- `server/booking-core/guestBookingService.js`
- 필요 시 `server/auth/adminAccess.js`

---

## 7. 이번 작업의 중간 멈춤 지점
아래 지점마다 구현을 멈추고 검증해야 한다.

1. **헤더 분기 반영 직후**
   - 메뉴가 상태별로 맞는지 확인
2. **관리자 상세 액션 규칙 반영 직후**
   - 버튼 조건이 맞는지 확인
3. **관리자 취소 API 연결 직후**
   - 상태 전이가 맞는지 확인
4. **목록/상세 연결 검증 직후**
   - 운영 플로우 전체 확인

즉, 이번 작업은 한 번에 밀지 않고
`헤더 → 상세 액션 → 취소 API → 전체 회귀`
순서로 끊어서 가는 것이 맞다.

---

## 8. 승인 전 최종 확인 사실
### 확인 완료
- 회원 예약목록/상세는 이미 존재
- 관리자 목록/상세는 이미 존재
- 관리자 확정은 이미 존재
- 관리자 취소 전용 연결은 아직 없음
- 헤더 상태 분기는 현재 요구와 불일치

### 승인 전 질문 없이 잠그는 판단
1. 관리자 로그인 시 헤더는 `관리자 예약목록 + 로그아웃`
2. 일반 회원 로그인 시 헤더는 `예약목록 + 로그아웃`
3. 비로그인만 `비회원 예약조회`
4. 관리자 상세에 `예약 확정 + 예약 취소` 를 넣는 방향은 맞음

### 승인 후 바로 실행 가능한 시작점
- Phase 1 헤더 분기 수정
- Phase 2 관리자 상세 액션 구조 정리

---

## 9. 현재 권장 결론
- 지금 바로 구현해도 되지만, 리스크 게이트 없이 한 번에 밀면 다시 꼬일 확률이 있다.
- 이번 작업은 `헤더 분기` 와 `관리자 상세 액션` 을 분리해서 실행해야 한다.
- 특히 `관리자 취소 API` 는 별도 게이트로 보고 중간에 멈춰 검증하는 구조가 맞다.
- 문서 기준은 이제 잠겼고, 다음은 승인 후 phase 단위 실행이다.
