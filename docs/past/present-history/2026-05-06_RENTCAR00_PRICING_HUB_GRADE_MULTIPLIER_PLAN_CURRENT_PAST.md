# RENTCAR00 PRICING_HUB grade multiplier plan current

Last updated: 2026-05-06

이 문서는 관리자 `Pricing Hub` 페이지 기준으로
`일반 / 준프리미엄 / 프리미엄 / 승합차` 선택 배수와
`7일 / 14일 / 30일` 자동 계산 규칙을 잠근다.

---

## 1. 목적

이번 변경 목적은 2개다.

1. 관리자 `Pricing Hub` 안에서 등급 선택으로 배수를 조절한다.
2. 직접 입력 없이 `7일 / 14일 / 30일` 금액을 계산식으로 생성한다.

---

## 2. 범위

이번 작업 범위는 관리자 요금조정 페이지 내부로 한정한다.

포함:
- `AdminPricingHubPage` UI
- `api/admin/pricing-hub.js` 계산/저장 로직
- `pricing_hub_rates` 의 `week_1_price`, `week_2_price`, `month_1_price` 저장값

제외:
- 고객용 메인 검색 페이지
- 신규 입력 칸으로 `7일 / 14일 / 30일` 직접 수정 기능 추가
- legacy `price_policies` 직접 수정

---

## 3. 현재 기준점

현재 직접 입력 가능한 값은 아래 3개다.

1. `base24h`
2. `weekdayPercent`
3. `weekendPercent`

현재 `7일 / 14일 / 30일` 은 UI 직접 입력이 아니라 계산 저장 구조다.
저장 자리는 이미 존재한다.

- `week_1_price`
- `week_2_price`
- `month_1_price`

현재 핵심 파일:
- `src/pages/AdminPricingHubPage.jsx`
- `api/admin/pricing-hub.js`

---

## 4. 잠그는 원칙

### 4-1. 등급 선택 위치
등급 선택은 고객용 페이지가 아니라 관리자 `Pricing Hub` 페이지에 둔다.

### 4-2. 직접 입력 최소화
운영자가 직접 넣는 절대금액은 계속 `24시간 기준값` 중심으로 유지한다.
`7일 / 14일 / 30일` 입력칸은 추가하지 않는다.

### 4-3. 기간 금액은 계산식으로 생성
`7일 / 14일 / 30일` 은 선택된 등급 배수와 기준 24시간 금액으로 계산한다.

### 4-4. 저장 구조 유지
신규 테이블 추가 없이 기존 `pricing_hub_rates` 저장 구조를 유지한다.

---

## 5. 계산 기준

### 5-1. 공통 기준값
- `base_24h = 관리자 입력 기준 24시간 금액`
- `weekday_24h = round(base_24h * weekday_percent / 100)`
- `weekend_24h = round(base_24h * weekend_percent / 100)`

### 5-2. 등급 선택
관리자 선택값은 아래 4개다.

- `general`
- `semi_premium`
- `premium`
- `van`

### 5-3. 등급 배수
정확한 multiplier 수치는 구현 직전 코드에 상수로 잠근다.
문서 단계에서는 아래 원칙만 먼저 잠근다.

- `general` = 기준 배수
- `semi_premium` = 일반보다 상향 배수
- `premium` = 준프리미엄보다 상향 배수
- `van` = 승합차 전용 배수

즉,
- `general`, `semi_premium`, `premium`, `van` 은 각각 독립 multiplier 를 가진다.
- 배수는 `7일 / 14일 / 30일` 계산에 공통 적용한다.

### 5-4. 기간 금액 계산 대상
아래 3개를 자동 계산 대상으로 본다.

- `week_1_price` = 7일 금액
- `week_2_price` = 14일 금액
- `month_1_price` = 30일 금액

### 5-5. 계산 방향
각 scope(`common`, `weekday`, `weekend`)는 자기 `24h` 기준값으로 계산한다.

즉,
- `common` 은 `base24h`
- `weekday` 는 `weekdayApplied24h`
- `weekend` 는 `weekendApplied24h`
를 기준으로 같은 계산 규칙을 적용한다.

### 5-6. 수식 잠금 원칙
정확한 식은 IMS 기준 화면/기존 운영 기대값을 맞춰서 구현 직전 최종 잠근다.
다만 구조는 아래로 고정한다.

- `7일 금액 = applied24h × 7일 계수 × grade multiplier`
- `14일 금액 = applied24h × 14일 계수 × grade multiplier`
- `30일 금액 = applied24h × 30일 계수 × grade multiplier`

---

## 6. UI 변경 기준

관리자 `Pricing Hub` 에 아래를 추가한다.

1. 등급 선택 UI
   - 일반
   - 준프리미엄
   - 프리미엄
   - 승합차

2. 계산 결과 표시
   - 7일
   - 14일
   - 30일

원칙:
- 결과는 입력칸이 아니라 계산 결과/preview로 노출한다.
- 저장 시 같은 계산 함수를 사용한다.

---

## 7. 저장 기준

저장 시 아래를 유지한다.

- `common` row
- `weekday` row
- `weekend` row

각 row 에 대해 아래 필드를 계산 저장한다.

- `week_1_price`
- `week_2_price`
- `month_1_price`

필요 시 metadata 에 아래를 남긴다.
- 선택 등급
- 적용 배수
- 저장 시각
- 저장 주체

---

## 8. 실행 phase

### Phase 1. 문서 기준 잠금
- 관리자 페이지 범위인지 확정
- 직접 입력이 아니라 계산식 추가인지 확정
- 등급 선택이 `Pricing Hub` 내부라는 점 확정

### Phase 2. 프론트 UI 연결
- `AdminPricingHubPage` 에 등급 선택 UI 추가
- 미리보기에서 `7일 / 14일 / 30일` 표시 추가
- 현재 선택값 상태 관리 추가

### Phase 3. API 계산/저장 연결
- `save-editor` payload 에 선택 등급 전달
- 서버 계산 함수에서 기간 금액 계산 추가
- `pricing_hub_rates` 에 `week_1_price / week_2_price / month_1_price` 저장

### Phase 4. 재조회/검증
- 저장 후 재조회 시 계산 결과 일관성 확인
- 다른 scope 와 충돌 없는지 확인

---

## 9. 종료 조건

아래가 되면 이번 범위를 완료로 본다.

1. 관리자 `Pricing Hub` 에서 등급 선택 가능
2. `7일 / 14일 / 30일` 값이 직접 입력 없이 자동 계산됨
3. 저장 후 재진입해도 계산 기준이 일관됨
4. 고객용 페이지 수정 없이 관리자 페이지 안에서 작업이 끝남

---

## 10. 리스크

1. 배수 적용 위치를 잘못 잡으면 preview 와 저장값이 달라질 수 있다.
2. `common / weekday / weekend` 중 어느 scope 에 어떤 배수를 적용하는지 불명확하면 재조회 결과가 흔들릴 수 있다.
3. 기존 legacy 비율 계산과 새 기간 계산이 섞이면 운영자가 기대한 값과 달라질 수 있다.

따라서 구현 전 최종적으로는 아래 3가지를 다시 확인해야 한다.
- grade multiplier 상수값
- 7일/14일/30일 계수값
- scope 별 적용 방식

---

## 11. 다음 실행 대상 파일

- `src/pages/AdminPricingHubPage.jsx`
- `api/admin/pricing-hub.js`

필요 시 확인:
- 관련 스타일 파일
- 저장 후 재조회에 쓰는 editor state 직렬화 부분

---

## 12. 한 줄 결론

이번 변경은 고객용 페이지가 아니라 관리자 `Pricing Hub` 안에서,
`일반 / 준프리미엄 / 프리미엄 / 승합차` 선택 배수로 `7일 / 14일 / 30일` 금액을 자동 계산 저장하도록 잠그는 작업이다.
