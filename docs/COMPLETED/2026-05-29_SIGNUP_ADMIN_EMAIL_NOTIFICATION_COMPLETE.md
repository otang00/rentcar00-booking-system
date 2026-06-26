# Signup Admin Email Notification Complete

## 완료 범위
- 회원가입 성공 시 관리자에게 신규 회원가입 알림 이메일을 발송하도록 연결했다.
- 기존 예약 알림 SMTP 설정과 전송기를 재사용한다.
- 알림 메일 실패가 회원가입 성공 흐름을 막지 않도록 실패는 로그만 남긴다.

## 변경 파일
- `server/email/signupNotificationEmail.js`
- `server/email/sendSignupNotificationEmail.js`
- `api/auth/[action].js`

## 동작 기준
- 회원가입 API에서 Supabase Auth 사용자 생성과 `profiles` upsert가 성공한 뒤 알림 메일 발송을 시도한다.
- 수신자는 기존 `BOOKING_EMAIL_TO` 설정을 사용한다.
- 발신자/SMTP는 기존 예약 알림과 같은 `BOOKING_EMAIL_FROM`, `BOOKING_EMAIL_FROM_NAME`, `SMTP_*` 설정을 사용한다.
- 이메일 본문에는 이름, 휴대폰, 이메일, 주소, 마케팅 동의, 가입시각을 포함한다.
- 생년월일은 관리자 알림 본문에 포함하지 않는다.

## 검증
- `node --check server/email/signupNotificationEmail.js` 통과
- `node --check server/email/sendSignupNotificationEmail.js` 통과
- `node --check 'api/auth/[action].js'` 통과
- `npm run build` 통과

## 남은 리스크 / 후속
- 실제 SMTP 발송 성공은 운영 환경의 `BOOKING_EMAIL_TO`, `BOOKING_EMAIL_FROM`, `SMTP_*` 값에 의존한다.
- 운영 `.env` 값은 이번 작업에서 수정하지 않았다.
- 관리자 알림 수신처를 예약 알림과 분리하려면 별도 phase에서 `SIGNUP_EMAIL_TO` 같은 전용 env를 추가하는 것이 안전하다.
