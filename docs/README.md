# docs

문서는 아래 구조로 잠근다.

## 1. policies
지속적으로 참고할 운영 기준과 정책 파일을 둔다.

현재 정책 파일:
- `policies/RENTCAR00_POLICY.md`
- `policies/RENTCAR00_PRICING_HUB.md`

원칙:
- 정책 파일은 `current`, `past` 같은 상태 꼬리표를 붙이지 않는다.
- 제품/보안/API/회원/운영 기준처럼 계속 참고할 문서는 `policies/` 에 둔다.
- 상태 문서가 아니라 기준 문서다.

## 1-1. present
실행 중인 작업에 한해 임시 current 문서를 둘 수 있다.

현재 active present:
- `present/2026-05-14_RENTCAR00_ADMIN_PRICING_HUB_EXECUTION_READY_CURRENT.md`
- `present/2026-05-14_RENTCAR00_PRICING_HUB_DB_CLEANUP_CURRENT.md`

원칙:
- present 는 실행 중인 작업이 있을 때만 사용한다.
- 작업이 끝나면 `past/` 로 내린다.
- 정책 자체는 `policies/` 에 남기고, 진행 상태는 `present/` 에만 둔다.

## 2. past
현재 기준에서 내려온 문서와 과거 실행 기록.

정리 원칙:
- 완료된 실행 문서, 예전 current 문서, 시점 기록은 `past/` 로 내린다.
- 상태가 끝난 문서는 policy 로 남기지 않는다.

## 3. archive
현재 기준에서 직접 쓰지 않는 오래된 설계/메모.

## 4. references
현재/과거와 별개로 계속 참고하는 외부 레퍼런스.

## 운영 원칙
- 외부 SDK, 지도, 주소검색, 인증 위젯 변경은 기능 코드보다 먼저 `policies/RENTCAR00_POLICY.md` 와 `vercel.json` CSP를 같이 확인한다.
- Kakao 계열은 1차 로더 도메인만 보고 끝내지 않는다. 실제 하위 로딩 도메인까지 확인한 뒤 `script-src`, `connect-src`, `frame-src` 를 각각 점검한다.
- Kakao 우편번호는 popup 기준이라도 내부 iframe 로딩 여부까지 확인한다.
- 예약/회원/보안/API/운영 기준은 모두 `policies/RENTCAR00_POLICY.md` 를 먼저 본다.
- 완료된 실행 기록은 `past/present-history/` 에 보관한다.
- 상태가 끝난 체크리스트는 남기지 않는다.
- 예약 연동처럼 구현 완료된 current 문서는 active 에 두지 않고 `past/present-history/` 로 내린다.
- 가격 허브 장기 구조 문서는 `policies/` 에 두고, current 문서로 두지 않는다.
- 구기준 문서는 과감하게 active 영역에서 제거한다.
