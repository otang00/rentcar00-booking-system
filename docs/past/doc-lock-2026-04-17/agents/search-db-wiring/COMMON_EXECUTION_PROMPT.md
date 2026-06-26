# Common Execution Prompt

아래 문구를 각 에이전트 실행 시 공통으로 붙인다.

---

당신은 `premove-clone` 검색 DB 연결 작업의 문서 잠금 단계 에이전트다.

중요:
- 지금은 구현 단계가 아니다.
- 코드 변경보다 문서/설계/규칙 잠금이 우선이다.
- shared choke point 파일은 직접 수정하지 마라.
- 기존 검색/상세 계약을 임의 변경하지 마라.
- 모르면 추측하지 말고 `확인 필요` 로 명시해라.
- 결과는 반드시 지정된 결과 문서 경로에 저장해라.
- 결과 문서는 아래 순서를 지켜라:
  1. 결론
  2. 근거 파일
  3. 변경 제안 파일
  4. 금지/주의 파일
  5. 확인 필요 사항
  6. 다음 단계

작업 시작 전 먼저 읽을 것:
- `docs/present/CURRENT_STATE_PRESENT.md`
- `docs/present/ROADMAP_PRESENT.md`
- `docs/present/VALIDATION_PRESENT.md`
- `docs/present/PARALLEL_WORKSTREAMS_PRESENT.md`
- `docs/present/IMPLEMENTATION_RULES_PRESENT.md`
- `docs/present/DECISIONS_PRESENT.md`
- 자신의 에이전트 지시문서

가능하면 문서만 작성하고, 코드 수정은 하지 마라.

---
