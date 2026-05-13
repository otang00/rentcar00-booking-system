# 2026-05-14 RENTCAR00 ADMIN PRICING HUB EXECUTION READY CURRENT

## 문서 상태
- 상태: active current
- 목적: admin 통합요금체제 수정 작업의 기준점과 실행 준비 범위를 잠근다.

## 현재 작업명
- **ADMIN 통합요금체제 정비 작업**

## 현재 기준점
1. search / reservation 쪽은 production 반영 완료 상태다.
2. `v_search_pricing_hub_policies` 는 검색용 최종 출력값을 천원단위 올림으로 맞췄다.
3. 옵션 타입 truth 는 `price_policy_groups.pricing_option_type` 기준이다.
4. admin 다음 개편안은 **최종 금액 직접입력형이 아니라 변수형(A안)** 으로 잠근다.
5. 즉 저장 truth 는 `base24h + weekdayPercent + weekendPercent + pricingOptionType` 이다.
6. 파생 금액은 저장 truth 가 아니라 계산 결과다.
7. 다음 작업은 검색 연결이 아니라 **admin 운영 체계 정리**다.
8. admin 개편 전에 DB / view / dead code cleanup 후보를 먼저 잠근다.

## 이번 current 범위
- `api/admin/pricing-hub.js`
- `src/pages/AdminPricingHubPage.jsx`
- 필요 시 `src/services/adminPricingHubApi.js`
- 필요 시 admin이 읽는 view / migration

## 이번 current에서 풀 문제
1. admin 화면의 통합요금체제 개념을 더 명확히 정리한다.
2. 운영자가 가격그룹 단위로 무엇을 보고 무엇을 수정하는지 구조를 단순화한다.
3. preview 성격 값과 실제 저장 truth 를 구분한다.
4. 옵션 타입 / 기준24 / 주중 / 주말 변수 저장 흐름을 운영 기준으로 다시 잠근다.
5. 앵커/시간대 금액은 직접입력값이 아니라 계산 결과로 정리한다.
6. 그룹 리스트를 운영 탐색 기준에 맞게 정렬/요약한다.
7. 그룹 설정 추가 / 그룹 설정 변경 기능의 구현 방향을 잠근다.

## 고정 truth
### 저장 truth
- `price_policy_groups.pricing_option_type`
- `pricing_hub_periods`
- `pricing_hub_rates`

### 저장 의미
- `common.fee_24h` = `base24h`
- `weekday.fee_24h` / `weekend.fee_24h` 는 직접 금액 truth 가 아니라 `weekdayPercent` / `weekendPercent` 의 계산 결과로 본다.
- `fee_1h`, `week_1_price`, `week_2_price`, `month_1_price` 도 직접입력 truth 가 아니라 `base24h + pricingOptionType` 기반 계산 결과로 본다.
- 즉 `pricing_hub_rates` 는 최종금액 입력 원장이 아니라 **변수형 정책을 계산해 저장하는 파생 저장 구조**로 본다.

### search truth
- `v_search_pricing_hub_policies`
- 검색용 출력값은 천원단위 올림 기준

### admin truth
- admin은 **변수형(A안)** 화면으로 본다.
- 운영자가 직접 수정하는 truth 는 아래 4개다.
  - `base24h`
  - `weekdayPercent`
  - `weekendPercent`
  - `pricingOptionType`
- 금액 필드는 저장용 입력이 아니라 계산 결과/미리보기다.

## 작업 전 확인 포인트
1. admin이 실제로 수정해야 하는 최소 필드가 아래 4개로 충분한지
   - `base24h`
   - `weekdayPercent`
   - `weekendPercent`
   - `pricingOptionType`
2. 현재 단일 편집 폼이 운영 관점에서 충분히 단순한지
3. 가격그룹 선택 단위와 표시 문구가 혼동 없는지
4. common / weekday / weekend / anchor 계산값을 한 화면에서 어떻게 보여주는 게 맞는지
5. 저장 시 `pricing_hub_rates` 를 계산 결과로 계속 쓸지, 더 얇은 변수 저장 구조로 바꿀지

## admin UI 현재 상태
### 현재 화면이 하는 일
- 좌측에서 `가격그룹 / 정책 목록` 을 고른다.
- 우측에서 아래 4개를 수정한다.
  - `pricingOptionType`
  - `base24h`
  - `weekdayPercent`
  - `weekendPercent`
- 같은 화면 하단에서 계산 결과로
  - `주중 24시간`
  - `주말 24시간`
  - `1시간`
  - `7일`
  - `14일`
  - `30일`
  을 바로 보여준다.

### 현재 UI 문제
1. 화면 상단 설명은 `기준값, 가격그룹 옵션, 주중/주말 비율` 이라고 쓰지만, 사용자는 계산값과 저장값의 구분을 바로 이해하기 어렵다.
2. `주중 24시간 요금`, `주말 24시간 요금` 이 저장값처럼 보이지만 실제로는 `%` 기반 계산 결과다.
3. `수정` 버튼이 계산 카드 안에 바로 붙어 있어, 무엇이 입력값이고 무엇이 미리보기인지 경계가 약하다.
4. 좌측 목록에는 `주중24 / 주말24` 결과값만 보여서, 운영자가 실제 저장 변수(`base24h`, `%`, 옵션타입)를 빠르게 비교하기 어렵다.
5. `불러온 최초 기준금액` 문구는 의미가 약하다. 현재 운영 기준으로는 `현재 저장된 기준 24시간` 또는 `현재 적용 기준값` 이 더 명확하다.
6. `기존 정책` 이라는 문구는 legacy 정책명인지 현재 적용 정책명인지 직관이 약하다.

## admin UI 정리 방향
### 원칙
- 화면은 **변수 입력 4개 + 계산 결과 미리보기** 구조로 단순화한다.
- 계산 결과는 읽기 전용으로 보이게 하고, 입력값처럼 보이지 않게 구분한다.
- 운영자가 한 번에 이해해야 하는 기준은 `기준24 / 주중% / 주말% / 옵션타입` 네 개뿐이다.
- 리스트 탐색은 `낮은 가격순` 을 기본으로 둔다.

### 화면 구조 권장안
#### 1. 좌측 목록
- 기본 정렬: **가격 낮은순**
  - 1차 기준: `currentRateSummary.weekday24h`
  - fallback: `currentRateSummary.base24h` 또는 `legacyPolicy.baseDailyPrice`
- 유지 정보
  - 그룹명
  - 정책명
  - 옵션타입
- 추가 검토 정보
  - `base24h`
  - `weekdayPercent`
  - `weekendPercent`
  - 계산된 `주중24 / 주말24`
- 목적: 목록 단계에서 어떤 그룹이 어떤 변수 상태인지 빠르게 비교 가능하게 한다.

#### 2. 우측 상단: 현재 그룹 요약
- `IMS 그룹`
- `그룹명`
- `정책명`
- `차량번호`
- `현재 저장 변수 요약`
  - 기준24
  - 주중%
  - 주말%
  - 옵션타입

#### 3. 우측 중단: 변수 입력 카드
- 입력 가능 필드만 배치
  - 가격그룹 옵션
  - 기준 24시간 금액
  - 주중 비율(%)
  - 주말 비율(%)
- 버튼 문구도 `수정` 보다 `저장` 이 더 명확하다.
- 필요 시 `초기값 복원` 또는 `현재 저장값 다시 불러오기` 버튼 검토

#### 4. 우측 하단: 계산 결과 카드
- 읽기 전용 라벨 명확화
  - `계산된 주중 24시간`
  - `계산된 주말 24시간`
  - `계산된 1시간`
  - `계산된 7일 / 14일 / 30일`
- 저장 truth 가 아니라는 점이 UI 문구로 드러나야 한다.

### 문구 정리 권장안
- `불러온 최초 기준금액` → `현재 저장된 기준 24시간`
- `기존 정책` → `정책명` 또는 `연결 정책`
- `수정` → `저장`
- `주중 24시간 요금` → `계산된 주중 24시간`
- `주말 24시간 요금` → `계산된 주말 24시간`

### 실행 전 잠금 포인트
1. UI는 최종금액 직접입력형으로 확장하지 않는다.
2. 주중/주말 24h는 입력칸이 아니라 계산 결과 표시로 유지한다.
3. 1시간/7일/14일/30일도 읽기 전용 미리보기로 유지한다.
4. 저장 액션은 변수 4개만 대상으로 본다.
5. 재조회 시에도 같은 변수값과 같은 계산 결과가 보여야 한다.
6. 좌측 그룹 리스트는 낮은 가격순 기본 정렬로 고정한다.

## 그룹 설정 추가 / 그룹 설정 기능 방향
### 목표
- 아직 설정이 없는 그룹도 admin에서 직접 연결할 수 있게 한다.
- 기존 설정 그룹은 현재 연결 정책과 옵션타입을 안전하게 수정할 수 있게 한다.

### 그룹 설정의 의미
이 작업에서 `그룹 설정` 은 아래를 뜻한다.
1. `car_group` 와 `price_policy` 연결 생성/변경
2. `price_policy_groups.pricing_option_type` 설정
3. 필요 시 `active` 상태 관리

### 구현 원칙
- `기존 그룹 수정` 과 `새 그룹 설정 추가` 는 같은 저장 흐름으로 섞지 않는다.
- 변수형 가격 편집과 그룹 연결 편집도 한 카드에 섞지 않는다.
- 먼저 `그룹 설정 카드`, 그 다음 `변수 편집 카드` 순서로 분리한다.

### 권장 UI 구조
#### 1. 그룹 설정 카드
- 표시 항목
  - IMS 그룹
  - 그룹명
  - 현재 연결 정책
  - 옵션타입
  - active 상태
- 액션
  - `그룹 설정 변경`
  - 미설정 그룹이면 `그룹 설정 추가`

#### 2. 그룹 설정 추가 흐름
- 별도 모달 또는 별도 카드로 연다.
- 입력 항목
  - 대상 그룹 선택(또는 현재 선택 그룹 기준 고정)
  - 연결 정책 선택
  - 옵션타입 선택
  - active 여부
- 저장 대상
  - `price_policy_groups` 신규 row
- 저장 후
  - editor 재조회
  - 리스트 재정렬

#### 3. 그룹 설정 변경 흐름
- 현재 선택 그룹 기준으로
  - 연결 정책 변경
  - 옵션타입 변경
  - active on/off
- 저장 대상
  - 기존 `price_policy_groups` row update
- 주의
  - 정책 변경 시 현재 period/rate 연결 영향 범위를 저장 전 안내해야 한다.

### API 구현 방향
#### read
- 현재 `list-groups` / `get-policy-editor` 응답에
  - 설정 유무
  - mapping id
  - active 상태
를 안정적으로 포함시킨다.

#### write
- 신규 action 후보
  - `save-group-setting`
- 동작
  - 기존 mapping 있으면 update
  - 없으면 insert
- 저장 범위
  - `price_policy_groups`
- 가격 변수 저장(`save-editor`)과 분리한다.

### 리스트 노출 방향
- 설정완료 / 미설정 그룹을 함께 볼 수 있어야 한다.
- 필요 시 필터
  - `전체`
  - `설정완료`
  - `미설정`
- 기본 정렬은 낮은 가격순이지만,
  - 미설정 그룹은 가격 계산값이 없을 수 있으므로 목록 하단 또는 별도 섹션으로 보낸다.

### 리스크
1. 같은 그룹에 중복 mapping row 생성 위험
2. 정책 변경 시 기존 editor 값 문맥이 바뀌는 문제
3. 미설정 그룹 노출을 위해 list source 범위를 넓혀야 할 가능성

### 우선 추천 구현 순서
1. 리스트 낮은 가격순 정렬
2. 그룹 설정 카드 추가
3. 기존 설정 그룹 변경 기능
4. 미설정 그룹 노출
5. 그룹 설정 추가 기능

## phase
### Phase 1. admin 현행 구조 재점검
- 현재 화면/API가 무엇을 보여주고 저장하는지 다시 고정한다.
- 종료조건: 현행 입력/출력/저장 구조를 한 번에 설명할 수 있다.

### Phase 2. 통합요금체제 수정안 잠금
- 변수형(A안) 기준으로 어떤 필드를 남기고 어떤 계산값을 읽기 전용으로 둘지 정한다.
- UI 문구/카드 배치도 함께 잠근다.
- 종료조건: 운영자가 수정하는 최소 단위가 4개 truth 로 명확하다.

### Phase 3. 리스트 / 그룹 설정 구조 반영
- 좌측 그룹 리스트를 낮은 가격순으로 정렬한다.
- 그룹 설정 카드와 변수 편집 카드를 분리한다.
- 필요 시 그룹 설정 read/write API를 보강한다.
- 종료조건: 운영자가 리스트 탐색과 그룹 연결 상태를 한 화면에서 이해할 수 있다.

### Phase 4. 실행 반영
- 승인된 admin 구조만 반영한다.
- UI 입력은 변수형 truth 기준으로 줄이고, 저장 시 계산/재조회 기준을 맞춘다.
- 종료조건: UI/API/저장 구조가 같은 변수형 기준을 본다.

### Phase 5. 저장/재조회 검증
- 수정 후 다시 열었을 때 같은 변수값과 같은 계산 결과가 보여야 한다.
- 그룹 설정 변경/추가 후 리스트와 editor가 일관되게 갱신돼야 한다.
- 종료조건: 운영 저장 기준이 흔들리지 않는다.

## 구현 준비 범위
### 예상 수정 파일
- `src/pages/AdminPricingHubPage.jsx`
- `api/admin/pricing-hub.js`
- 필요 시 `src/services/adminPricingHubApi.js`
- 필요 시 관련 migration

### 파일별 예상 작업
#### `src/pages/AdminPricingHubPage.jsx`
- 좌측 그룹 리스트 낮은 가격순 정렬
- 좌측 카드 정보 정리
- `수정` → `저장` 등 문구 정리
- 변수 입력 카드 / 계산 결과 카드 시각 분리
- 그룹 설정 카드 추가
- 필요 시 그룹 설정 추가 모달/카드 추가

#### `api/admin/pricing-hub.js`
- list 응답에 그룹 설정 판단용 필드 보강 검토
- `save-group-setting` action 추가 검토
- 기존 `save-editor` 와 그룹 설정 저장 분리
- 미설정 그룹 노출이 필요하면 list source 범위 확장 검토

#### `src/services/adminPricingHubApi.js`
- 그룹 설정 저장 API wrapper 추가 가능성
- list/get/save-editor 호출 shape 조정 가능성

#### migration
- 원칙적으로 UI 정리만으로 끝나면 migration 없이 간다.
- 다만 그룹 설정 구조상 추가 컬럼/제약이 필요하면 별도 승인 후 진행한다.

### 검증 기준
1. 그룹 리스트가 낮은 가격순으로 보인다.
2. 저장 버튼으로 변수 4개만 저장된다.
3. 저장 후 재조회 시 같은 변수값/같은 계산값이 보인다.
4. 그룹 설정 변경 후 연결 정책/옵션타입 반영이 일관된다.
5. 그룹 설정 추가 후 목록/상세가 바로 갱신된다.
6. `npm run build` 통과
7. admin API 수동 호출 또는 실제 화면 점검 1회 이상

## 이번 current의 비범위
- search 계산식 재설계
- IMS / 찜카 publish
- 장기 pricing hub 정책 문서 개편
- 대규모 문서 재서술

## 연결 문서
- 장기 정책: `docs/policies/RENTCAR00_PRICING_HUB.md`
- cleanup current: `docs/present/2026-05-14_RENTCAR00_PRICING_HUB_DB_CLEANUP_CURRENT.md`
- 과거 search 연결 기준: `docs/past/present-history/2026-05-13_RENTCAR00_CURRENT_PAST.md`
- 과거 계산식 기준: `docs/past/present-history/2026-05-13_RENTCAR00_PRICING_FORMULA_CURRENT_PAST.md`
- 과거 옵션 baseline 기준: `docs/past/present-history/2026-05-14_RENTCAR00_PRICING_OPTION_BASELINE_CURRENT_PAST.md`

## 한 줄 결론
- search 쪽 반영은 완료로 past로 내리고,
- 이제부터는 **admin 통합요금체제를 변수형(A안) 저장 기준으로 다시 정리하는 단계**로 들어간다.
