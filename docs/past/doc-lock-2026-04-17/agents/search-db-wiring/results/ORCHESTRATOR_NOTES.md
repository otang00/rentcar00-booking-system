# Orchestrator Notes — Search DB Wiring

## 목적
에이전트 결과 수합 전에 핵심 포인트를 빠르게 메모하기 위한 내부 노트.

## 현재 상태
- Agent A (Contract / DTO Audit): 진행 중
- Agent B (DB Read Model Spec): 진행 중
- Agent C (Shadow Mode / Diff Spec): 진행 중
- Agent D (Integration Rules Audit): 완료 → `INTEGRATION_OWNERSHIP_RULES.md`

## Agent D 핵심 메모
- shared choke point 5개: `api/search-cars.js`, `src/utils/searchQuery.js`, `src/services/cars.js`, `server/partner/buildPartnerUrl.js`, `server/partner/mapPartnerDto.js`
- 수정 순서: 계약 잠금 → DB read model → shadow mode → safe edit → 내부 DB 서비스 → API 통합 → 프론트 점검
- 병렬 금지 조합 명시, feature flag/로그 위치 등 확인 필요 항목 기록됨

## 다음 받을 산출물에서 확인할 것
- Agent A: query/DTO 표 + meta/주의 필드 정의 + `deliveryAddressDetail` 결론
- Agent B: blocking status, overlap rule, 서버 구조 제안
- Agent C: shadow mode 실행 흐름, diff schema, 로그 위치, 샘플 payload

## 일단 정리 안건
- 모든 문서가 동일한 output 섹션 순서를 지켰는지 검토
- 겹치는 제안 있을 경우 통합 문서 초안 준비
- Phase-based 구현 플랜에 넣을 수 있도록 요약 표 준비
