# 2026-05-14 RENTCAR00 AUTH HARDENING PARKED

## 문서 상태
- 상태: parked from current
- 목적: 비밀번호 재설정 + 로그인 실패 방어 current 초안을 보관하고, 우선순위가 다시 올라올 때 재개 기준으로 사용한다.

## 보관 이유
- 사장님 우선순위가 페이지 분리 / admin 분리 / 초기 로드 경량화로 이동했다.
- 따라서 인증 하드닝은 current 에서 내리고 보관 문서로 전환한다.

## 당시 active 범위
- 휴대폰 OTP 기반 비밀번호 재설정
- 로그인 실패 누적 방어
- CAPTCHA/Turnstile 검토
- 서버 로그인 API 래핑

## 당시 핵심 기준
### 비밀번호 재설정
- 이메일 reset link 가 아니라 휴대폰 OTP 기반으로 전환
- OTP 인증 후 reset session/token 발급
- reset session 유효 시에만 새 비밀번호 저장 허용

### 로그인 보호
- 로그인 시도는 서버 API 를 한 번 거치게 재구성
- 번호/IP 기준 실패 누적
- 성공 로그인 시 실패 카운터 초기화
- 잠금 중에는 Supabase 로그인 시도 전에 서버 차단

## 당시 잠근 정책
### 로그인 실패 방어 정책
- 같은 전화번호 기준 5회 실패: 5분 대기
- 같은 전화번호 기준 8회 실패: 15분 대기
- 같은 전화번호 기준 10회 이상 또는 같은 IP 기준 과다 실패: CAPTCHA 필수

### CAPTCHA 방향
- 1차 후보: Cloudflare Turnstile

## 재개 시 바로 볼 파일
- `src/pages/ForgotPasswordPage.jsx`
- `src/pages/ResetPasswordPage.jsx`
- `src/pages/LoginPage.jsx`
- `api/auth/[action].js`
- `api/auth/otp/[action].js`
- `server/auth/*`
- 필요 시 `vercel.json`

## 재개 시 확인할 것
1. 로그인 실패 기록을 저장할 기존 테이블 재사용 가능 여부
2. 별도 테이블/migration 필요 여부
3. Turnstile 도입 시 CSP 추가 필요 여부
4. 비밀번호 변경 후 기존 세션 강제 만료 여부

## 한 줄 결론
이 문서는 인증 하드닝 우선순위가 다시 올라올 때 이어서 쓸 parked 기준이다.
