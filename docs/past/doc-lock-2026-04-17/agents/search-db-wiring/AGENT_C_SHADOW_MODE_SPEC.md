# AGENT C — Shadow Mode / Diff Logging Spec

## 목적
partner 결과와 DB 결과를 동시에 계산해 차이를 기록하는 규격을 정의한다.

## 현재 맥락
- 현재 사용자 응답은 partner 기반 결과를 반환한다.
- DB 검색 엔진은 아직 붙지 않았다.
- 전환 전에는 partner 결과와 DB 결과를 병행 계산해 diff 를 봐야 한다.
- 이번 단계의 목표는 **shadow mode / diff logging 규격을 문서로 잠그는 것**이다.

## 읽을 파일
- `api/search-cars.js`
- `docs/present/ROADMAP_PRESENT.md`
- `docs/present/VALIDATION_PRESENT.md`
- `docs/present/IMPLEMENTATION_RULES_PRESENT.md`
- 필요 시 `server/partner/mapPartnerDto.js`

## 해야 할 일
1. shadow mode 실행 흐름 설계
2. diff 항목 정의
3. 저장 형태 정의
   - 로그 테이블
   - 파일 로그
   - 콘솔 로그 중 추천안
4. 샘플 diff payload 작성
5. 전환 전 검증 리포트 형식 정의
6. feature flag 연동 포인트를 문서로만 제안

## 반드시 답해야 할 질문
- partner / DB 병행 계산을 어디서 수행하는 게 가장 안전한가?
- diff 는 어떤 키로 비교해야 하는가?
- 결과 수/차량 id/정렬/가격/제외 사유를 어떻게 기록해야 하는가?
- 초기에는 어떤 저장 방식이 가장 현실적인가?
- 전환 승인 전에 어떤 리포트를 보면 되는가?

## 금지
- `api/search-cars.js` 직접 수정 금지
- DTO shape 변경 제안 금지
- feature flag 실제 도입 구현 금지
- 구현 코드 작성 금지

## 결과물 저장 경로
- `docs/agents/search-db-wiring/results/SHADOW_MODE_DIFF_SPEC.md`

## 결과물 필수 섹션
1. 결론
2. 근거 파일
3. 병행 실행 흐름
4. diff schema
5. 기록 위치 추천안
6. 샘플 로그 포맷
7. 전환 판단 기준
8. 변경 제안 파일
9. 금지/주의 파일
10. 확인 필요 사항
11. 다음 단계

## 완료 기준
- 오케스트레이터가 문서만 보고 shadow mode 구현 순서를 정할 수 있어야 한다.
