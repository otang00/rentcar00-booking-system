# RENTCAR00_ADMIN_AUTH_HARDENING_CURRENT

## 문서 상태
- 상태: completed → past
- 완료 시각: 2026-04-23 01:04 KST
- 용도: 관리자 상세 조회/확정/취소를 관리자 세션 기준으로 통일한 작업의 완료 기록
- 기준 브랜치: `feat/db-preview-home`
- 연관 current 문서:
  - `docs/present/LOGIN_SYSTEM_CURRENT.md`
  - `docs/present/RENTCAR00_RESERVATION_CURRENT.md`
- 관련 완료 문서:
  - `docs/past/present-history/2026-04-22-2251_RENTCAR00_ADMIN_MENU_CURRENT_PAST.md`
  - `docs/past/present-history/2026-04-23-0044_RENTCAR00_HEADER_ADMIN_ACTIONS_CURRENT_PAST.md`

---

## 완료 범위
이번 작업으로 아래가 완료됐다.

1. 관리자 상세 조회를 관리자 로그인 세션 기준으로 전환
2. 관리자 예약 확정을 관리자 로그인 세션 기준으로 전환
3. 관리자 예약 취소와 조회/확정의 권한 모델 통일
4. 메일 링크/목록 링크/로그인 복귀 흐름을 새 권한 기준에 맞게 정리
5. 관리자 시작 후 예약도 관리자 취소 허용으로 확장

---

## 실제 반영 결과
### 1. 관리자 상세/확정 API 권한 통일 완료
- `api/admin/booking-confirm.js`
- GET/POST 모두 access token + admin check 필수
- token 단독 접근 불가로 변경

### 2. 관리자 상세 페이지 권한 통일 완료
- `src/pages/AdminBookingConfirmPage.jsx`
- 비로그인 시 `/login?redirectTo=...` 로 이동
- 로그인 후 원래 `/admin/booking-confirm?token=...` 로 복귀
- 일반 회원은 접근 차단

### 3. 프론트 서비스 인증 헤더 연결 완료
- `src/services/adminBookingConfirmApi.js`
- 조회/확정 호출에도 Authorization 헤더 추가

### 4. 메일/목록 UX 문구 정리 완료
- `server/email/bookingConfirmationEmail.js`
- `src/pages/AdminBookingsPage.jsx`
- 운영 문구를 `관리자 로그인 후 확인/확정` 기준으로 정리

### 5. 관리자 시작 후 취소 허용 완료
- `server/booking-core/guestBookingUtils.js`
- `server/booking-core/guestBookingService.js`
- `api/admin/booking-cancel.js`
- 관리자 취소는 시작 후(`in_use`)도 허용
- 일반 사용자 취소 규칙은 유지
- 이벤트 타입 분리:
  - 시작 전: `admin_cancelled`
  - 시작 후: `admin_cancelled_after_start`

---

## 검증 결과
1. 로컬 빌드 통과
2. phase 단위 커밋 완료
3. 운영 배포 완료
4. 운영 도메인 alias 반영 확인

운영 URL
- `https://www.00rentcar.com`

---

## 관련 커밋
- `4ea5594` Lock current plan for admin auth hardening
- `68a3a20` Require admin session for admin booking confirm api
- `e4ebf12` Require admin auth on admin booking detail page
- `37c0cea` Align admin booking UX copy with admin auth flow
- `04f678f` Allow admin cancellation after pickup start

---

## 이번 작업으로 닫힌 정책
1. 관리자 상세 조회/확정/취소는 모두 관리자 세션 기준이다.
2. token 은 식별 수단으로만 쓰고, 단독 권한 수단으로 쓰지 않는다.
3. 메일 링크는 유지하되 로그인 후 원래 상세로 복귀한다.
4. 일반 사용자의 시작 후 온라인 취소 금지는 유지한다.
5. 관리자만 시작 후 취소를 허용한다.

---

## 후속으로 남긴 것
이번 작업에서는 아래는 하지 않았다.

1. `/admin/bookings/:id` 보호형 상세 경로 신설
2. token 구조 제거
3. 관리자 목록에서 즉시 취소 액션 추가
4. 이메일 화이트리스트 기반 관리자 판별을 role 기반으로 교체

이 항목들은 후속 current 에서 관리한다.
