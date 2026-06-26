# RENTCAR00 API 현재 기준 문서

## 문서 상태
- 상태: active current
- 용도: 현재 배포 기준 API 구조와 남은 운영 blocker 고정
- 기준 브랜치: 현재 작업 브랜치
- 운영 alias: `https://rentcar00.com`
- 관련 current 문서:
  - `docs/present/RENTCAR00_RESERVATION_CURRENT.md`
  - `docs/present/LOGIN_SYSTEM_CURRENT.md`
  - `docs/present/RENTCAR00_SIGNUP_PAGE_EXECUTION_READY_CURRENT.md`

---

## 0. 현재 결론

- 현재 `api/` 파일 수는 **7개**다.
- member 예약 API는 `api/member/bookings.js` 하나로 통일했다.
- admin 예약 API는 `api/admin/bookings.js` 하나로 통일했다.
- 관리자 예약목록은 최신 IMS sync 상태를 함께 내려준다.
- 로컬 빌드 및 운영 배포 확인을 마쳤다.
- 현재 핵심 blocker 는 **Solapi 운영 ENV 미설정**이다.

---

## 1. 현재 API 파일 목록

### 1. `api/search-cars.js`
- 차량 검색

### 2. `api/car-detail.js`
- 차량 상세

### 3. `api/auth/[action].js`
- `GET /api/auth/me`
- `POST /api/auth/signup`

### 4. `api/auth/otp/[action].js`
- `POST /api/auth/otp/send`
- `POST /api/auth/otp/verify`

### 5. `api/guest-bookings/[action].js`
- `POST /api/guest-bookings/create`
- `POST /api/guest-bookings/lookup`
- `POST /api/guest-bookings/cancel`

### 6. `api/member/bookings.js`
- 회원 예약 목록 / 상세 / 취소

### 7. `api/admin/bookings.js`
- 관리자 예약 목록
- 확정 대상 조회
- 확정 실행
- 취소 실행
- 목록 상단 IMS sync 상태용 데이터 포함

---

## 2. 제거된 API

아래 파일은 정리 완료로 제거됐다.

```text
api/member/bookings/[reservationCode].js
api/member/bookings/[reservationCode]/cancel.js
api/admin/booking-confirm.js
api/admin/booking-cancel.js
```

---

## 3. 현재 운영 체크 포인트

### 완료
- API 7개 구조 정리 완료
- 구 API 호출 제거 완료
- admin confirm/cancel/list 운영 배포 반영 완료
- IMS sync 상태 조회를 admin bookings 응답에 포함 완료

### 남은 것
- Solapi 운영 ENV 설정
- OTP 실발송 확인
- signup OTP → 회원가입 end-to-end 확인

---

## 4. 다음 우선순위

1. Solapi 운영 ENV 설정
2. OTP 실발송 확인
3. signup end-to-end 확인
4. 결제/웹훅 추가 전 함수 수 정책 재점검

---

## 5. 한 줄 결론

현재 API 구조 정리는 끝났다.
남은 핵심은 **OTP 운영 설정과 실제 회원가입 흐름 검증**이다.
