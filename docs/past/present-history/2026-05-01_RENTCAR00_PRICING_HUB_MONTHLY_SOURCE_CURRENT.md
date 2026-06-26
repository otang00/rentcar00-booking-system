# RENTCAR00 PRICING_HUB monthly source current

Last updated: 2026-05-01

이 문서는 IMS의 보름/월차(30일) 요금 source 구조를 잠근다.
이 항목은 일요금표 API와 별도이며, 월요금 관리 화면/전용 API에서 관리된다.

---

## 1. 확인된 화면

IMS 월요금 관리 화면:
- `https://imsform.com/groupCost/monthlyCost/list?page=1&car_group_id=all`

화면 표 헤더:
- 요금표
- 적용 차량 그룹
- 15일
- 30일
- 15일 요금
- 일요금
- 보증금
- 30일 요금
- 일요금
- 보증금

즉 운영 화면 기준으로도 IMS는
- 보름 총금액
- 보름 일차금액
- 보름 보증금
- 월차 총금액
- 월차 일차금액
- 월차 보증금
을 별도 관리한다.

---

## 2. 확인된 API

월요금 목록 API:
- `GET https://api.rencar.co.kr/v2/group-cost-tables/monthly?page=1`

확인 시점:
- 2026-05-01 Asia/Seoul

응답 루트:
- `monthly_cost_tables`
- `total_page`
- `defaultInfo`

---

## 3. 월요금 row 구조

각 row 에서 확인된 필드:
- `id`
- `name`
- `car_groups[]`
- `d15_total_cost`
- `d15_daily_cost`
- `d15_security_deposit`
- `m1_total_cost`
- `m1_daily_cost`
- `m1_security_deposit`

해석:
- `d15_*` = 보름(15일) 설정
- `m1_*` = 월차(30일) 설정

---

## 4. 샘플 확인값

### 중형 월 150 싼타페
- `d15_total_cost = 1000000`
- `d15_daily_cost = 60000`
- `d15_security_deposit = 0`
- `m1_total_cost = 1500000`
- `m1_daily_cost = 50000`
- `m1_security_deposit = 0`

### 월요금300만원
- `d15_total_cost = 2200000`
- `d15_daily_cost = 130000`
- `d15_security_deposit = 1000000`
- `m1_total_cost = 3300000`
- `m1_daily_cost = 115000`
- `m1_security_deposit = 1000000`

---

## 5. IMS 현재 계산 규칙 잠금

### 5-1. 대여일 계산 기준
- 대여시간 / 반납시간을 포함해 대여일수를 계산한다.
- 사장님 구두 기준으로 `14일 이하`는 사실상 일 단위 계산으로 보고 있다.

### 5-2. 공통 규칙
- `15일 이상 30일 미만`
  - `15일 요금표` 적용
  - 단, 계산 결과가 `30일 요금`을 초과하면 `30일 요금` 적용
- `30일 이상`
  - `30일 요금표` 적용
  - 30일 단위로 끊고 남은 잔여일을 다시 계산

### 5-3. 15일 이상 30일 미만 계산
- 기본식:
  - `15일 요금 + (잔여일 × 15일 일요금)`
- 캡 규칙:
  - 결과가 `30일 요금`보다 크면 `30일 요금`

수식 형태:
- `min(d15_total_cost + ((days - 15) * d15_daily_cost), m1_total_cost)`

### 5-4. 30일 이상 계산
먼저:
- `months = floor(days / 30)`
- `remain = days % 30`
- `base = months * m1_total_cost`

잔여일 처리:
- `remain = 0`
  - 추가금액 없음
- `remain < 15`
  - `remain × 30일 일요금`
  - 단, `15일 요금`보다 크면 `15일 요금`
- `remain >= 15`
  - `15일 요금 + ((remain - 15) × 30일 일요금)`
  - 단, `30일 요금`보다 크면 `30일 요금`

수식 형태:
- `remain = 0`
  - `remain_cost = 0`
- `remain < 15`
  - `remain_cost = min(remain * m1_daily_cost, d15_total_cost)`
- `remain >= 15`
  - `remain_cost = min(d15_total_cost + ((remain - 15) * m1_daily_cost), m1_total_cost)`
- `total = (months * m1_total_cost) + remain_cost`

### 5-5. 예시 해석
- `44일`
  - `30일 요금 + min(14일 × 30일 일요금, 15일 요금)`
- `50일`
  - `30일 요금 + min(15일 요금 + (5일 × 30일 일요금), 30일 요금)`
- `70일`
  - `30일 요금×2 + min(10일 × 30일 일요금, 15일 요금)`
- `76일`
  - `30일 요금×2 + min(15일 요금 + (1일 × 30일 일요금), 30일 요금)`

### 5-6. 구조 해석
이 계산식은 본질적으로 아래 구조다.
- 15일 패키지 총금액
- 30일 패키지 총금액
- 15일 일요금
- 30일 일요금
- 그리고 상위 패키지 가격을 넘지 않게 막는 `min cap` 규칙

즉 단순 비례가 아니라 **장기 패키지 ceiling 을 두는 계단형 할인 구조**로 보는 편이 정확하다.

---

## 6. 운영 배경과 설계 고민

1. 현재 월차 가격은 신차 장기 운영 때문에 강하게 낮아진 구간이 있다.
2. 그래서 `24시간 기준가`와 `30일 요금` 사이 할인폭이 매우 클 수 있다.
   - 예: `24시간 8만원`인데 `30일 80만원` 같은 구조
3. 이 경우 `11~14일 단기합`이 `15일 요금`보다 커지는 역전이 쉽게 생긴다.
4. 따라서 문제는 계산식 자체보다도 아래 4개 입력값 기준이 먼저 잠겨야 한다.
   - `d15_total_cost`
   - `d15_daily_cost`
   - `m1_total_cost`
   - `m1_daily_cost`
5. 현재 이 4개는 감각적으로 넣은 값이 일부 섞여 있으므로 후속 기준 설계가 필요하다.

---

## 7. 현재 잠금 판단

1. 보름/월차는 `daily` API 필드가 아니라 `monthly` API 별도 source 다.
2. 현재 pricing hub의 단순 fallback 계산만으로는 운영 규칙을 재현할 수 없다.
3. 보름/월차 계산은 최소한 아래 값을 source 로 가져와야 한다.
   - 15일 총금액
   - 15일 일차금액
   - 30일 총금액
   - 30일 일차금액
   - 필요 시 보증금
4. `week_2_price` 나 `month_1_price` 를 단순 비율/fallback 으로 유지하는 현재 active 계산은 후속 수정 대상이다.
5. 후속 설계의 초점은 계산식 자체보다 **장기 4개 입력값 규칙 잠금**이다.

---

## 8. 다음 구현 전에 확인할 것

1. `14일 이하`를 일요금 기반으로 어떻게 정확히 산출할지
2. `d15_total_cost`, `d15_daily_cost`, `m1_total_cost`, `m1_daily_cost` 입력 기준
3. 보증금이 pricing hub scope 에 포함돼야 하는지 여부
4. monthly API 와 daily API 의 group 매핑을 어떤 key 로 결합할지
5. 월차가 공격적으로 낮은 차종에서 역전 방지 규칙을 어떻게 둘지

---

## 9. 한 줄 결론

**IMS의 보름/월차 요금은 일요금표와 별도인 `monthly` API source 로 관리되며, 계산식은 15일/30일 패키지에 `min cap`을 두는 구조이고, 다음 핵심 과제는 장기 4개 입력값 규칙을 잠그는 것이다.**
