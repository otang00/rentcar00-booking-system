# RENTCAR00 OTP 보안 보강 current

## 문서 상태
- 상태: active current
- 용도: signup OTP 운영 전 보안 점검 결과와 보강 항목을 1장으로 잠금
- 기준 시점: 2026-04-26

---

## 0. 한 줄 결론

현재 signup OTP는 **기본 보안축은 구현됨** 상태다.
운영 전에는 **IP/번호 rate limit, IP·UA 해시 저장, 로그/에러 응답 정리**가 추가로 필요하다.

---

## 1. 점검 결과 요약

### 완료
1. OTP 생성은 `crypto.randomInt()` 사용
2. verification token은 `crypto.randomBytes()` 사용
3. OTP hash는 `PHONE_OTP_SECRET` 기반 HMAC 사용
4. hash 입력값에 `purpose + phone + otp` 포함
5. OTP 원문 DB 저장 안 함
6. verification token 원문 DB 저장 안 함
7. signup submit 시 verification token 서버 재검증 수행
8. signup submit 시 purpose=`signup` 확인
9. signup submit 시 token phone 과 제출 phone 일치 확인
10. signup 성공 후 `status='consumed'`, `consumed_at` 처리로 재사용 차단
11. OTP 만료 후 verify 차단
12. OTP 실패 횟수 최대 5회, 초과 시 `blocked`
13. Solapi env는 서버 전용 사용
14. profile 저장 시 `phone`, `phone_verified`, `phone_verified_at`를 서버에서 확정
15. 프론트 인증완료 상태만 믿지 않고 signup 서버에서 다시 검증

### 부분 충족
16. verification token 1회용은 사실상 충족하지만, 기준 문구는 `used_at`인데 구현은 `consumed_at`
17. OTP 원문은 DB/URL에 남지 않지만, 운영 로그 마스킹 정책은 코드로 명시 강화 필요
18. OTP 에러 응답은 동작은 안전한 편이지만, `otp_not_found / otp_mismatch / otp_expired / otp_blocked` 구분이 다소 자세함
19. `PHONE_OTP_SECRET`는 서버 전용이나, 운영/개발 분리와 최소 길이 기준은 문서/가드 추가 필요

### 미구현
20. 동일 번호 + 동일 IP 기준 시간/일 단위 rate limit 없음
21. 같은 IP에서 여러 번호 발송 패턴 제한 없음
22. `phone_verifications`에 `ip_hash`, `user_agent_hash` 없음
23. 요구 기준의 `used_at` 컬럼 없음 (`consumed_at`로 대체 중)
24. OTP 실패/발송 로그의 마스킹 저장 정책 미구현

---

## 2. 운영 전 필수 보강

### P0
1. 동일 번호/동일 IP 시간·일 단위 rate limit 추가
2. 같은 IP에서 여러 번호 발송 패턴 제한 추가
3. `phone_verifications` 또는 별도 audit 구조에 `ip_hash`, `user_agent_hash` 저장
4. 운영 로그에 OTP 원문 금지, 전화번호 마스킹 강제
5. 에러 응답 문구를 과도한 상태 노출 없이 재정리

### P1
6. `consumed_at` vs `used_at` 네이밍 기준 통일
7. `PHONE_OTP_SECRET` 최소 길이/랜덤성 검증 추가
8. 개발/운영 secret 분리 기준 문서화

---

## 3. 구현 방식 판단

### 바로 구현 가능한 것
- `ip_hash`, `user_agent_hash` 컬럼 추가
- signup / otp API에서 해시 저장
- 로그 마스킹 유틸 추가
- 에러 응답 문구 축소
- `used_at` 기준으로 네이밍 정리 또는 문서 기준 통일

### 설계 결정 필요한 것
- rate limit 저장소를 DB로 할지 Redis로 할지
- IP 추출 기준(`x-forwarded-for`)을 어디까지 신뢰할지
- OTP 실패 로그를 DB audit로 남길지 서버 로그로만 남길지

---

## 4. 현재 권장 실행 순서

1. 스키마 확장: `ip_hash`, `user_agent_hash`, 필요 시 `used_at` 정리
2. send API rate limit 강화
3. verify/signup 로그 마스킹 및 에러 응답 축소
4. signup end-to-end 재검증
5. Solapi 운영 env 반영 후 실발송 테스트

---

## 5. 최종 판정

현재 OTP는 **개발 기준으로는 동작 가능**하다.
하지만 **운영 보안 기준으로는 추가 보강 후 오픈 권장** 상태다.
