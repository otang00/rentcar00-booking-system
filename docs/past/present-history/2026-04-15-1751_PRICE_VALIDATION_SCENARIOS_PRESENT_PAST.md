# PRICE VALIDATION SCENARIOS

## 목적
구현 직후 엑셀 기대값과 계산 결과를 비교할 수 있는 샘플 검증 시나리오를 고정한다.

## 공통 규칙
- 시간대: `Asia/Seoul`
- 우선 검증 대상 정책: 엑셀에서 단일 그룹 적용 정책부터 시작
- 비교 항목
  - `price`
  - `discountPrice`
  - `deliveryPrice`
  - `durationBucket`
  - `billableDays`
  - `weekdayDays`
  - `weekendDays`

## 시나리오
### V-P01. 평일 24시간
- 정책: `테슬라 모델3`
- 그룹: `모델 3 (2017년)_전기`
- 기간: 목 10:00 -> 금 10:00
- 기대
  - `durationBucket = days_1_2`
  - `billableDays = 1`
  - `weekdayDays = 1`
  - `weekendDays = 0`
  - `discountPrice = 108000`
  - `price = 240000`

### V-P02. 주말 24시간
- 정책: `테슬라 모델3`
- 그룹: `모델 3 (2017년)_전기`
- 기간: 토 10:00 -> 일 10:00
- 기대
  - `durationBucket = days_1_2`
  - `billableDays = 1`
  - `weekdayDays = 0`
  - `weekendDays = 1`
  - `discountPrice = 120000`
  - `price = 240000`

### V-P03. 평일 3일
- 정책: `테슬라 모델3`
- 그룹: `모델 3 (2017년)_전기`
- 기간: 월 10:00 -> 목 10:00
- 기대
  - `durationBucket = days_3_4`
  - `billableDays = 3`
  - `weekdayDays = 3`
  - `discountPrice = 96000 * 3 = 288000`
  - `price = 240000 * 3 = 720000`

### V-P04. 주말 포함 5일
- 정책: `테슬라 모델3`
- 그룹: `모델 3 (2017년)_전기`
- 기간: 목 10:00 -> 화 10:00
- 기대
  - `durationBucket = days_5_6`
  - `billableDays = 5`
  - `weekdayDays = 3`
  - `weekendDays = 2`
  - `discountPrice = (90000 * 3) + (102000 * 2) = 474000`
  - `price = 240000 * 5 = 1200000`

### V-P05. 8일 이상
- 정책: `테슬라 모델3`
- 그룹: `모델 3 (2017년)_전기`
- 기간: 월 10:00 -> 다음주 화 10:00
- 기대
  - `durationBucket = days_7_plus`
  - `billableDays = 8`
  - 주중/주말 count 는 실제 날짜 기준 계산
  - `discountPrice` 는 `weekday_7d_plus_price`, `weekend_7d_plus_price` 조합 합산

### V-P06. 1시간
- 정책: `테슬라 모델3`
- 그룹: `모델 3 (2017년)_전기`
- 기간: 월 10:00 -> 월 11:00
- 기대
  - `durationBucket = hour_1`
  - `discountPrice = 10800`
  - `price = 240000`

### V-P07. 6시간
- 정책: `테슬라 모델3`
- 그룹: `모델 3 (2017년)_전기`
- 기간: 월 10:00 -> 월 16:00
- 기대
  - `durationBucket = hour_6`
  - 엑셀값 0이므로 fallback 동작 확인 필요
  - 구현 초기엔 fallback 결과를 명시 기록

### V-P08. delivery 분리
- 위 시나리오 중 하나를 delivery 로 실행
- 기대
  - `discountPrice` 는 동일
  - `deliveryPrice` 만 지역 정책 기준 반영
  - 프론트 총표시 방식은 기존 계약대로 확인

## 합격 조건
- 필수 시나리오 V-P01 ~ V-P06 통과
- V-P07 은 fallback 결과 문서화
- V-P08 에서 deliveryPrice 분리 반영 확인
- 엑셀 기준값과 계산 결과 차이 0

## 실패 시 우선 점검
1. source_group_id -> ims_group_id 매핑
2. 정책 기간 충돌
3. bucket 분기 오류
4. KST day count 오류
5. 주중/주말 분류 오류
