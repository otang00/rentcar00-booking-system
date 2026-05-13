# 2026-05-12 RENTCAR00 PRICING 7D / 15D / 30D CURRENT

## 문서 상태
- 상태: active current
- 목적: 다음 작업 범위를 `7일 / 15일 / 30일(월차)` 가격 기준 정리, 컬럼 점검, 계산식 검증으로 잠근다.
- 직전 완료: KCP 결제창 분기 작업은 과거 문서로 이동했다.

## 현재 기준점
1. `pricing_hub_rates` 에 이미 있는 장기 관련 저장 컬럼
   - `week_1_price` = 7일
   - `week_2_price` = 현재 14일 의미로 쓰이고 있음
   - `month_1_price` = 30일
2. IMS 월요금 source 기준 필드
   - `d15_total_cost`
   - `d15_daily_cost`
   - `m1_total_cost`
   - `m1_daily_cost`
3. 현재 문제
   - 사장님이 다음 기준으로 보려는 값은 `7일 / 15일 / 30일`
   - 그런데 현재 local pricing hub 저장 구조는 `14일` 중심 흔적이 남아 있다.
   - 즉 **15일 기준을 별도 의미로 잠그고 컬럼/계산식을 다시 맞춰야 한다.**

## 이번 작업 목표
1. `7일 / 15일 / 30일` 을 현재 운영 기준 기간으로 잠근다.
2. 15일 기준에 필요한 저장 컬럼이 현재 구조에 없으면 추가한다.
3. 30일(월차) 계산에 필요한 source/derived 필드를 구분한다.
4. 계산식을 IMS 운영 기대값과 local pricing hub 기준 중 무엇을 source-of-truth 로 삼을지 명확히 한다.

## 잠그는 해석
### 1. 7일
- local pricing hub 에서 직접 관리/저장 가능한 주간 가격
- 현재 `week_1_price` 를 7일 의미로 유지 가능

### 2. 15일
- 더 이상 `14일 비슷한 중간값` 으로 두지 않는다.
- **명시적으로 보름(15일) 패키지 가격**으로 해석한다.
- IMS monthly source 와 맞추려면 최소 아래 의미가 필요하다.
  - `d15_total_cost`
  - 필요 시 `d15_daily_cost`

### 3. 30일
- `month_1_price` 는 30일 총액 의미로 유지 가능
- 다만 장기 잔여일 계산까지 맞추려면 `m1_daily_cost` 의미도 필요하다.

## 컬럼 점검 결과
### 이미 있는 것
- `week_1_price`
- `week_2_price`
- `month_1_price`

### 현재 구조상 애매하거나 부족한 것
- `week_2_price` 는 이름상 14일/2주 느낌이라 **15일 기준과 의미 충돌** 가능
- 아래 필드는 `pricing_hub_rates` 에 아직 없다.
  - `d15_total_cost`
  - `d15_daily_cost`
  - `m1_daily_cost`
- `month_1_price` 가 있더라도, 30일 초과/잔여일 계산까지 고려하면 `m1_total_cost` 와 `m1_daily_cost` 분리 의미가 필요하다.

## 이번 작업의 우선 판단
1. **7일은 기존 컬럼 재사용 가능**
2. **15일은 신규 기준으로 재정의 필요**
3. **30일은 총액 컬럼은 이미 있지만, 계산식 검증용 일차 컬럼이 추가로 필요할 가능성이 큼**

## 실행 phase
### Phase 1. 기준 잠금
목적
- 기간 기준을 `7일 / 15일 / 30일` 로 확정한다.

확인 항목
- 기존 `week_2_price` 를 15일로 재해석할지
- 아니면 15일 전용 신규 컬럼을 추가할지
- local pricing hub 와 IMS monthly source 중 어느 쪽을 기준 source 로 삼을지

권장안
- `week_2_price` 는 억지 재사용하지 않는다.
- 15일은 의미가 분명한 별도 컬럼으로 둔다.

종료 조건
- 7/15/30 각 컬럼의 의미가 모호하지 않다.

### Phase 2. 스키마 점검 및 컬럼 추가
목적
- 필요한 컬럼을 실제 DB/코드 저장 구조에 반영한다.

우선 검토 대상
- `pricing_hub_rates`
- 관련 조회 view / API payload
- 관리자 editor state

추가 후보 컬럼
- `d15_total_cost`
- `d15_daily_cost`
- `m1_daily_cost`
- 필요 시 `m1_total_cost` 는 `month_1_price` 와의 중복 여부를 보고 유지/매핑 결정

종료 조건
- 어떤 컬럼을 새로 만들고 어떤 컬럼을 재사용하는지 확정된다.

### Phase 3. 계산식 검증
목적
- 7일/15일/30일 preview 와 저장값 계산식을 잠근다.

검토 기준
- 7일: local 운영 기준
- 15일: IMS 보름 패키지 기준
- 30일: IMS 월차 패키지 기준
- 15일 이상/30일 이상 잔여일 계산 시 cap 규칙 유지 여부

확인 대상 식
- `15일 이상 30일 미만`
  - `min(d15_total_cost + ((days - 15) * d15_daily_cost), m1_total_cost)`
- `30일 이상`
  - `months * m1_total_cost + remain_cost`
  - remain 규칙은 `d15_total_cost`, `m1_daily_cost`, `m1_total_cost` cap 구조 재검증

종료 조건
- 7/15/30 preview 계산과 저장값 의미가 일치한다.

### Phase 4. 관리자 UI/저장 연결
목적
- 관리자 화면에서 7일/15일/30일 기준이 보이고 저장되게 한다.

종료 조건
- 운영자가 각 기간 값을 보고 저장할 수 있다.
- API/DB 저장값과 화면 preview 가 일치한다.

## 수정 대상 후보
- `supabase/migrations/*`
- `api/admin/pricing-hub.js`
- `src/pages/AdminPricingHubPage.jsx`
- `docs/present/2026-05-01_RENTCAR00_PRICING_POLICY_V1_CURRENT.md`
- `docs/present/2026-05-01_RENTCAR00_PRICING_HUB_MONTHLY_SOURCE_CURRENT.md`

## 리스크
1. `week_2_price` 를 15일로 덮어쓰면 기존 14일 가정 코드와 충돌할 수 있다.
2. `month_1_price` 와 `m1_total_cost` 의미를 섞으면 총액/일차 계산이 흔들릴 수 있다.
3. source-of-truth 를 잠그지 않고 UI부터 바꾸면 저장값 의미가 다시 흔들린다.

## 한 줄 결론
다음 active 작업은 `7일 / 15일 / 30일` 가격 기준을 다시 잠그고, 15일/30일 계산에 필요한 컬럼과 계산식을 pricing hub 구조에 맞게 재정의하는 것이다.
