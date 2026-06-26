# AGENT D — Integration Rules Audit

## 목적
shared file ownership, safe edit order, integration choke point 를 명확히 정리한다.

## 현재 맥락
- 검색 DB 연결은 구현 난이도보다 통합 충돌 위험이 더 큰 작업이다.
- 특히 query canonical, DTO canonical, API choke point 가 이미 살아 있다.
- 이번 단계의 목표는 **누가 어떤 파일을 언제 만질지**를 문서로 잠그는 것이다.

## 읽을 파일
- `docs/present/VALIDATION_PRESENT.md`
- `docs/present/PARALLEL_WORKSTREAMS_PRESENT.md`
- `docs/present/IMPLEMENTATION_RULES_PRESENT.md`
- `api/search-cars.js`
- `src/utils/searchQuery.js`
- `src/services/cars.js`
- `server/partner/buildPartnerUrl.js`
- `server/partner/mapPartnerDto.js`

## 해야 할 일
1. shared choke point 파일 목록 검토
2. 단일 담당자 수정이 필요한 파일 재확인
3. 통합 순서 제안
4. 파일 ownership 표 작성
5. 병렬 금지 조합 작성
6. merge 위험요소 정리
7. 구현 시작 전 잠금 체크리스트 작성

## 반드시 답해야 할 질문
- 어떤 파일이 진짜 canonical 인가?
- 어떤 파일은 반드시 1명만 수정해야 하는가?
- 문서 단계 이후 구현은 어떤 순서로 들어가야 충돌이 적은가?
- merge 직전에 무엇을 확인해야 하는가?

## 금지
- 실제 기능 구현 금지
- 검색/상세 계약 변경 금지
- shared file 직접 수정 금지

## 결과물 저장 경로
- `docs/agents/search-db-wiring/results/INTEGRATION_OWNERSHIP_RULES.md`

## 결과물 필수 섹션
1. 결론
2. 근거 파일
3. shared file 목록
4. 파일별 권장 담당자 유형
5. 수정 순서
6. 병렬 금지 조합
7. merge 위험요소
8. 구현 전 체크리스트
9. 변경 제안 파일
10. 금지/주의 파일
11. 확인 필요 사항
12. 다음 단계

## 완료 기준
- 오케스트레이터가 어느 파일을 누구에게 줄지 바로 결정할 수 있어야 한다.
