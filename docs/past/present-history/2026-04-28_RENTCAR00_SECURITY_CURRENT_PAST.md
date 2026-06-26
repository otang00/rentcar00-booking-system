# RENTCAR00_SECURITY_CURRENT

## 문서 상태
- 상태: active present
- 용도: rentcar00 예약/결제/고객정보 시스템 보안 현행 기준 문서
- 기준 브랜치: `feat/db-preview-home`
- 관련 문서:
  - `docs/past/present-history/2026-04-24_SECURITY_VERIFICATION_CHECKLIST_PAST.md`
  - `docs/present/RENTCAR00_RESERVATION_CURRENT.md`
  - `docs/present/LOGIN_SYSTEM_CURRENT.md`
  - `docs/past/present-history/2026-04-28_RENTCAR00_SECURITY_EXECUTION_CURRENT_PAST.md`
- 직전 보안 점검 근거 문서: `docs/past/present-history/2026-04-24_SECURITY_VERIFICATION_CHECKLIST_PAST.md`

---

## 0. 문서 목적

이 문서는 단순 점검 메모가 아니다.
현재 rentcar00 시스템을 **민감 시스템**으로 간주하고,
아래 4가지를 현행 기준으로 잠그는 문서다.

1. 현재 확인된 보안 이슈
2. 실제 수정해야 할 대상
3. 어떻게 수정할지에 대한 구현 방향
4. phase별 실행 순서와 기능 상실/꼬임 방지 검증 기준

이 문서는 **실제 코드 수정 전 기준 문서**다.
보안 수정은 이 문서의 phase, 종료조건, 리스크 검증 기준을 먼저 만족하는 방식으로만 진행한다.

---

## 1. 현재 보안 판단 기준

### 운영 기준
- 실제 결제/예약/고객정보가 연결된 시스템으로 본다.
- 치명적 위험(Critical) 0개를 목표로 한다.
- 높음(High) 위험도 운영 전 해소를 원칙으로 한다.
- 중간(Medium)도 민감정보 노출/권한 우회/자동화 악용과 연결되면 운영 전 해소 대상으로 본다.

### 보안 원칙
- URL, 로그, 메일, 브라우저 저장소에 고객 민감정보를 남기지 않는다.
- 관리자 기능은 인증 + 인가 + 재검증을 모두 통과해야 한다.
- 게스트 기능은 조회/취소 모두 abuse 방어가 있어야 한다.
- 토큰은 목적별로 분리하고, 만료와 무효화 전략이 있어야 한다.
- 환경변수와 공개키/비공개키 경계를 문서로 명확히 잠근다.
- 보안 헤더와 운영 설정은 코드와 동일한 중요도로 다룬다.

### 외부 SDK / CSP 최우선 규칙
- 외부 SDK, 지도, 주소검색, 인증 위젯을 추가/변경할 때는 기능 코드보다 먼저 `vercel.json` 의 CSP와 보안 헤더를 검토한다.
- CSP는 `script-src`, `connect-src`, `frame-src` 를 각각 분리해서 점검한다. 한 항목만 맞아도 통과로 보지 않는다.
- 외부 SDK는 1차 로더 도메인만 보고 허용 정책을 작성하면 안 된다. 실제 하위 로딩 도메인과 런타임 동작을 증거 기반으로 확인한다.
- 외부 서비스는 popup, iframe, redirect, postMessage 중 실제로 어떤 방식을 쓰는지 먼저 확인하고, 그 방식에 맞는 CSP를 연다.
- 보안 헤더 변경 직후에는 최소 테스트 페이지 + 실제 화면 + Safari 기준 검증을 모두 통과해야 한다.

### 외부 서비스 연동 확정 절차
- 새 외부 서비스(Toss, Stripe, Kakao, 지도, 인증, 주소검색 등)를 붙일 때는 먼저 아래 표를 잠근다.
  1. 로더 도메인 (`script-src`)
  2. 실제 API 호출 도메인 (`connect-src`)
  3. iframe 문서 도메인 (`frame-src`)
  4. 이미지/스타일/폰트 추가 도메인 (`img-src`, `style-src`, `font-src`)
  5. redirect/callback 경로
  6. popup/iframe/postMessage 사용 여부
- 허용 정책은 "서비스 이름" 단위가 아니라 "브라우저에서 실제 일어나는 동작" 단위로 설계한다.
- popup 으로 열리는 서비스도 내부적으로 iframe 을 쓸 수 있으므로 popup 성공만으로 완료 처리하면 안 된다.
- 최종 완료 기준은 아래 4개를 모두 만족하는 것이다.
  - 창/레이어/iframe 이 실제 로드됨
  - 필요한 외부 리소스가 차단되지 않음
  - 사용자 입력 후 콜백/완료 흐름이 정상 복귀함
  - 콘솔에 CSP violation 이 남지 않음

---

## 2. 현재 확인된 핵심 이슈

### A. 예약 완료 URL에 고객 PII 노출
현재 상태
- 예약 생성 후 `customerName`, `customerPhone`, `customerBirth` 를 query string으로 전달한다.

실제 수정 대상
- `src/components/CarDetailSection.jsx`
- `src/pages/ReservationCompletePage.jsx`
- 필요 시 예약 완료 조회 API 계약

수정 방향
- URL query 기반 조회를 제거한다.
- 대체안은 아래 2개 중 하나로 잠근다.
  1. **서버 발급 1회성 completion token 방식**
  2. 서버 세션/flash state 기반 방식
- 현재 기준 추천은 **1회성 completion token** 이다.

추천 이유
- 새로고침/직접 접근/링크 재사용 통제가 쉽다.
- 고객 PII를 URL에서 완전히 제거할 수 있다.
- 예약 완료 화면을 서버 검증 기반으로 바꿀 수 있다.

기능 상실 우려
- 예약 완료 직후 화면 재조회 실패 가능성
- 새로고침 시 상태 유실 가능성
- token 만료가 너무 짧으면 정상 고객도 완료 화면 확인 실패 가능

사전 검증 기준
- 예약 생성 직후 완료 화면 정상 진입
- 새로고침 1회까지 정상 허용 여부 정책 확정
- 브라우저 주소창/히스토리/리퍼러에 PII 0건
- token 만료 후 재진입 시 안전한 오류 화면 제공

---

### B. 게스트 예약 조회/취소 abuse 방어 부재
현재 상태
- 이름 + 휴대폰 + 생년월일 기반 조회/취소가 가능하나 rate limit, CAPTCHA, 실패 누적 차단이 없다.

실제 수정 대상
- `api/guest-bookings/lookup.js`
- `api/guest-bookings/cancel.js`
- `server/booking-core/guestBookingService.js`
- 필요 시 rate limit 저장소/운영 로그 계층

수정 방향
- 최소 3단계로 나눈다.
  1. **IP + fingerprint 기반 rate limit**
  2. **실패 누적 잠금/지연 응답**
  3. 필요 시 CAPTCHA 또는 운영형 challenge 추가

현재 기준 추천
- 1차는 **server-side rate limit + 실패 누적 지연**
- CAPTCHA는 즉시가 아니라 2차 옵션으로 둔다.

추천 이유
- 기능 손상 없이 우선 위험을 많이 줄일 수 있다.
- 예약 고객 UX 훼손이 가장 적다.

기능 상실 우려
- NAT/회사망/모바일망에서 정상 고객이 과도하게 차단될 수 있음
- 운영자 테스트 트래픽도 차단될 수 있음
- 취소/조회 실패 메시지가 과도하게 공격 힌트를 줄 수 있음

사전 검증 기준
- 정상 사용자 1~3회 조회는 문제없음
- 짧은 시간 반복 조회는 제한됨
- lookup/cancel 모두 동일 정책 적용
- 차단 로그/경보 기준 존재
- 공격자에게 존재 여부를 과도하게 알려주지 않음

---

### C. 관리자 예약 확정 토큰 만료 없음
현재 상태
- booking confirm token 은 서명만 있고 만료(exp)와 1회성 사용 전략이 없다.

실제 수정 대상
- `server/security/bookingConfirmToken.js`
- `server/booking-core/bookingConfirmationService.js`
- `server/email/bookingConfirmationEmail.js`
- 관련 관리자 확정/조회 API

수정 방향
- 토큰 payload 에 `exp` 추가
- 가능하면 `jti` 또는 equivalent nonce 도입 검토
- 확정 완료/취소/종료 상태에서는 재사용 불가 처리

현재 기준 추천
- 1차는 **exp + 상태 기반 무효화**
- 2차는 필요 시 **1회성 nonce 저장 방식**

추천 이유
- 구현 복잡도와 효과 균형이 좋다.
- 기존 관리자 흐름을 덜 깨뜨린다.

기능 상실 우려
- 오래된 관리자 메일 링크가 갑자기 무효화될 수 있음
- 고객센터/운영팀의 뒤늦은 처리 흐름과 충돌할 수 있음

사전 검증 기준
- 신규 메일 링크는 정상 동작
- 만료된 링크는 안전하게 거절
- 이미 처리된 예약은 재확정 불가
- 로그인 후에도 만료 정책은 유지

---

### D. 서버 Supabase key fallback 정책 모호
현재 상태
- 서버 클라이언트가 service role 이 없어도 publishable/anon key로 fallback 가능하다.

실제 수정 대상
- `server/supabase/createServerClient.js`
- 이를 호출하는 API 전체

수정 방향
- 용도별 서버 클라이언트를 분리한다.
  1. **privileged server client**: service role 필수
  2. **public-safe server client**: anon 허용 가능
- 민감 API는 privileged client만 사용하도록 잠근다.

현재 기준 추천
- `createServerPrivilegedClient`, `createServerPublicClient` 2계층 분리

기능 상실 우려
- 환경변수 누락 시 기존에는 "어느 정도 동작" 하던 API가 즉시 실패할 수 있음
- search/detail/read-only 경로와 예약/관리 경로를 잘못 섞으면 장애 가능

사전 검증 기준
- 관리자/예약/취소/회원 조회 API는 service role 없으면 fail-closed
- search/detail API의 요구 키 정책 별도 명시
- prod env 체크리스트 추가

---

### E. 보안 헤더 구성 이후 CSP 회귀 위험
현재 상태
- `vercel.json` 기준으로 핵심 보안 헤더는 이미 적용됐다.
- 다만 CSP가 Kakao Maps의 실제 하위 로딩 경로를 충분히 허용하지 않아 운영 지도 기능이 깨진 사례가 확인됐다.

실제 확인 결과 (2026-04-24)
- 최소 정적 테스트 페이지에서도 Kakao Maps 생성자(`Map`, `LatLng`)가 로드되지 않았다.
- 브라우저 콘솔에서 아래 CSP 위반이 확인됐다.
  - `Loading the script 'https://t1.daumcdn.net/mapjsapi/js/main/4.4.23/kakao.js' violates the following Content Security Policy directive: "script-src 'self' https://developers.kakao.com https://dapi.kakao.com"`
- 즉 원인은 앱 코드가 아니라 **CSP가 Kakao Maps 내부 스크립트 로딩(`t1.daumcdn.net`)을 차단한 것**으로 확정됐다.

실제 수정 대상
- `vercel.json`
- 필요 시 앱/SDK 로딩 정책 문서

수정 방향
- 현재 보안 헤더 baseline 은 유지한다.
- 대신 `script-src` 허용 목록에 Kakao Maps 실제 하위 로딩 경로를 정밀하게 추가한다.
  - 최소: `https://t1.daumcdn.net`
  - 권장 검토: `https://*.daumcdn.net`
- 허용은 무작정 넓히지 말고, 지도 기능에 필요한 도메인만 증거 기반으로 추가한다.

기능 상실 우려
- 지도/카카오 스크립트 차단
- 인라인 스타일/스크립트 충돌
- 운영/프리뷰 도메인 차이로 일부 기능 불능
- 보안 강화 직후 외부 SDK 회귀가 다시 발생할 수 있음

사전 검증 기준
- 랜딩, 지도, 예약, 로그인, 관리자 화면 모두 정상 동작
- 콘솔 CSP violation 점검
- preview/prod 각각 허용 origin 분리 검토
- Kakao Maps는 최소 테스트 페이지와 실제 랜딩 모달 양쪽에서 검증

재발 방지 메모
- 외부 SDK는 1차 로더 도메인만 보고 CSP를 작성하면 안 된다.
- 특히 Kakao Maps는 `dapi.kakao.com` 외에 `t1.daumcdn.net` 하위 스크립트 로딩까지 함께 검증해야 한다.
- popup 기반 서비스도 내부적으로 iframe 을 쓸 수 있으므로 `frame-src` 검토를 빼면 안 된다.
- redirect/callback/postMessage 흐름은 CSP와 별개로 복귀 경로와 origin 검증까지 같이 확인한다.
- 특정 서비스가 한 번 됐다고 같은 계열 서비스도 자동으로 된다고 가정하면 안 된다. 서비스마다 실제 하위 도메인과 로딩 방식이 다를 수 있다.
- 운영 확인은 "버튼이 보인다/창이 뜬다" 수준이 아니라 실제 외부 문서와 완료 흐름이 정상인지로 판단한다.
- 보안 헤더 수정 시에는 반드시 "최소 정적 테스트 페이지 + 실제 화면" 2단 검증을 거친다.

---

### F. PII 최소화 정책 부재
현재 상태
- 예약 완료/관리자/회원 화면, 관리자 메일, 일부 이벤트 payload 에서 전화번호/생년월일/상세주소가 평문 노출된다.

실제 수정 대상
- `server/booking-core/guestBookingUtils.js`
- 예약/관리/회원 관련 UI 페이지
- `server/email/bookingConfirmationEmail.js`
- 필요 시 이벤트 로깅 payload

수정 방향
- 화면별 공개 수준을 분리한다.
  1. 비회원 고객 화면: 최소 표시
  2. 회원 화면: 본인 확인 맥락에서 제한 표시
  3. 관리자 화면: 업무상 필요한 최소 표시
  4. 메일/로그: 링크 중심, PII 최소화

현재 기준 추천
- 휴대폰은 기본 마스킹
- 생년월일은 기본 마스킹 또는 미표시
- 상세주소는 운영상 꼭 필요한 화면에서만 표시
- 메일은 예약번호/차량/일시/확인 링크 중심으로 축소

기능 상실 우려
- 운영자가 메일만 보고 처리하던 습관과 충돌
- 고객이 완료 화면에서 자기 정보 확인이 줄어들 수 있음

사전 검증 기준
- 운영에 꼭 필요한 정보는 시스템 상세 화면에서 조회 가능
- 메일 없이도 관리자 처리 흐름 유지
- 고객 화면에서 과다노출 제거 후도 문의 증가가 감당 가능

---

### G. `nodemailer` 취약 버전 사용
현재 상태
- `npm audit --omit=dev` 기준 high 취약점 존재

실제 수정 대상
- `package.json`
- 메일 발송 모듈 전체 회귀 검증

수정 방향
- 업그레이드 가능 버전 검토 후 상향
- breaking 여부 확인 후 메일 전송/encoding/template 동작 검증

기능 상실 우려
- 메일 전송 실패
- envelope/SMTP 동작 차이
- 발신자/수신자 처리 방식 변화

사전 검증 기준
- 관리자 예약 확정 메일 정상 발송
- 한글 제목/본문 정상
- 링크 포함 메일 정상
- 에러 로깅 포맷 유지

---

## 3. 실제 수정 우선순위

### Phase 1 — P0 차단
범위
1. 예약 완료 URL PII 제거
2. 게스트 lookup/cancel abuse 방어 추가
3. 관리자 확정 토큰 만료/무효화 도입

이 phase를 먼저 하는 이유
- 개인정보 직접 노출
- 자동화 악용
- 장기 유효 토큰
이 3개가 현재 가장 위험도가 높다.

종료 조건
- 주소창/히스토리에 고객 PII 0건
- guest lookup/cancel 방어 baseline 적용
- confirm token 만료 정책 적용
- 기존 예약 생성/조회/관리 흐름 회귀 통과

---

### Phase 2 — 권한 경계 및 서버 키 정책 정리
범위
1. server privileged/public client 분리
2. 민감 API의 service role 강제
3. 토큰 secret fallback 정책 정리

종료 조건
- 민감 API가 잘못된 키 설정으로는 fail-closed
- key 정책이 문서와 코드에 일치
- preview/prod env 요구사항이 명확

---

### Phase 3 — PII 최소화 및 운영 채널 정리
범위
1. 화면별 마스킹 정책 반영
2. 관리자 메일 본문 최소화
3. 로그/event payload 최소화
4. localStorage 레거시 경로 실사용 여부 확인 및 제거 여부 결정

종료 조건
- 고객/관리자/메일/로그별 노출 기준 고정
- 과다노출 경로 제거
- 운영 처리에 필요한 최소 정보는 유지

---

### Phase 4 — 보안 헤더 및 프론트 실행환경 잠금
범위
1. CSP 설계 및 적용
2. frame/referrer/permissions 정책 적용
3. Kakao/Supabase/자체 asset 허용원점 정리

종료 조건
- 주요 화면/SDK 정상 동작
- CSP violation 0건 목표
- preview/prod 동작 차이 문서화

---

### Phase 5 — 공급망/운영 점검 마무리
범위
1. nodemailer 업그레이드
2. prod dependency 재점검
3. 보안 점검용 운영 체크리스트 확정

종료 조건
- 알려진 high 취약점 정리
- 배포 전/후 점검 절차 확정

---

## 4. phase별 꼬임 방지 원칙

### 공통 원칙
- 한 phase 에 한 종류의 보안 변경만 넣는다.
- 인증/토큰/헤더/PII 최소화는 동시에 섞지 않는다.
- 각 phase 는 반드시 아래 순서로 진행한다.
  1. 범위 고정
  2. 수정
  3. 검증
  4. 문서 업데이트
  5. 커밋

### 금지 원칙
- P0 해결하면서 UI 문구 정리, 리팩토링, 파일 이동을 같이 하지 않는다.
- 토큰 구조 변경과 이메일 템플릿 대수술을 한 phase 에 같이 넣지 않는다.
- 헤더 적용과 외부 SDK 교체를 동시에 하지 않는다.

---

## 5. phase별 회귀/기능상실 검증 기준

### Phase 1 검증
- 예약 생성 성공
- 예약 완료 화면 진입 성공
- 새로고침 동작 정책대로 처리
- guest lookup 정상 사용자 케이스 성공
- guest cancel 정상 사용자 케이스 성공
- 과도한 반복 요청 차단 확인
- 관리자 메일 링크 정상 동작
- 만료 링크 거절 확인

### Phase 2 검증
- admin/member/guest API 인증 흐름 정상
- service role 누락 시 민감 API fail-closed 확인
- search/detail API는 문서 기준대로만 동작
- 토큰 생성/검증 회귀 테스트 통과

### Phase 3 검증
- 예약 완료 화면에서 필요한 최소 정보 확인 가능
- 관리자 화면 운영 정보 충분성 확인
- 회원 상세 화면 자기 예약 확인 가능
- 관리자 메일로 업무 흐름 유지 가능
- 로그에 민감정보 과다노출 없음

### Phase 4 검증
- 랜딩 지도 정상
- 검색/상세/예약/회원/관리자 화면 정상
- Kakao chat/map SDK 정상
- CSP/보안 헤더 적용 후 콘솔 에러 확인

### Phase 5 검증
- 메일 발송 성공/실패 케이스 정상
- npm audit 재실행
- 배포 후 프로덕션 smoke test 통과

---

## 6. 현재 권장 구현 순서

1. Phase 1-A: 예약 완료 URL PII 제거
2. Phase 1-B: guest lookup/cancel abuse 방어
3. Phase 1-C: confirm token 만료/무효화
4. Phase 2-A: server client privileged/public 분리
5. Phase 2-B: secret fallback 정책 정리
6. Phase 3-A: 화면/메일 PII 최소화
7. Phase 3-B: localStorage 레거시 경로 처리
8. Phase 4: 보안 헤더/CSP 적용
9. Phase 5: nodemailer 업그레이드 및 최종 점검

---

## 7. 현재 권장 결론

- 지금 바로 들어가야 하는 것은 **Phase 1** 이다.
- 특히 제일 먼저 잠가야 할 것은 **URL PII 제거** 다.
- 그 다음은 **guest abuse 방어**, 그 다음은 **confirm token 만료** 순서가 맞다.
- 보안 헤더와 dependency 정리는 중요하지만, 현재는 먼저 **개인정보 직접 노출과 악용 가능성 차단**이 우선이다.
- 2026-04-28 기준 보안 실행 문서는 완료되어 `docs/past/present-history/2026-04-28_RENTCAR00_SECURITY_EXECUTION_CURRENT_PAST.md` 로 내렸다.
- 이후 보안 변경은 이 문서를 현행 기준으로 다시 잠근 뒤, 필요 시 새 execution current 를 별도로 발급한다.
