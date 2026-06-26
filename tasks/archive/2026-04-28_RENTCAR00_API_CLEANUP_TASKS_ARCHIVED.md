# RENTCAR00 API cleanup tasks

## 목적
현재 API 7개 구조를 기준으로, 남은 운영 확인과 후속 확장 포인트를 고정한다.

## 현재 기준
- 기준 커밋 전 상태: `35deb45`
- 운영 alias: `https://rentcar00.com`
- 현재 API 파일 수: 7
- 현재 핵심 blocker: Solapi 운영 ENV 미설정

---

## 완료
### member 예약 API 중복 정리
완료 내용:
- `api/member/bookings.js` 를 기준 API로 확정
- 아래 중복 라우트 제거
  - `api/member/bookings/[reservationCode].js`
  - `api/member/bookings/[reservationCode]/cancel.js`

### admin 예약 API 통합
완료 내용:
- `api/admin/bookings.js` 로 목록/확정대상조회/확정/취소 통합
- 아래 구 라우트 제거
  - `api/admin/booking-confirm.js`
  - `api/admin/booking-cancel.js`

---

## 우선순위 1
### 운영 재배포 및 실응답 확인
할 일:
1. 프로덕션 재배포
2. admin confirm-target 응답 확인
3. admin confirm 응답 확인
4. admin cancel 응답 확인

완료 조건:
- 운영에서 새 admin API 경로 응답 정상

---

## 우선순위 2
### OTP 운영 준비 완료
할 일:
1. Vercel 운영 ENV에 Solapi 설정 반영
2. `/api/auth/otp/send` 실발송 확인
3. `/api/auth/otp/verify` 연계 확인
4. 회원가입 end-to-end 검증

완료 조건:
- 운영에서 실제 문자 수신 확인
- signup 제출까지 정상 연결

---

## 우선순위 3
### 다음 API 추가 원칙 유지
원칙:
1. Hobby 유지 시 함수 수를 먼저 계산한다.
2. 같은 도메인 축에서 라우트 스타일을 섞지 않는다.
3. member/admin 축은 `bookings.js` 중심으로 유지한다.
4. 운영 ENV 의존 기능은 배포 완료와 운영 가능을 구분한다.

---

## 우선순위 4
### 플랜 판단
선택지:
- Hobby 유지: 현재 압축 구조 유지
- Pro 전환: 추후 직관적 REST 구조 복원 검토

완료 조건:
- 결제/웹훅/API 확장 전에 플랜 전략 확정
