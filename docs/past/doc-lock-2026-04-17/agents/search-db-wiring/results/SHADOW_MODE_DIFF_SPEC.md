# Shadow Mode / Diff Logging Spec

## 1. 결론
- shadow mode 는 `GET /api/search-cars` 핸들러 내부에서 partner 기준 응답을 유지한 채, 동일한 normalized 검색 파라미터로 `dbSearchService.run()` 을 **동시에 실행**하고 diff 를 산출·기록하는 방식이 가장 안전하다.
- diff 는 `searchSessionId` 없이도 재현 가능한 **`searchHash + timestamp` 조합**으로 키를 구성하고, 결과 수/차량 id/정렬/가격/제외 사유의 차이를 모두 JSON 스키마로 표준화한다.
- 초기 저장은 Supabase 테이블 `search_shadow_diffs` 에 JSONB 컬럼으로 적재하고, 필요 시 로컬 JSONL 파일 백업을 추가하는 이중 저장을 권장한다.
- 전환 판단은 샘플 쿼리 세트(Phase 0 기준)와 실 사용자 호출 모두에서 **차량 수 ±0, 차량 id 100% 일치, 정렬 편차 top-5 이내, 가격 차 0원**을 통과한 상태를 최소 기준으로 삼고, 이탈 항목은 전용 리포트로 누적 요약해 의사결정에 활용한다.

## 2. 근거 파일
- `projects/premove-clone/docs/present/ROADMAP_PRESENT.md`
- `projects/premove-clone/docs/present/VALIDATION_PRESENT.md`
- `projects/premove-clone/docs/present/IMPLEMENTATION_RULES_PRESENT.md`
- `projects/premove-clone/docs/present/PARALLEL_WORKSTREAMS_PRESENT.md`
- `projects/premove-clone/api/search-cars.js`
- `projects/premove-clone/docs/agents/search-db-wiring/COMMON_EXECUTION_PROMPT.md`
- `projects/premove-clone/docs/agents/search-db-wiring/AGENT_C_SHADOW_MODE_SPEC.md`

## 3. 병행 실행 흐름
1. **요청 정규화/검증**: `normalizeSearchState` 와 `validateSearchState` 결과를 단일 `normalizedSearch` 객체로 확보한다. (근거: `api/search-cars.js`).
2. **partner 실행**: 기존 흐름대로 `buildPartnerUrl → fetchPartnerSearch → parsePartnerSearch → mapPartnerSearchDto` 를 수행하고, dto 를 response source 로 유지한다.
3. **DB 실행 (shadow)**:
   - `dbSearchService.run({ search: normalizedSearch })` 를 호출해 DB 기반 결과를 획득한다. 해당 서비스는 `server/search-db/` 계층에 존재하며 shared choke point 밖에서 개발한다. (근거: `IMPLEMENTATION_RULES_PRESENT.md`).
   - DB 실행은 partner 실행과 동일한 normalized 입력을 사용하되, timeout 이 partner 쿼리보다 짧더라도 shadow mode 성능을 우선으로 하지 않는다. 실패 시 diff payload 에 `dbRun.error` 를 기록하고 응답은 계속 partner 기준으로 반환한다.
4. **diff 계산**:
   - 전용 `computeSearchDiff({ partnerDto, dbDto, normalizedSearch })` 함수를 server 계층에 두어, result-level 비교를 책임지게 한다.
   - 비교 항목: 결과 수, 차량 id 목록, index 순서, 가격(정가/할인가), 제외 사유(`availabilityReasons` 등), meta 필드.
5. **로그 비동기 작성**:
   - diff payload 는 `logSearchShadowDiff(diffPayload)` 헬퍼를 통해 DB 테이블과 선택적 JSONL 파일에 비동기 저장한다. 실패해도 사용자 응답을 지연시키지 않도록 `await` 대신 `fire-and-forget` + error swallow/logging 패턴을 사용한다.
6. **응답 반환**: `res.json` 은 현재처럼 partner dto 를 그대로 사용하며, shadow mode flag 가 꺼져 있으면 partner 실행만 수행한다.
7. **feature flag**: `SHADOW_SEARCH_DIFF_ENABLED` 환경 변수 혹은 Supabase `feature_flags` 테이블에서 값을 읽어, flag Off 시 DB 실행과 diff 계산을 완전히 skip 한다. (문서 제안만; 실제 구현 금지).

## 4. diff schema
```json
{
  "id": "uuid",
  "searchHash": "sha1(normalizedSearch)",
  "searchParams": {
    "deliveryDateTime": "2026-05-01T10:00:00+09:00",
    "returnDateTime": "2026-05-02T10:00:00+09:00",
    "pickupOption": "delivery",
    "driverAge": 30,
    "order": "price",
    "dongId": "4111710900",
    "deliveryAddress": "경기 성남시 분당구 수내동"
  },
  "executionMeta": {
    "requestedAt": "2026-05-06T03:12:11.234Z",
    "shadowFlag": true,
    "partnerRuntimeMs": 842,
    "dbRuntimeMs": 121,
    "dbRunStatus": "ok" | "error",
    "dbErrorMessage": null
  },
  "partner": {
    "resultCount": 23,
    "carIds": ["car_101", "car_305", "car_044"],
    "prices": { "car_101": 89000 },
    "ordering": { "car_101": 0, "car_305": 1 },
    "exclusionReasons": { "car_999": "blocked_by_partner" }
  },
  "db": { ... 동일 shape ... },
  "diff": {
    "resultCountDelta": 0,
    "missingInDb": [],
    "extraInDb": ["car_522"],
    "orderVariance": [
      { "carId": "car_305", "partnerIndex": 1, "dbIndex": 3 }
    ],
    "priceDiffs": [
      { "carId": "car_101", "partner": 89000, "db": 87000, "currency": "KRW" }
    ],
    "exclusionVariance": [
      { "carId": "car_777", "partner": "partner_unavailable", "db": "reservation_overlap" }
    ]
  }
}
```
- 비교 키는 **`carId` (partner DTO 기준 `id` 혹은 `sourceCarId`)** 로 통일한다. `VALIDATION_PRESENT.md` 기준으로 프론트 계약을 깨지 않기 위해 기존 DTO 의 차량 id 값을 그대로 사용한다.
- `searchHash` 는 같은 검색 파라미터를 그룹화하기 위한 SHA-1(또는 sha256) 문자열이다.
- `orderVariance` 는 상위 10개 편차만 기록해 로그 폭주를 방지한다.

## 5. 기록 위치 추천안
1. **1순위: Supabase `search_shadow_diffs` 테이블**
   - 컬럼: `id (uuid)`, `created_at`, `search_hash`, `search_params jsonb`, `partner jsonb`, `db jsonb`, `diff jsonb`, `execution_meta jsonb`.
   - 장점: SQL 질의/대시보드화가 쉽고, 전환 전후 히스토리를 장기 보관 가능.
   - 운영: API 서버에서 Supabase service key 로 insert. 실패 시 콘솔 경고만 남기고 흐름 계속.
2. **2순위: 서버 로컬 JSONL 파일 (`logs/search-shadow-diffs.log`)**
   - 장애/DB 접근 실패 시 백업 로그로 활용.
   - weekly logrotate 로 관리. 실시간 분석은 어렵지만 재처리에 유용.
3. **콘솔 로그**
   - 개발 환경에서 flag 를 켜면 `console.info('[shadow-diff]', searchHash, summary)` 정도만 남긴다.
   - 운영 환경에서는 노이즈가 많으므로 기본 비활성화.

초기에는 Supabase insert 가 가장 현실적이며, 파일 로그는 분석가가 raw payload 를 복구할 수 있는 보조 장치로 둔다.

## 6. 샘플 로그 포맷
```jsonl
{"id":"7d2a9c4c-6d9d-4fd7-aacd-1d3613e7d2ab","searchHash":"c4e2c0d9","executionMeta":{"requestedAt":"2026-05-06T03:12:11.234Z","shadowFlag":true,"partnerRuntimeMs":792,"dbRuntimeMs":138,"dbRunStatus":"ok"},"searchParams":{"deliveryDateTime":"2026-05-12T09:00:00+09:00","returnDateTime":"2026-05-13T09:00:00+09:00","pickupOption":"delivery","driverAge":32,"order":"price","dongId":"4111710900","deliveryAddress":"경기 성남시 분당구 수내동"},"diff":{"resultCountDelta":0,"missingInDb":[],"extraInDb":[],"orderVariance":[{"carId":"car_305","partnerIndex":1,"dbIndex":3}],"priceDiffs":[{"carId":"car_101","partner":89000,"db":87000,"currency":"KRW"}],"exclusionVariance":[]}}
```
- JSONL 은 분석 파이프라인/BigQuery 로 재적재하기 쉬워 진단 반복에 유용하다.

## 7. 전환 판단 기준
| 항목 | 기준 | 측정 방법 |
| --- | --- | --- |
| 결과 수 | 모든 샘플·실사용 호출에서 `resultCountDelta = 0` | shadow 로그에서 `diff.resultCountDelta` 집계 |
| 차량 id 일치 | `missingInDb` 및 `extraInDb` 빈 배열 | 차이 존재 시 차량 단위 원인 기록 |
| 정렬 편차 | 상위 5개에서 index 차이 <= 1 | `orderVariance` 필드에서 허용치 초과 시 조정 |
| 가격 | `priceDiffs` 빈 배열 (±0 KRW) | 가격 계산 로직 보정 |
| 제외 사유 | `exclusionVariance` 빈 배열 | 예약 겹침/상태 규칙 재교정 |
| 안정성 | shadow mode 1주 이상, 에러율 < 1% | `executionMeta.dbRunStatus` | 

전환 승인 전에는 위 지표를 일/주 단위 리포트로 시각화한다. 샘플 리포트는 아래 열을 갖는다: `search_hash`, `call_count`, `resultCount_delta_rate`, `missing_car_ids`, `price_diff_max`, `order_variance_pct`, `last_seen_at`. Flag 가 허용 기준을 만족할 때만 DB 응답을 기본값으로 스위치한다.

## 8. 변경 제안 파일
- `server/search-db/dbSearchService.js` (신규) — DB 결과 산출 + shadow mode 진입 포인트 제공.
- `server/search-db/computeSearchDiff.js` (신규) — partner/db dto 비교.
- `server/search-db/logSearchShadowDiff.js` (신규) — Supabase insert + JSONL append.
- `api/search-cars.js` — 기존 응답 유지 상태에서 shadow mode 호출을 삽입 (단일 통합 담당자 작업용).
- `scripts/reports/render-shadow-diff-report.js` (선택) — 전환 전 리포트 생성 CLI.

## 9. 금지/주의 파일
- `api/search-cars.js`: 통합 전까지 다중 에이전트 수정 금지 (shared choke point, 근거: `IMPLEMENTATION_RULES_PRESENT.md`).
- `server/partner/mapPartnerDto.js`: DTO shape 변경 금지.
- `src/services/cars.js`: 프론트 소비 계약 유지.
- `server/partner/buildPartnerUrl.js`: query contract 잠금.
- `docs/present/*`: 현재 기준 문서, 동의 없이 수정 금지.

## 10. 확인 필요 사항
- Supabase 프로젝트 내에서 `search_shadow_diffs` 테이블 생성 권한/리소스 확보 여부 — **확인 필요**.
- `carId` 기준이 partner DTO 의 `id` 와 DB 의 `cars.id` 가 1:1 매핑되는지, 혹은 `sourceCarId` 변환이 필요한지 — **확인 필요**.
- shadow mode 에서 허용할 최대 실행 시간(예: partner 1.5초, DB 400ms)을 어디에 맞출지 — **확인 필요**.

## 11. 다음 단계
1. `server/search-db/dbSearchService` 및 diff 계산 헬퍼의 문서 초안을 다른 에이전트 산출물과 정합성 체크.
2. Supabase `search_shadow_diffs` 테이블 스키마 초안 공유 및 생성 승인 획득.
3. 샘플 쿼리 세트(Phase 0)와 shadow 로그를 연결하는 리포트 스크립트 초안 작성.
4. feature flag 명세 (`SHADOW_SEARCH_DIFF_ENABLED`) 를 통제 문서에 추가하고 오케스트레이터 승인 후 통합 담당자가 코드 삽입.
