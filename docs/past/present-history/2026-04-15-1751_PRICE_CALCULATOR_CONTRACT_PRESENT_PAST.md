# PRICE CALCULATOR CONTRACT

## 목적
검색 가격 계산기를 구현할 때 입력, 조회 순서, 계산 순서, 출력 shape 를 고정한다.

## 입력
```ts
{
  sourceGroupId: number,
  pickupAt: string,
  returnAt: string,
  pickupOption: 'pickup' | 'delivery',
  deliveryRegionId?: string | null,
  timezone: 'Asia/Seoul'
}
```

## 조회 순서
1. `sourceGroupId` 로 `car_groups.ims_group_id` 조회
2. `price_policy_groups` 에서 연결된 정책 조회
3. `price_policies` 에서 유효 기간 내 active 정책 1건 조회
4. `pickupOption === 'delivery'` 이면 delivery 지역 정책 조회

## 전제
- 가격 기준 시간대는 항상 `Asia/Seoul`
- `pickupAt < returnAt` 이어야 함
- 그룹에 active 정책이 없으면 가격 계산 실패로 처리

## 핵심 계산 필드
- `totalHours`
- `billableDays = ceil(totalHours / 24)`
- `durationBucket`
  - `hour_1`
  - `hour_6`
  - `hour_12`
  - `days_1_2`
  - `days_3_4`
  - `days_5_6`
  - `days_7_plus`

## duration bucket 규칙
### 시간 요금 우선
- `totalHours <= 1` -> `hour_1`
- `1 < totalHours <= 6` -> `hour_6` 우선, 없으면 `hour_1 * ceil(totalHours)` fallback
- `6 < totalHours <= 12` -> `hour_12` 우선, 없으면 `hour_6` 또는 `hour_1` fallback
- `12 < totalHours < 24` -> `hour_12 + hour_1 * extraHours` fallback

### 일 요금
- `24 <= totalHours <= 48` -> `days_1_2`
- `48 < totalHours <= 96` -> `days_3_4`
- `96 < totalHours <= 144` -> `days_5_6`
- `144 < totalHours` -> `days_7_plus`

## 일 요금 계산 규칙
1. `billableDays` 산출
2. 각 과금 일자를 KST 기준 calendar day 로 전개
3. 각 day 를 주중/주말로 분류
   - 주말: 토, 일
   - 그 외: 주중
4. 동일 bucket 단가를 각 day 에 적용
5. 총합 = `discountPrice`
6. 정가 총합 = `base_daily_price * billableDays`

## 시간 요금 계산 규칙
- `discountPrice` 는 선택된 시간 단가 또는 fallback 계산 결과
- `price` 는 `base_daily_price` 1일분을 그대로 사용
- `deliveryPrice` 는 별도 계산, `discountPrice` 에 합산하지 않는다

## 출력
```ts
{
  price: number,
  discountPrice: number,
  deliveryPrice: number,
  baseDailyPrice: number,
  appliedPolicyId: string,
  appliedPolicyName: string,
  imsGroupId: number,
  durationBucket: string,
  billableDays: number,
  weekdayDays: number,
  weekendDays: number
}
```

## 검색 응답 반영 규칙
- `dto.price` = `price`
- `dto.discountPrice` = `discountPrice`
- `dto.deliveryPrice` = `deliveryPrice`
- 검색 정렬은 기존대로 `discountPrice` 기준 유지

## 실패 조건
- `sourceGroupId` 없음
- 그룹 미매핑
- active 정책 없음
- 유효 기간 충돌로 정책 2건 이상 매칭
- 숫자 필드 null

## 구현 포인트
### 새 repository
- `fetchGroupPricePolicy({ supabaseClient, sourceGroupIds, atRange })`

### 새 calculator
- `server/search-db/pricing/calculateGroupPrice.js`

### compose 단계
- `composeReadModel` 에서 차량별 정책/가격 계산 결과를 합성

## 비목표
- holiday 별도 요금
- 성수기/프로모션 중첩 정책
- delivery 를 할인 총액에 합산하는 표시 변경
