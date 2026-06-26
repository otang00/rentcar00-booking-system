# RENTCAR00_SECURITY_EXECUTION_CURRENT

## 문서 상태
- 상태: past
- 용도: 2026-04-28 기준 RENTCAR00_SECURITY_CURRENT 실행 완료 이력 문서
- 기준 브랜치: `feat/db-preview-home`
- 선행 기준 문서:
  - `docs/present/RENTCAR00_SECURITY_CURRENT.md`
  - `docs/present/RENTCAR00_RESERVATION_CURRENT.md`
  - `docs/present/LOGIN_SYSTEM_CURRENT.md`
- 보조 근거 문서:
  - `docs/past/present-history/2026-04-24_SECURITY_VERIFICATION_CHECKLIST_PAST.md`
- 보관 경로: `docs/past/present-history/2026-04-28_RENTCAR00_SECURITY_EXECUTION_CURRENT_PAST.md`

---

## 0. 문서 목적

이 문서는 보안 개선을 실제로 집행하기 위한 실행 문서다.
각 phase별로 아래 항목을 고정한다.

1. 목적
2. 범위
3. 실제 변경 파일
4. 선행 확인사항
5. 작업 순서
6. 꼬임 위험
7. 기능 상실 우려
8. 검증 기준
9. 롤백 기준
10. 완료 후 문서 업데이트 대상

원칙:
- 보안 수정은 이 문서를 기준으로 phase 단위로만 진행한다.
- phase 하나가 끝나기 전 다음 phase로 넘어가지 않는다.
- 한 phase 안에 서로 다른 성격의 보안 변경을 섞지 않는다.

---

## 진행 상태

- 완료:
  - Phase 1-A — 예약 완료 URL PII 제거
  - Phase 1-B — 게스트 lookup/cancel abuse 방어
  - Phase 1-C — 관리자 예약확정 토큰 만료/무효화
  - Phase 2-A — server privileged/public client 분리
  - Phase 2-B — secret fallback 정책 정리
  - Phase 3-A — 화면 PII 최소화
  - Phase 3-B — 메일/로그/event PII 최소화
  - Phase 3-C — localStorage 레거시 경로 정리 여부 결정
  - Phase 4-A — 보안 헤더 baseline 적용
  - Phase 4-B — CSP tightening + 외부 SDK 허용정책 조정
  - Phase 5-A — nodemailer 업그레이드
  - Phase 5-B — 최종 보안 회귀 점검 및 운영 체크리스트 확정
- 다음 실행 대기:
  - 없음
- 비고:
  - Phase 1-A 는 예약 완료 페이지 이동을 `completionToken` 기반으로 전환했고, 빌드 검증을 통과했다.
  - Phase 1-B 는 guest lookup/cancel 에 in-memory baseline rate limit, Retry-After, 실패 지연 응답을 적용했고, 빌드 검증을 통과했다.
  - Phase 1-C 는 booking confirm token 에 exp 를 추가하고, 만료 토큰을 410 상태로 거절하도록 변경했으며, 빌드 검증을 통과했다.
  - Phase 2-A 는 Supabase server client 를 privileged/public 으로 분리하고 민감 API 를 privileged client 로 전환했으며, 빌드와 unit test 를 통과했다.
  - Phase 2-B 는 booking confirm/detail/complete token 의 secret fallback 을 제거하고 목적별 단일 secret 로 fail-closed 되도록 정리했으며, 빌드와 unit test 를 통과했다.
  - Phase 3-A 는 예약/회원/관리 응답 serializer 기준에서 휴대폰/생년월일 마스킹을 적용했고, 빌드 검증을 통과했다.
  - Phase 3-B 는 관리자 메일 본문에서 전화번호/생년월일/상세주소를 최소화했고, 빌드 검증을 통과했다.
  - Phase 3-C 는 미참조 localStorage guest reservation 유틸이 dead code 임을 확인하고 제거했으며, 빌드 검증을 통과했다.
  - Phase 4-A 는 `vercel.json` 에 Referrer-Policy, Permissions-Policy, X-Frame-Options, X-Content-Type-Options 를 추가했고, JSON 파싱 및 빌드 검증을 통과했다.
  - Phase 4-B 는 CSP baseline 을 추가해 Kakao/Supabase/self origin 범위를 명시했고, JSON 파싱 및 빌드 검증을 통과했다.
  - Phase 5-A 는 `nodemailer` 를 `8.0.5` 로 상향했고, `npm audit --omit=dev` 결과 prod high/critical 0건을 확인했다.
  - Phase 5-B 는 전체 빌드 검증과 단계별 current 문서 갱신을 완료했다.

---

## 최종 검증 결과

- `npm run build` 통과
- `node --test server/supabase/__tests__/createServerClient.test.js` 통과
- `npm audit --omit=dev` 결과 prod 취약점 0건
- `vercel.json` JSON 파싱 통과
- 예약 완료 URL의 직접 PII query 제거 확인
- guest lookup/cancel 보호 계층 추가 확인
- admin confirm token exp 강제 확인
- privileged/public Supabase client 분리 확인
- booking 관련 응답/메일의 PII 최소화 반영 확인

---

## 1. 전체 실행 순서

### 실행 순서 고정
1. Phase 1-A — 예약 완료 URL PII 제거
2. Phase 1-B — 게스트 lookup/cancel abuse 방어
3. Phase 1-C — 관리자 예약확정 토큰 만료/무효화
4. Phase 2-A — server privileged/public client 분리
5. Phase 2-B — secret fallback 정책 정리
6. Phase 3-A — 화면 PII 최소화
7. Phase 3-B — 메일/로그/event PII 최소화
8. Phase 3-C — localStorage 레거시 경로 정리 여부 결정
9. Phase 4-A — 보안 헤더 baseline 적용
10. Phase 4-B — CSP tightening + 외부 SDK 허용정책 조정
11. Phase 5-A — nodemailer 업그레이드
12. Phase 5-B — 최종 보안 회귀 점검 및 운영 체크리스트 확정

### 실행 우선순위 원칙
- PII 직접 노출 > abuse 가능성 > 장기 유효 토큰 > 권한경계 > 운영 보안헤더 > 공급망
- 운영자가 쓰던 경로를 완전히 끊는 변경은 항상 fallback/안내문/오류 UX를 같이 준비한다.

---

## 2. Phase 1-A — 예약 완료 URL PII 제거

### 목적
- 주소창, 브라우저 히스토리, 리퍼러 경로에 고객 이름/휴대폰번호/생년월일이 남지 않게 한다.

### 범위
- 예약 생성 직후 완료 페이지 이동 방식 변경
- 완료 페이지 조회 계약 변경
- URL query 기반 PII 전달 제거

### 실제 변경 파일
- `src/components/CarDetailSection.jsx`
- `src/pages/ReservationCompletePage.jsx`
- 필요 시 신규 API 또는 기존 예약 조회 API 계약 변경
- 필요 시 서버 token 유틸

### 선행 확인사항
- 완료 화면이 현재 어떤 데이터만 필요로 하는지 필드 확정
- 새로고침 허용 정책 확정
- 완료 토큰 1회성/단기 만료 정책 확정

### 권장 구현 방향
- 서버가 예약 생성 성공 시 `completionToken` 을 함께 반환
- 프론트는 `/reservation-complete?token=...` 또는 더 안전한 state 기반 경로로 이동
- 완료 페이지는 token 으로 서버 조회
- token 은 단기 만료 + 예약 1건에만 귀속

### 작업 순서
1. 완료 화면 필요 데이터 확정
2. completion token payload 설계
3. 서버 발급 경로 추가
4. 완료 페이지 조회 경로 전환
5. 기존 query PII 전달 제거
6. 실패/만료 UX 추가

### 꼬임 위험
- 예약 생성 응답 shape 변경으로 프론트 호출부 연쇄 영향 가능
- 완료 페이지 직접 접근 처리와 예약 상세 조회 로직 혼선 가능

### 기능 상실 우려
- 예약 직후 완료 페이지가 비어 보일 수 있음
- 새로고침 시 token 만료 정책 때문에 고객 혼선 가능

### 검증 기준
- URL에 고객 PII 0건
- 예약 생성 후 완료 화면 정상
- 새로고침 정책대로 동작
- 만료/위조 token 안전 거절
- 기존 예약 생성 기능 정상

### 롤백 기준
- 완료 페이지 진입 실패율 발생
- 예약 생성 성공 후 완료 화면 비정상 다수 발생

### 완료 후 문서 업데이트
- `docs/present/RENTCAR00_SECURITY_CURRENT.md`
- `docs/present/RENTCAR00_RESERVATION_CURRENT.md`

---

## 3. Phase 1-B — 게스트 lookup/cancel abuse 방어

### 목적
- 자동화 대입, 반복 조회, 취소 남용 가능성을 운영 가능한 수준으로 낮춘다.

### 범위
- guest lookup
- guest cancel
- 실패 누적 처리
- rate limit 정책

### 실제 변경 파일
- `api/guest-bookings/lookup.js`
- `api/guest-bookings/cancel.js`
- `server/booking-core/guestBookingService.js`
- 필요 시 rate limit 유틸/저장소

### 선행 확인사항
- rate limit 기준 단위(IP / fingerprint / reservationCode 유무) 확정
- 저장소 방식 확정(in-memory 금지 여부, Vercel 환경 적합성)
- 운영자 테스트 예외 정책 필요 여부 확정

### 권장 구현 방향
- 서버 공통 rate limit 유틸 도입
- lookup/cancel 공통 적용
- 실패 누적 시 일정 시간 지연 또는 임시 차단
- 응답 메시지는 존재 여부 힌트를 최소화

### 작업 순서
1. 정책 수치 확정
2. 공통 rate limit 계층 도입
3. lookup 적용
4. cancel 적용
5. 실패 응답 균질화
6. 로그/경보 포인트 추가

### 꼬임 위험
- NAT 환경에서 정상 사용자 차단
- lookup 과 cancel 의 메시지/정책 불일치
- 서버리스 환경에서 저장소 선택 미스 가능

### 기능 상실 우려
- 정상 고객이 짧은 시간에 여러 번 시도하다 차단될 수 있음
- 고객센터 테스트 시 운영자가 먼저 막힐 수 있음

### 검증 기준
- 정상 1~3회 요청 성공
- 반복 요청 차단 동작 확인
- 차단 후 해제 정책 확인
- lookup/cancel 동일한 보호 기준 확인

### 롤백 기준
- 정상 고객 차단 비율 과다
- 운영자/QA 기본 테스트도 진행 불가

### 완료 후 문서 업데이트
- `docs/present/RENTCAR00_SECURITY_CURRENT.md`

---

## 4. Phase 1-C — 관리자 예약확정 토큰 만료/무효화

### 목적
- 장기 유효 관리자 메일 링크를 제한하고 재사용 가능성을 줄인다.

### 범위
- booking confirm token 생성/검증
- 관리자 상세/확정 API
- 메일 링크 정책

### 실제 변경 파일
- `server/security/bookingConfirmToken.js`
- `server/booking-core/bookingConfirmationService.js`
- `server/email/bookingConfirmationEmail.js`
- `api/admin/booking-confirm.js`
- 필요 시 `api/admin/booking-cancel.js`

### 선행 확인사항
- 토큰 만료시간 정책 확정
- 이미 처리된 예약의 링크 처리 정책 확정
- 메일 재발송 필요 여부 확정

### 권장 구현 방향
- payload 에 `exp` 추가
- 검증 시 만료 체크
- 예약 상태가 처리 완료면 재사용 거절
- 1차는 nonce 저장 없이 상태 기반 무효화 우선

### 작업 순서
1. exp 정책 확정
2. token 유틸 변경
3. 검증 계층 변경
4. 관리자 조회/확정 회귀
5. 만료 UX 정리

### 꼬임 위험
- 기존 메일 링크 일괄 무효화 문제
- 관리자 처리 지연과 만료시간 충돌

### 기능 상실 우려
- 운영팀이 오래된 메일 링크를 눌렀을 때 처리 중단

### 검증 기준
- 신규 링크 정상
- 만료 링크 거절
- 처리 완료 예약 재사용 거절
- 로그인 필요 정책 유지

### 롤백 기준
- 정상 관리자 처리 흐름 중 링크 실패 빈발

### 완료 후 문서 업데이트
- `docs/present/RENTCAR00_SECURITY_CURRENT.md`
- 필요 시 관리자 후속 current

---

## 5. Phase 2-A — server privileged/public client 분리

### 목적
- 서버에서 어떤 API가 어떤 권한의 Supabase 키를 요구하는지 명확히 분리한다.

### 범위
- 공용 client 생성 정책
- 민감 API의 privileged client 강제

### 실제 변경 파일
- `server/supabase/createServerClient.js`
- 모든 API 엔트리포인트 호출부

### 선행 확인사항
- 각 API가 service role 필수인지 표로 고정
- search/detail 경로의 anon 허용 여부 명시

### 권장 구현 방향
- `createServerPrivilegedClient()`
- `createServerPublicClient()`
- 민감 API는 privileged 만 허용

### 검증 기준
- service role 누락 시 민감 API fail-closed
- search/detail 요구치 명확
- prod env checklist 와 일치

---

## 6. Phase 2-B — secret fallback 정책 정리

### 목적
- 토큰별 secret 경계를 분리하고 env 누락 시 fail-closed 로 고정한다.

### 범위
- detail token
- booking confirm token
- 공통 APP_SECRET fallback 여부

### 실제 변경 파일
- `server/security/detailToken.js`
- `server/security/bookingConfirmToken.js`
- 관련 테스트

### 권장 구현 방향
- 목적별 secret 분리
- 공용 fallback 최소화
- 누락 시 명시 오류

### 검증 기준
- 각 토큰이 독립 secret 사용
- env 누락 시 조용히 약화되지 않음

---

## 7. Phase 3-A — 화면 PII 최소화

### 목적
- 고객/회원/관리자 화면에서 필요한 최소 정보만 노출한다.

### 범위
- 예약 완료 화면
- 회원 예약 상세
- 관리자 상세

### 실제 변경 파일
- `server/booking-core/guestBookingUtils.js`
- `src/pages/ReservationCompletePage.jsx`
- `src/pages/MemberReservationDetailPage.jsx`
- `src/pages/AdminBookingConfirmPage.jsx`

### 권장 구현 방향
- serializer 단계에서 masking option 지원
- 화면 역할별 표시 수준 분리

### 검증 기준
- 업무상 필요한 정보 유지
- 과다노출 제거
- 문의 대응 가능 수준 유지

---

## 8. Phase 3-B — 메일/로그/event PII 최소화

### 목적
- 운영 채널에 남는 개인정보 범위를 줄인다.

### 범위
- 관리자 메일 본문
- reservation status event payload
- 에러 로그

### 실제 변경 파일
- `server/email/bookingConfirmationEmail.js`
- 관련 event 기록 코드

### 권장 구현 방향
- 메일은 링크 중심
- 로그는 식별자 중심
- 상세주소/생년월일 평문 제거 검토

### 검증 기준
- 메일만으로도 운영 흐름 유지
- 로그로 예약 추적 가능
- PII 과다노출 없음

---

## 9. Phase 3-C — localStorage 레거시 경로 정리 여부 결정

### 목적
- 브라우저 저장소에 고객정보를 남길 수 있는 레거시 경로의 실사용 여부를 판단하고 정리한다.

### 범위
- `src/services/guestReservations.js`
- 참조 호출부 전수 확인

### 선행 확인사항
- dead code 인지 실사용인지 확인
- 현재 배포 번들 포함 여부 확인

### 검증 기준
- 미사용이면 제거해도 영향 없음
- 사용 중이면 서버 기반 대체 경로 먼저 잠금

---

## 10. Phase 4-A — 보안 헤더 baseline 적용

### 목적
- 기본 보안 헤더를 먼저 적용해 클릭재킹/리퍼러/권한남용 노출면을 줄인다.

### 범위
- `vercel.json`
- 배포 설정

### 권장 헤더
- `Referrer-Policy`
- `Permissions-Policy`
- `X-Frame-Options` 또는 CSP `frame-ancestors`
- 기본 `Content-Security-Policy-Report-Only` 검토 가능

### 검증 기준
- 주요 화면 모두 정상
- iframe/embed 차단 의도대로 동작

---

## 11. Phase 4-B — CSP tightening + 외부 SDK 허용정책 조정

### 목적
- 외부 스크립트 허용 범위를 최소화한다.

### 범위
- Kakao map/chat SDK
- Vite asset
- 필요 시 Supabase 관련 origin

### 꼬임 위험
- 지도, 채팅, 번들 로드 실패
- preview/prod 도메인 차이

### 검증 기준
- CSP violation 점검
- 지도/카카오 기능 정상
- preview/prod 정책 분리 가능 여부 확인

---

## 12. Phase 5-A — nodemailer 업그레이드

### 목적
- 알려진 high 취약점 있는 메일 의존성을 정리한다.

### 범위
- `package.json`
- 메일 발송 경로

### 검증 기준
- 관리자 메일 성공
- 링크/한글/제목/본문 정상
- 오류 처리 정상

---

## 13. Phase 5-B — 최종 보안 회귀 및 운영 체크리스트 확정

### 목적
- phase별 수정 이후 전체 보안 상태를 다시 잠근다.

### 범위
- 전체 주요 플로우
- prod 헤더
- env 요구사항
- dependency 상태

### 산출물
- 최종 보안 체크리스트 현재화
- 운영 전 검증 리스트
- 긴급 롤백 기준

### 검증 기준
- P0/P1 항목 재점검 완료
- 배포 전/후 점검 절차 문서화
- 운영자가 따라할 수 있는 체크리스트 완성

---

## 14. 실행 준비 상태

현재 준비 완료
- 보안 현행 기준 문서 존재
- 근거 체크리스트 존재
- 수정 우선순위 확정
- phase별 변경 축 분리 완료

현재 추가 확인 필요
- Phase 1-A completion token 세부 계약
- Phase 1-B rate limit 저장소 선택
- Phase 1-C token 만료시간 정책
- Phase 4 CSP 허용 origin 목록
- Phase 5 nodemailer 상향 가능 버전 검토

---

## 15. 현재 권장 다음 액션

가장 먼저 실행 준비할 것은 `Phase 1-A` 다.
이유는 아래와 같다.

1. 현재 가장 직접적인 개인정보 노출 경로다.
2. 사용자 체감 기능은 유지하면서 리스크를 가장 크게 줄일 수 있다.
3. 이후 PII 최소화 phase 의 기준점이 된다.

그 다음은 `Phase 1-B`, 그 다음은 `Phase 1-C` 순으로 간다.
