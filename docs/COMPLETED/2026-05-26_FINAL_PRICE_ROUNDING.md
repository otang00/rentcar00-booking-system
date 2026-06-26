# 2026-05-26 FINAL PRICE ROUNDING

## Completed
- 홈페이지 최종 노출/예약확정 가격에만 라운딩을 적용하도록 정리했다.
- 중간 가격 계산식(`calculateGroupPrice`)은 raw 계산 기준으로 유지했다.
- 최종 적용 지점은 `buildAppliedGroupPricing`로 분리했다.
- 일반 구간 최종 렌탈가는 1,000원 단위 올림으로 맞췄다.
- 15~30일 구간 최종 렌탈가는 10,000원 단위 올림으로 맞췄다.
- 결제 준비 API는 클라이언트가 보낸 금액을 그대로 쓰지 않고, 서버에서 동일 조건으로 최종 가격을 재계산해 KCP 결제 금액과 예약 원장 금액에 사용하도록 변경했다.

## Not Changed
- DB 저장 스키마 변경 없음
- Supabase migration 없음
- 관리자 가격허브 입력값/중간 계산값 강제 변경 없음
- 배포 없음

## Verification
- `node --test server/search-db/pricing/__tests__/buildAppliedGroupPricing.test.js server/search-db/pricing/__tests__/calculateGroupPrice.test.js`
- `node --test server/search-db/pricing/__tests__/*.test.js server/search-db/transformers/__tests__/*.test.js server/search-db/__tests__/*.test.js`
- `node -c api/payments/[action].js`
- `npm run build`

## Artifact
- Clean price table HTML: `/Users/otang_server/.openclaw/workspace-rentcar00_reservation_developer/artifacts/pricing-final-display-clean-2026-05-26.html`

## Remaining Risk
- 실제 운영 반영 전 production 검색/상세/결제 준비 요청에서 동일 금액이 나오는지 1회 확인이 필요하다.
