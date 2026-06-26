# 1. 결론
- 검색 DB 전환은 `api/search-cars.js` → partner 계층 → DTO 매핑으로 이어지는 기존 체인을 유지한 채, 내부에 DB 검색 계층을 추가하는 방식이어야 한다.
- shared choke point 다섯 개(`api/search-cars.js`, `src/utils/searchQuery.js`, `src/services/cars.js`, `server/partner/buildPartnerUrl.js`, `server/partner/mapPartnerDto.js`)는 단일 담당자 통제 하에 순차 수정해야 충돌을 막을 수 있다.
- 구현 착수 전에 계약/DTO/명명 규칙을 문서로 재확인하고, shadow mode diff 설계가 끝나야 안전하다.

# 2. 근거 파일
- `docs/present/CURRENT_STATE_PRESENT.md`
- `docs/present/ROADMAP_PRESENT.md`
- `docs/present/VALIDATION_PRESENT.md`
- `docs/present/PARALLEL_WORKSTREAMS_PRESENT.md`
- `docs/present/IMPLEMENTATION_RULES_PRESENT.md`
- `docs/present/DECISIONS_PRESENT.md`
- `api/search-cars.js`
- `src/utils/searchQuery.js`
- `src/services/cars.js`
- `server/partner/buildPartnerUrl.js`
- `server/partner/mapPartnerDto.js`

# 3. shared file 목록
| 구분 | 파일 | 역할 | 현재 상태 |
| --- | --- | --- | --- |
| API endpoint | `api/search-cars.js` | 프론트와 서버 사이 단일 검색 endpoint, 캐시/에러/응답 shape 결정 | partner fetch만 연결되어 있어 수정 시 즉각 사용자 영향 |
| 프론트 query canonical | `src/utils/searchQuery.js` | 검색 파라미터 normalize/validate/build | delivery-only 필드 처리 포함, 계약 잠금 필요 |
| 프론트 DTO 소비층 | `src/services/cars.js` | `/api/search-cars` 응답을 카드 모델로 변환 | DB 전환 후에도 동일 shape 요구 |
| 서버 query canonical | `server/partner/buildPartnerUrl.js` | 서버 측 normalize/validate + partner URL 구성 | partner URL 전용이라 DB 검색 파라미터 기준으로도 쓰일 예정 |
| 서버 DTO canonical | `server/partner/mapPartnerDto.js` | partner 응답을 프론트 shape 로 매핑 | DB 검색 결과도 이 shape 를 따라야 함 |

# 4. 파일별 권장 담당자 유형
- `api/search-cars.js`: **통합 담당 1명** (shadow mode wiring + feature flag 경험자)
- `src/utils/searchQuery.js`: **계약 담당 1명** (프론트 검색 UX/validation 이해자)
- `src/services/cars.js`: **프론트 데이터 계약 담당 1명** (카드 렌더링 책임자)
- `server/partner/buildPartnerUrl.js`: **서버 검색 계약 담당 1명** (partner/DB 파라미터 양쪽 이해자)
- `server/partner/mapPartnerDto.js`: **DTO 소유자 1명** (검색 결과 view model 책임자)
- 신규 `server/search-db/*`: **DB 검색 서비스 담당 1명** (reservations 겹침 로직 담당)

# 5. 수정 순서
1. **계약 잠금 재확인**: search query/DTO 문서 → `IMPLEMENTATION_RULES_PRESENT.md` 기준 재검토.
2. **DB read model 스펙 확정**: `server/search-db/readModel.md` 등 별도 문서에 blocking 규칙 정의.
3. **shadow mode 설계 잠금**: diff schema + 로그 위치 정의.
4. **safe edit rules 확인**: 본 문서 검토 후 담당자 지정.
5. **내부 DB 서비스 추가**: `server/search-db/*` 생성, partner 코드와 분리.
6. **`api/search-cars.js` 통합**: partner/DB 동시 호출 + diff 로깅 + feature flag.
7. **프론트 계약 점검**: `src/services/cars.js` 테스트, 필요 시 최소 보정.

# 6. 병렬 금지 조합
- `api/search-cars.js` + `server/partner/buildPartnerUrl.js`: 동시 수정 시 validation/normalize 중복 위험.
- `src/utils/searchQuery.js` + `server/partner/buildPartnerUrl.js`: 파라미터 스키마 어긋남 위험.
- `src/services/cars.js` + `server/partner/mapPartnerDto.js`: DTO shape mismatch 위험.
- `server/search-db/*` (신규) + `api/search-cars.js`: 서비스 계약 잠기기 전 wiring 시도 금지.

# 7. merge 위험요소
- 검색 파라미터 normalize 기준 불일치 → delivery/dongId null 처리 차이.
- DTO shape 선변경 → 프론트 카드 렌더링 오류.
- partner fetch 실패 처리와 DB fallback 순서 뒤섞임 → 500/502 대응 깨짐.
- shadow mode 로깅 누락 → diff 근거 없이 전환.

# 8. 구현 전 체크리스트
1. 계약 문서 최신 여부 (`present/*`)
2. 샘플 쿼리 세트 확보 여부 (Phase 0 결과)
3. DB read model 설계 승인 여부
4. shadow mode diff 스키마 승인 여부
5. 담당자별 파일 소유권 확정
6. feature flag 전략 합의 (`searchDbEnabled`, 등)
7. rollback 경로 (`31f55f2`) 재확인

# 9. 변경 제안 파일
- `server/search-db/` 디렉터리 신설 (service, mapper, diff logger)
- `docs/agents/search-db-wiring/results/SHADOW_MODE_SPEC.md` (확인 필요: 문서 존재 여부)
- `docs/present/IMPLEMENTATION_RULES_PRESENT.md` 내 ownership 표 업데이트 (필요 시)

# 10. 금지/주의 파일
- 금지: `api/search-cars.js`, `src/utils/searchQuery.js`, `src/services/cars.js`, `server/partner/buildPartnerUrl.js`, `server/partner/mapPartnerDto.js` (단일 담당자 외 수정 금지)
- 주의: `src/components/*` (검색 뷰), `server/partner/*` 다른 파일 (DB 로직 섞지 말 것)

# 11. 확인 필요 사항
- shadow mode 결과 저장 위치(DB vs 로그) 미확정 → **확인 필요**
- DB 검색 서비스 명명(`server/search-db` vs `server/search`) 최종 결정 → **확인 필요**
- feature flag 노출 방식(환경변수 vs Supabase config) → **확인 필요**

# 12. 다음 단계
1. 오케스트레이터가 본 문서를 기준으로 담당자 매핑.
2. shadow mode/diff 설계 문서 작성 에이전트 배정.
3. DB read model 스펙 작성/검토 후 공유.
4. 통합 담당자가 `api/search-cars.js` 수정 계획 수립 (phase 기반).
