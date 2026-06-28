# PROJECT_STATE

## 현재 상태 요약
`rentcar00-booking-system`은 단순 홈페이지가 아니라 검색, 상세, 예약, 결제, 회원, 관리자, 가격 허브, 외부 플랫폼 동기화까지 포함한 운영형 예약 서비스다.

## Known Good State
- 서버 테스트: `node --test server/**/*.test.js` 통과
  - 78 tests / 78 pass / 0 fail
- 작업트리 확인 시 문서 정리 전 코드 변경 없음.
- 주요 구현 축:
  - React/Vite SPA
  - Vercel serverless API
  - Supabase DB/Auth
  - Solapi OTP/SMS
  - KCP 결제 준비/복귀 구조
  - 관리자 가격 허브
  - 카모아/찜카 동기화 스크립트
  - OPS 앱 예약 이벤트 outbox

## 현재 기준점
- 정책 기준: `docs/policies/RENTCAR00_POLICY.md`
- 결제/예약 무결성 기준: `docs/policies/RENTCAR00_BOOKING_PAYMENT_INTEGRITY_V1.md`
- 가격 허브 기준: `docs/policies/RENTCAR00_PRICING_HUB.md`
- 현재 상세 작업 문서는 `docs/PHASE`, 완료 문서는 `docs/COMPLETED`, 과거/폐기 문서는 `docs/ARCHIVE` 또는 기존 archive/past 영역으로 정리한다.

## 최근 완료 사항
- 카니발 홈페이지/카모아 가격 조정 완료: `docs/COMPLETED/2026-06-09_CARNIVAL_PRICE_AND_CARMORE_APPLY.md`
- 관리자 가격 패널 PC 리빌드 완료: `docs/COMPLETED/2026-06-06_ADMIN_PRICING_PANEL_PC_REBUILD.md`
- 카모아 sync vendor bundle recovery 완료: `docs/COMPLETED/2026-06-05_CARMORE_SYNC_VENDOR_BUNDLE_RECOVERY_COMPLETE.md`

## 진행 중 / 다음 phase
- 상태·이벤트·owner 기준 문서화 baseline 작성 완료:
  - `docs/PHASE/2026-06-11_RENTCAR00_DOCH_STATE_EVENT_MAP.md`
- 다음 후보 phase:
  - KCP approve 성공 후 예약 생성 실패를 복구 가능하게 남기는 Payment Ledger 최소 설계 PM

## 막힌 점 / 확인 필요
- KCP 운영 결제는 코드 저장 단계보다 KCP 상점 승인 가능 상태 확인이 blocker다.
- 홈페이지 DB 가격과 외부 플랫폼 가격은 변경 시 반영 결과/복구 근거를 함께 남겨야 한다.
- 카모아/찜카 동기화는 live save-run, launchd, DB 상태가 얽히므로 상태 owner와 재처리 기준을 먼저 봐야 한다.
- Preview 카카오 지도 검증용 고정 alias는 `https://rentcar00-booking-system-git-dev-otang00s-projects.vercel.app` 이다. Kakao Developers Web 플랫폼 도메인에는 이 alias를 유지 등록한다.

## 리스크
- 예약 상태, 결제 상태, 외부 플랫폼 휴무/가격 상태가 서로 다른 owner를 가진다.
- 관리자 UI/API가 운영 상태를 직접 바꾸는 구간은 guardrail이 필요하다.
- 문서 구조가 과거 `present/complete/archive`와 현재 `GOAL/PHASE/COMPLETED/ARCHIVE`가 섞여 있어, 새 문서는 4축 기준으로 작성한다.

## 다음 작업 후보
1. Payment Ledger 최소 설계 PM으로 KCP approve 성공 후 booking RPC 실패 시 복구 가능한 상태를 설계한다.
2. 이후 실제 구현·DB·외부 반영은 별도 phase 승인 후 진행한다.
