# COMPETITOR PRICE MONITORING MVP PHASE PLAN

## Purpose
경쟁사 가격을 내부에서 수집·정규화·비교하고, 운영자가 HTML/CSV/JSON 리포트로 확인한 뒤 기준가격 수정 없이 1주일 할인 레이어 제안을 검토할 수 있는 MVP를 만든다.

## Baseline
- 기준 프로젝트: `rentcar00-booking-system`
- 현재 브랜치: `feat/db-preview-home`
- 현재 active goal: `docs/GOAL/CURRENT_GOAL_LOCK.md`
- MVP 실행 위치: 로컬/내부 운영 환경
- MVP 결과물: `artifacts/competitor-monitoring/` 아래 HTML/CSV/JSON 리포트
- 운영 DB/Supabase migration/Vercel 배포/관리자 API 변경은 초기 MVP 밖이다.
- 자동반영/기준가격 직접 수정은 MVP 밖이다.

## Confirmed Phase 1 Findings
- 자사 검색 진입점: `api/search-cars.js` → `server/search-db/dbSearchService.js`
- 자사 가격 계산: `v_search_pricing_hub_policies` → `server/search-db/pricing/calculateGroupPrice.js`
- 가용성 판정: `ims_sync_reservations` + `booking_orders` overlap 기준
- 관리자 가격 화면: `src/pages/AdminPricingHubPage.jsx`, `api/admin/pricing-hub.js`
- 미예약 차량 판정은 IMS 예약과 홈페이지 예약을 함께 봐야 한다.

## Phase 0. 현황 재확인 - 완료
- 목적: 기존 검색/가격/프라이싱 허브/관리자 패널 구조를 확인한다.
- 수정 대상: 없음. 읽기 전용.
- 종료 조건:
  - 자사 가격 계산 경로 확인
  - 관리자 패널 확장 지점 확인
  - DB/migration 필요 여부 확인
- 검증: 관련 파일 목록과 호출 흐름 요약.
- 결과: 초기 MVP는 DB/관리자 패널이 아니라 내부 엔진으로 분리하는 것이 안전하다.

## Phase 2. 내부 엔진 설계 - 현재 승인 범위
- 목적: DB 없이 로컬에서 실행 가능한 경쟁사 가격 모니터링 엔진의 구조와 입출력 포맷을 잠근다.
- 수정 대상: 문서만 수정한다. 코드/DB/배포는 수정하지 않는다.
- 포함:
  - 내부 엔진 폴더 후보: `scripts/competitor-monitoring/`
  - 리포트 출력 폴더 후보: `artifacts/competitor-monitoring/`
  - 입력 파일 포맷: 수동 입력 CSV/JSON
  - 출력 파일 포맷: normalized JSON, compare CSV, HTML 리포트
  - 모델 매칭 기준
  - 1일/3일/5일 및 지역별 1일 비교 기준
  - 1주일 할인 레이어 추천식 초안
- 종료 조건:
  - 내부 엔진 폴더 구조 확정
  - 입력/출력 샘플 스키마 확정
  - 추천 계산 기준 초안 확정
  - DB 없이 MVP 검증 가능한 상태
- 검증:
  - 샘플 3개 모델 × 1/3/5일 데이터로 표현 가능한지 점검
  - 자사 가격 대비 경쟁사 최저/평균/차액/추천 할인 표시 가능 여부 점검
- 리스크:
  - 경쟁사 가격 조건이 보험/면책/수수료 포함 여부에 따라 왜곡될 수 있음
  - 모델명 매칭이 부정확할 수 있음
  - 수동 입력 단계는 운영 피로도가 있음
- 되돌릴 방법:
  - Phase 문서에서 내부 엔진 설계 섹션을 ARCHIVE 처리한다.

## Phase 3. 내부 수집/입력 MVP
- 목적: 자동 수집 전, 수동 입력 또는 반자동 파일 입력으로 raw snapshot을 만든다.
- 수정 대상 후보:
  - `scripts/competitor-monitoring/`
  - `artifacts/competitor-monitoring/samples/`
- 포함:
  - 플랫폼별 adapter 인터페이스는 파일 입력 adapter부터 시작
  - raw 입력 보존
  - 모델 매칭 후보 생성
  - 실패/누락 로그 파일 출력
- 종료 조건: 샘플 1개 플랫폼 이상의 1/3/5일 가격 snapshot 생성.
- 리스크: 자동 수집으로 확대할 경우 약관/차단/동적 페이지 이슈.

## Phase 4. 내부 비교·추천 엔진
- 목적: 자사 가격과 경쟁사 가격을 비교하고 할인 제안을 만든다.
- 포함:
  - 모델별 1/3/5일 비교
  - 지역별 1일 비교
  - 경쟁사 최저/중앙/평균가
  - 자사 가격 대비 차이
  - 1주일 할인 레이어 제안값
- 종료 조건: 자동반영 없이 추천값만 산출.
- 리스크: 추천식이 과도하면 마진 훼손 가능.

## Phase 5. 내부 리포트 MVP
- 목적: 운영자가 가격 비교와 추천을 파일로 확인할 수 있게 한다.
- 포함:
  - HTML 리포트
  - CSV 비교표
  - JSON 원본/정규화 결과
  - 매칭 불확실 표시
  - 추천 할인 레이어 preview
- 종료 조건: 브라우저에서 HTML 리포트를 열어 확인 가능.
- 리스크: 관리 화면이 아니므로 다중 사용자 운영에는 부적합.

## Phase 6. 운영방침 문서화 및 승격 판단
- 목적: 월요일 1회, 이번 주 평일, 미예약 차량 대상 할인 제안 운영 기준을 문서화하고, 필요 시 DB/관리자 패널 승격 여부를 판단한다.
- 포함:
  - 자동반영 제외
  - 기준가격 직접수정 제외
  - 1주일 할인 레이어 방식
  - 실패/누락 데이터 처리
  - DB/관리자 패널 승격 기준
- 종료 조건: 운영자가 내부 리포트를 보고 수동 판단할 수 있는 절차 확정.
- 검증: 샘플 데이터 기준 리포트·추천값 확인.

## Internal Engine Draft Structure
```txt
scripts/competitor-monitoring/
  README.md
  run-competitor-monitoring.js
  lib/
    inputCsv.js
    normalizeCompetitorPrice.js
    matchOwnModel.js
    comparePrices.js
    recommendDiscountLayer.js
    renderHtmlReport.js
  samples/
    competitor-prices.sample.csv
    own-prices.sample.json

artifacts/competitor-monitoring/
  YYYY-MM-DD/
    raw-competitor-prices.json
    normalized-competitor-prices.json
    own-price-snapshot.json
    comparison.csv
    recommendation.json
    report.html
```

## Input Schema Draft
### competitor-prices.csv
```csv
platform,region,rental_start_date,rental_days,competitor_model_name,trim_or_grade,price_total,insurance_included,fee_included,collected_at,source_ref,notes
카모아,서울,2026-05-25,1,쏘나타 DN8,,65000,unknown,unknown,2026-05-24T09:00:00+09:00,manual,
카모아,서울,2026-05-25,3,쏘나타 DN8,,180000,unknown,unknown,2026-05-24T09:00:00+09:00,manual,
카모아,서울,2026-05-25,5,쏘나타 DN8,,280000,unknown,unknown,2026-05-24T09:00:00+09:00,manual,
```

### own-price-snapshot.json
```json
{
  "collectedAt": "2026-05-24T09:00:00+09:00",
  "source": "rentcar00-search",
  "items": [
    {
      "region": "서울",
      "rentalStartDate": "2026-05-25",
      "rentalDays": 1,
      "ownModelName": "쏘나타 DN8",
      "ownGroupId": "확인 필요",
      "availableCarCount": 2,
      "ownPriceTotal": 70000,
      "baseDailyPrice": 80000
    }
  ]
}
```

## Output Schema Draft
### recommendation.json
```json
{
  "generatedAt": "2026-05-24T09:00:00+09:00",
  "policy": {
    "mode": "weekly_discount_layer_only",
    "autoApply": false,
    "basePriceChange": false,
    "target": "weekday_unbooked_cars"
  },
  "items": [
    {
      "region": "서울",
      "ownModelName": "쏘나타 DN8",
      "rentalDays": 1,
      "ownPriceTotal": 70000,
      "competitorMinPrice": 65000,
      "competitorAveragePrice": 67000,
      "gapToMin": 5000,
      "recommendedDiscountAmount": 5000,
      "recommendedWeeklyLayerPrice": 65000,
      "confidence": "medium",
      "reason": "경쟁사 최저가 대비 5,000원 높음. 자동반영 없이 운영자 검토 필요."
    }
  ]
}
```

## Recommendation Rule Draft
- 기준가격은 바꾸지 않는다.
- 추천은 `1주일 할인 레이어`로만 표현한다.
- 기본 추천 기준:
  1. 경쟁사 최저가가 자사 가격보다 낮으면 차액만큼 할인 후보로 표시한다.
  2. 할인 후보는 1,000원 단위로 반올림한다.
  3. 추천 할인 후 가격은 경쟁사 최저가보다 과도하게 낮추지 않는다.
  4. 보험/면책/수수료 포함 여부가 불명확하면 confidence를 `low` 또는 `medium`으로 둔다.
  5. 미예약 차량 수가 0이면 추천하지 않는다.
- 월요일 운영 기준:
  - 이번 주 평일 대상
  - 예약 없는 차량 우선
  - 자동반영 금지
  - 운영자 확인 후 별도 수동 조치

## Approval Boundary
이 문서는 계획 문서다. 코드 생성, DB migration, 외부 호출, 배포, 운영 설정 변경은 별도 명시 승인 후 진행한다.
