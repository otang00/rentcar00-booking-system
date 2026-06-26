# AGENT A — Contract / DTO Audit

## 목적
현재 검색 endpoint 계약과 프론트 소비 DTO shape 를 잠근다.

## 현재 맥락
- 검색 endpoint 는 `GET /api/search-cars`
- 서버는 partner 검색 결과를 fetch/parse/map 해서 응답한다.
- 프론트는 `src/services/cars.js` 를 통해 이 응답을 view model 로 바꿔 사용한다.
- 이번 단계의 목표는 계약을 바꾸는 것이 아니라, **DB 검색 엔진이 맞춰야 할 현재 계약을 잠그는 것**이다.

## 읽을 파일
- `api/search-cars.js`
- `server/partner/buildPartnerUrl.js`
- `server/partner/mapPartnerDto.js`
- `server/partner/parsePartnerSearch.js`
- `src/services/cars.js`
- `src/utils/searchQuery.js`
- `docs/present/VALIDATION_PRESENT.md`
- `docs/present/IMPLEMENTATION_RULES_PRESENT.md`

## 해야 할 일
1. 현재 검색 query 필드 목록 확정
2. 서버 응답 payload shape 확정
3. 프론트가 실제로 쓰는 필수 필드 / 선택 필드 분리
4. `meta` 필드의 현재 의미 정리
5. `deliveryAddressDetail` 의 현재 의미 정리
6. DB 검색 엔진이 반드시 맞춰야 할 DTO 계약 작성
7. 바꾸면 안 되는 계약과, 후속에 검토 가능한 계약을 분리

## 반드시 답해야 할 질문
- 검색 결과의 최소 계약 필드는 무엇인가?
- 프론트가 실제로 의존하는 필드는 무엇인가?
- `deliveryAddressDetail` 은 검색 계약인가, 예약 보조 필드인가?
- DB 검색 엔진이 현재 프론트에 맞추려면 어떤 shape 를 보장해야 하는가?

## 금지
- `api/search-cars.js` 수정 금지
- `src/services/cars.js` 수정 금지
- 계약을 바꿔버리는 제안 금지
- 구현 코드 작성 금지

## 결과물 저장 경로
- `docs/agents/search-db-wiring/results/SEARCH_CONTRACT_AUDIT.md`

## 결과물 필수 섹션
1. 결론
2. 근거 파일
3. 입력 query 표
4. 응답 DTO 표
5. 프론트 필수 의존 필드
6. 주의 필드 / 애매한 필드
7. DB 전환 시 유지해야 할 계약 요약
8. 변경 제안 파일
9. 금지/주의 파일
10. 확인 필요 사항
11. 다음 단계

## 완료 기준
- 오케스트레이터가 이 문서만 보고 검색 계약을 잠글 수 있어야 한다.
