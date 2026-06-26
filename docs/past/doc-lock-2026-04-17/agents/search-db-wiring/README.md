# Search DB Wiring Agent Pack

## 목적
이 폴더는 검색 DB 연결 작업 전에 에이전트에게 병렬로 줄 수 있는 지시문서를 모아둔 것이다.

## 프로젝트 맥락 요약
- 현재 검색 endpoint는 `GET /api/search-cars` 이다.
- 현재 검색 결과 source 는 partner 검색 URL fetch + parse 결과다.
- 현재 상세 endpoint는 `GET /api/car-detail` 이며, partner detail + Supabase cars 병합 구조다.
- 이번 단계의 목표는 **검색 결과를 우리 DB 기준으로 재현할 준비를 문서로 잠그는 것**이다.
- 이번 단계는 구현보다 **계약/설계/규칙 잠금**이 우선이다.

## 기준 문서
에이전트는 먼저 아래 문서를 읽고 시작한다.
1. `docs/present/CURRENT_STATE_PRESENT.md`
2. `docs/present/ROADMAP_PRESENT.md`
3. `docs/present/VALIDATION_PRESENT.md`
4. `docs/present/PARALLEL_WORKSTREAMS_PRESENT.md`
5. `docs/present/IMPLEMENTATION_RULES_PRESENT.md`
6. `docs/present/DECISIONS_PRESENT.md`

## 공통 실행 원칙
- 지금 단계는 구현 강행보다 문서/설계/규칙 잠금이 우선이다.
- shared choke point 파일은 동시에 수정하지 않는다.
- 가능하면 **문서 산출물 + 변경 제안 + 위험요소** 중심으로 낸다.
- 코드 수정이 꼭 필요하다고 판단되더라도, 먼저 문서에 제안으로 남긴다.
- 최종 코드 통합은 메인 오케스트레이터가 한다.

## 공통 금지
- `api/search-cars.js` 직접 수정 금지
- `src/utils/searchQuery.js` 직접 수정 금지
- `server/partner/buildPartnerUrl.js` 직접 수정 금지
- `server/partner/mapPartnerDto.js` 직접 수정 금지
- `src/services/cars.js` 직접 수정 금지
- 기존 검색/상세 계약을 임의 변경하는 제안 금지
- 이번 단계에서 구현 완료를 선언하는 태도 금지

## 공통 산출물 형식
모든 에이전트는 아래 순서로 결과를 낸다.
1. 결론
2. 근거 파일
3. 변경 제안 파일
4. 금지/주의 파일
5. 확인 필요 사항
6. 다음 단계

## 산출물 저장 위치
- 각 에이전트는 자기 결과 문서를 아래 위치에 저장한다.
- `docs/agents/search-db-wiring/results/`

## 추천 역할
- Agent A: 검색 계약 / DTO 감사
- Agent B: DB read model 설계
- Agent C: shadow mode / diff logging 설계
- Agent D: 통합 규칙 / file ownership 점검
