# 2026-05-13 RENTCAR00 PRICING HUB WEEKDAY WEEKEND BASELINE CURRENT

## 문서 상태
- 상태: completed handoff current
- 목적: PRICING_HUB의 weekday / weekend 기준값을 다시 잠그고, 이 변경을 메인 검색 연결 current와 분리해서 먼저 확정한다.

## 이 문서의 역할
- 이 문서는 **weekday / weekend 기준 재정의와 baseline 재구성**만 다룬다.
- 검색 조회 전환, 계산식 반영, 메인 current 전체 phase 진행은 이 문서 범위 밖이다.
- 즉 이 문서는 메인 current로 다시 넘어가기 전에 **선행 기준을 잠그는 current**다.

## 연결 문서
- 메인 current:
  - `docs/present/2026-05-13_RENTCAR00_CURRENT.md`
- 계산식 current:
  - `docs/present/2026-05-13_RENTCAR00_PRICING_FORMULA_CURRENT.md`
- 장기 허브 정책:
  - `docs/policies/RENTCAR00_PRICING_HUB.md`

## 현재 확인된 상태
1. `v_search_pricing_hub_policies` view 는 이미 반영됐다.
2. fallback 기준값을 기준으로 `pricing_hub_periods`, `pricing_hub_rates` baseline 입력도 완료됐다.
3. 그러나 현재 baseline 은 사장님 기준과 다르다.
4. 특히 아래 두 항목을 다시 잠가야 한다.
   - `weekday_24h_price`
   - `weekend_24h_price`
5. 검색용/검토용 view 에 포함된 상태 플래그 컬럼은 최종 검색값 관점에서는 제거 대상이다.
   - `has_hub_common_rate`
   - `has_hub_weekday_rate`
   - `has_hub_weekend_rate`
   - `uses_anchor_fallback`

## 이번 current에서 새로 잠그는 기준
### 1. 저장 구조 선택
사장님 결정:
- **절대값 저장형 + 비율 파생**으로 간다.

의미:
1. search 와 hub 가 실제로 읽는 truth 는 **절대값 컬럼**이다.
2. 다만 weekday / weekend 값은 임의 절대값이 아니라 **base24h 기준 비율 규칙으로 생성/조정**한다.
3. 비율은 운영/검토 기준으로 사용하고, 실제 저장 결과는 `pricing_hub_rates.fee_24h` 절대값으로 남긴다.

### 2. 기본 비율 기준
- `weekday = base24h의 -10%`
- `weekend = base24h의 +15%`

수식:
- `weekday_24h_price = round(base24h * 0.90)`
- `weekend_24h_price = round(base24h * 1.15)`

### 3. 그룹별 조정 가능 원칙
- 위 기준은 전역 고정 상수라기보다 **기본 baseline 규칙**이다.
- 각 그룹은 필요 시 weekday / weekend 값을 따로 조정할 수 있어야 한다.
- 단, 조정 이후에도 search 가 읽는 값은 **최종 절대값**이다.

즉:
- 기본 생성 규칙은 비율
- 저장/조회 truth 는 절대값
- 그룹별 운영 조정은 허용

## truth 해석 기준
### 공통값
- `base24h` 는 common truth 다.
- `hour_1_price`, `week_1_price`, `week_2_price`, `month_1_price` 도 절대값 truth 다.

### 주중/주말값
- `weekday_24h_price` 와 `weekend_24h_price` 는 search 가 직접 읽는 절대값 truth 다.
- `weekdayPercent`, `weekendPercent` 같은 값은 운영 화면에서 계산/표시할 수는 있지만 **파생값**이다.
- 즉 퍼센트는 설명값이고, 금액이 truth 다.

## 제거 대상 컬럼
검색용 read model 최종 정리 단계에서 아래 컬럼은 제거 대상으로 본다.
- `has_hub_common_rate`
- `has_hub_weekday_rate`
- `has_hub_weekend_rate`
- `uses_anchor_fallback`

이유:
1. 검증 단계에서는 유용하지만
2. 최종 search 입력값/엑셀 검토값 관점에서는 노이즈가 크다.
3. 운영 검토용 표에도 필수값이 아니다.

## baseline 재구성 기준
### baseline 재생성 대상
- `pricing_hub_periods`
- `pricing_hub_rates`
- 검토용 엑셀 출력 구조

### baseline 재생성 규칙
1. `base24h` 는 현재 그룹별 common 기준값을 사용한다.
2. `weekday_24h_price` 는 `base24h * 0.90` 기준으로 다시 계산한다.
3. `weekend_24h_price` 는 `base24h * 1.15` 기준으로 다시 계산한다.
4. `hour_1_price`, `week_1_price`, `week_2_price`, `month_1_price` 는 별도 current 충돌이 없는 한 기존 잠금 기준을 유지한다.
5. 이후 그룹별 조정이 필요하면 각 그룹 절대값을 별도로 수정 가능해야 한다.

## phase
### Phase 1. baseline 기준 재잠금
- weekday / weekend 새 기준을 이 문서에 잠근다.
- 절대값 저장형 + 비율 파생 구조를 명시한다.

### Phase 2. 영향 범위 잠금
- 어떤 컬럼을 유지하고 어떤 컬럼을 제거할지 잠근다.
- 메인 current와 분리된 선행 작업임을 잠근다.

### Phase 3. baseline 재생성 실행
- 기존 baseline period/rate 를 새 기준으로 다시 생성/수정한다.
- 검토용 엑셀도 새 기준으로 다시 뽑는다.

### Phase 4. 검토 완료 후 메인 current 복귀
- 이 문서 기준이 맞는지 확인한다.
- 확인 완료 후 메인 current 의 Phase 5~9 로 다시 넘어간다.

## 종료 조건
1. weekday / weekend 기준이 `-10% / +15%` 로 잠긴다.
2. 절대값 저장형 + 비율 파생 구조가 흔들리지 않는다.
3. 제거 대상 상태 플래그가 명시된다.
4. baseline 재생성 후 검토용 출력 기준이 정리된다.
5. 그다음 메인 current 로 복귀할 수 있다.

## 중단 조건
- weekday / weekend 를 퍼센트 truth 로 다시 해석해야 한다는 요구가 생기면 즉시 중단
- `hour_1_price`, `week_1_price`, `week_2_price`, `month_1_price` 기준까지 동시에 다시 바꿔야 하면 즉시 중단
- 그룹별 조정 구조가 절대값 저장형으로 설명되지 않으면 즉시 중단

## 완료 처리
- weekday / weekend baseline 기준은 `절대값 저장형 + 비율 파생`으로 잠갔다.
- `weekday -10%`, `weekend +15%` 기준으로 baseline 재적용을 마쳤다.
- 천원단위 올림 기준 반영과 검토용 파일 재업로드까지 마쳤다.
- 다음 진행은 이 문서가 아니라 메인 current 에서 이어간다.

## 한 줄 결론
이 current 는 **PRICING_HUB weekday / weekend baseline 을 잠그는 선행 current**였고, 필요한 기준 반영이 끝났으므로 이제 메인 current 로 복귀해 **Phase 5 검산 → Phase 6 조회 전환 설계 준비**로 이어간다.
