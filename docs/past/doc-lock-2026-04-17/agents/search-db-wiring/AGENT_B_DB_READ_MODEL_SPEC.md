# AGENT B — DB Read Model Spec

## 목적
`cars + reservations` 기반 검색 후보 계산 규격을 문서화한다.

## 현재 맥락
- IMS 예약 동기화 baseline 은 이미 들어가 있다.
- `reservations` 는 적재/정규화/upsert 까지 완료된 상태다.
- 아직 검색 API는 이 DB를 읽지 않는다.
- 이번 단계의 목표는 **검색용 DB read model 을 설계 문서로 잠그는 것**이다.

## 읽을 파일
- `docs/present/ROADMAP_PRESENT.md`
- `docs/present/VALIDATION_PRESENT.md`
- `docs/present/IMPLEMENTATION_RULES_PRESENT.md`
- `server/supabase/fetchCarBySourceCarId.js`
- `supabase/migrations/20260414195200_create_ims_sync_tables.sql`
- `supabase/migrations/20260414213000_fix_reservations_upsert_unique.sql`
- 필요 시 `docs/past/ims-sync/*`

## 해야 할 일
1. 검색용 `cars` 최소 필드 정의
2. `reservations` blocking status 후보 정리
3. 시간 겹침 판정 규칙 초안 작성
4. 후보 차량 조회 전략 초안 작성
5. DB 검색 서비스 계층 책임 제안
6. 필요한 추가 helper/service 구조 제안
7. 확인 필요 데이터/정책 분리

## 반드시 답해야 할 질문
- 검색 가용성 계산에 필요한 최소 테이블/필드는 무엇인가?
- 어떤 reservation status 를 blocking 으로 봐야 하는가?
- overlap 판정은 어떤 조건이 가장 안전한가?
- `server/search-db/*` 에 어떤 책임을 두는 것이 좋은가?
- 현재 스키마만으로 부족한 부분은 무엇인가?

## 금지
- 프론트 파일 수정 금지
- `api/search-cars.js` 수정 금지
- partner parser 수정 금지
- 구현 코드 작성 금지

## 결과물 저장 경로
- `docs/agents/search-db-wiring/results/DB_READ_MODEL_SPEC.md`

## 결과물 필수 섹션
1. 결론
2. 근거 파일
3. 필요한 테이블/필드
4. blocking status 규칙
5. overlap rule
6. 조회 흐름도
7. 추천 서버 파일 구조
8. 변경 제안 파일
9. 금지/주의 파일
10. 위험요소 / 확인 필요 사항
11. 다음 단계

## 완료 기준
- 오케스트레이터가 이 문서를 기반으로 `dbSearchService` 설계를 시작할 수 있어야 한다.
