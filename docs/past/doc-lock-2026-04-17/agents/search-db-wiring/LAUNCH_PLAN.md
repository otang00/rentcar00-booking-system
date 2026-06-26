# Launch Plan

## 목적
에이전트 실행 시 어떤 순서와 조합으로 병렬 투입할지 잠근다.

## 시작 기준
- 기준 commit: `31f55f2`
- 의미: DB 연결 전 포인트
- 현재는 문서 잠금 단계이며, 구현 단계가 아니다.

## 권장 순서
### Round 1. 문서 병렬 작업
동시에 실행 가능:
- Agent A — Contract / DTO Audit
- Agent B — DB Read Model Spec
- Agent C — Shadow Mode / Diff Logging Spec
- Agent D — Integration Rules Audit

### Round 2. 오케스트레이터 검토
- 4개 산출물 비교
- 충돌/중복 제거
- shared choke point 확정
- 구현 순서 재잠금
- 구현 전 최종 지시문 초안 작성

### Round 3. 구현 에이전트 투입
문서 검토가 끝난 뒤에만 시작.
- 통합 담당 1명
- 필요 시 보조 1명

## 병렬 금지
아래 파일 수정은 단일 담당자만 한다.
- `api/search-cars.js`
- `src/utils/searchQuery.js`
- `server/partner/buildPartnerUrl.js`
- `server/partner/mapPartnerDto.js`
- `src/services/cars.js`

## 각 에이전트 공통 산출 형식
1. 결론
2. 근거 파일
3. 변경 제안 파일
4. 금지/주의 파일
5. 확인 필요 사항
6. 다음 단계

## 라운드 1 성공 기준
- Agent A: 검색 계약/DTO 잠금 초안 완성
- Agent B: DB read model 초안 완성
- Agent C: shadow mode diff 규격 초안 완성
- Agent D: shared file ownership 규칙 초안 완성

## 시작 전 확인
- 기준 문서: `docs/present/*`
- 지시문서: `docs/agents/search-db-wiring/*`
- 결과 저장: `docs/agents/search-db-wiring/results/*`
- 구현 전까지는 shared file 직접 수정 금지
