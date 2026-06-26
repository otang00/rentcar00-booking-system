# RENTCAR00 price source structure current

Last updated: 2026-04-29

이 문서는 2026-04-29 세션에서 실제 로그인/호출/화면 확인으로 파악한
**IMS 가격표 원천 구조**와 **찜카 가격표 원천 구조**를 다음 세션이 헷갈리지 않게 고정하는 구조 파악 문서다.

중요:
- 이 문서는 **설계 확정 문서가 아니다.**
- 추측이 아니라 **이번 세션에서 실제 확인한 사실**만 적는다.
- 이후 가격 허브 설계는 이 문서를 기준 사실관계로 삼는다.

---

## 1. 이번 세션 결론

### 한 줄 결론
- **IMS는 가격표를 JSON API로 읽을 수 있다.**
- **찜카는 가격표 상세 HTML에 값이 직접 렌더되어 있고, 저장은 별도 PUT 요청으로 보낸다.**

### 구조 차이
- IMS 가격표 기준 단위: **요금표 row + 적용 차량 그룹 배열**
- 찜카 가격표 기준 단위: **요금 그룹/구간 + 모델 row + fee pid 묶음**

즉 두 시스템은 같은 “가격표”라도 기준 단위가 다르다.
바로 1:1 매핑하지 말고 중간 허브 매핑층이 필요하다.

---

## 2. IMS 가격표 구조

### 2-1. 로그인/인증
실제 사용 경로:
- `POST https://api.rencar.co.kr/auth`

인증 방식:
- `username = IMS_ID`
- `password = sha256(IMS_PW).hex()`
- 이후 헤더:
  - `Authorization: JWT <access_token>`

이 경로로 실제 로그인 성공 확인했다.

---

### 2-2. 실제 가격표 조회 네트워크
이번 세션 Playwright 로그인 후 `https://imsform.com/groupCost/dailyCost/list?car_group_id=all` 진입 시 확인된 요청:

1. `GET https://api.rencar.co.kr/v2/car-groups/names`
2. `GET https://api.rencar.co.kr/v2/group-cost-tables/periods?page=1`
3. `GET https://api.rencar.co.kr/v3/group-cost-tables/daily?period_id=11211`

즉 IMS 일 요금표 화면은
- 차량 그룹 목록
- 요금 구간 목록
- 선택 구간의 일 요금표 목록
으로 나뉘어 읽힌다.

---

### 2-3. 차량 그룹 목록 구조
엔드포인트:
- `GET /v2/car-groups/names`

이번 세션 확인값:
- count: `34`

응답 예시:
```json
{
  "id": 24154,
  "name": "더 뉴 카니발(KA4) (2023년)_디젤"
}
```

해석:
- IMS 쪽 그룹 식별자는 `car_group_id`
- 가격 허브 설계 시 IMS 메인 매핑 후보 key 로 유력함

---

### 2-4. 요금 구간(period) 구조
엔드포인트:
- `GET /v2/group-cost-tables/periods?page=1`

이번 세션 확인값:
- count: `8`
- 기본 요금 period id: `11211`

응답 예시:
```json
{
  "id": 11211,
  "name": "기본 요금",
  "start_at": "1900-01-01",
  "end_at": "2200-12-31",
  "friday": true,
  "saturday": true,
  "sunday": true
}
```

해석:
- IMS 요금표는 단일 표가 아니라 **구간(period)** 개념이 있다.
- 주말 적용 요일과 기간 범위가 별도 관리된다.
- 가격 허브에도 period 차원을 유지할지 검토 필요.

---

### 2-5. 일 요금표 본체 구조
엔드포인트:
- `GET /v3/group-cost-tables/daily?period_id=11211`

이번 세션 확인값:
- count: `20`

응답 샘플:
```json
{
  "id": 7787,
  "name": "테슬라 모델3",
  "car_groups": [
    { "id": 22035, "name": "모델 3 (2017년)_전기" }
  ],
  "default_detail": {
    "weekday": {
      "cost": 240000,
      "d1_cost": 108000,
      "d3_cost": 96000,
      "d5_cost": 90000,
      "d7_cost": 84000,
      "h1_cost": 10800,
      "h6_cost": 0,
      "h12_cost": 0,
      "percentage": 45,
      "period_id": 11211
    },
    "weekend": {
      "cost": 240000,
      "d1_cost": 120000,
      "d3_cost": 108000,
      "d5_cost": 102000,
      "d7_cost": 96000,
      "h1_cost": 12000,
      "h6_cost": 0,
      "h12_cost": 0,
      "percentage": 50,
      "period_id": 11211
    }
  },
  "period_detail": null
}
```

해석:
- IMS 요금표 row 식별자: `daily_cost_table.id`
- IMS 요금표 이름: `name`
- 적용 그룹: `car_groups[]`
- 가격 본체: `default_detail.weekday`, `default_detail.weekend`
- 가격 필드:
  - `cost`
  - `d1_cost`
  - `d3_cost`
  - `d5_cost`
  - `d7_cost`
  - `h1_cost`
  - `h6_cost`
  - `h12_cost`
  - `percentage`

즉 기존 엑셀 import 구조와 매우 유사하지만,
실제 API 응답은 이미 **요금표 + 적용 그룹 배열 + 주중/주말 상세가격** 형태로 정규화되어 있다.

---

### 2-6. 그룹 기준 역조회 확인
이번 세션에서 아래 호출도 확인했다.
- `GET /v3/group-cost-tables/daily?period_id=11211&car_group_id=24154`

응답:
- count: `1`

샘플 요금표:
- `name`: `카니발_23년,24년식.디젤`
- `car_groups`:
  - `22031 카니발 4세대 (2020년~)_디젤_9인승`
  - `24154 더 뉴 카니발(KA4) (2023년)_디젤`

해석:
- 같은 요금표 1건이 여러 IMS 차량그룹에 적용될 수 있다.
- 따라서 허브에서도 `IMS price table : IMS car groups = 1:N` 을 전제로 잡아야 한다.

---

## 3. 찜카 가격표 구조

### 3-1. 로그인/접근
실제 사용 경로:
- `POST https://admin.zzimcar.com/login`

로그인 후 실제 접근 확인 화면:
- `GET https://admin.zzimcar.com/fee/section/detail/2111`

이번 세션 기준 이 화면은 로그인 후 정상 접근되었다.

---

### 3-2. 가격표 화면 상단 구조
HTML 텍스트 기준 확인값:
- 그룹명: `정상요금`
- 구간 제목: `빵빵렌터카 정상요금`
- 적용 구간: `2025-10-31 00:00:00 ~ 2026-12-31 23:59:59`
- 요금 계산법: `24h+1h(repeat)`

해석:
- 찜카도 가격표에 기간/구간 개념이 있다.
- 다만 IMS의 `period` 와 같은 모델인지 아직 모른다.
- 현재는 **fee section** 또는 **요금 구간 상세 화면**으로 보는 편이 안전하다.

---

### 3-3. 데이터 적재 방식
중요:
- 이번 화면은 IMS처럼 별도 JSON 목록 호출이 보이지 않았다.
- 가격 값이 **HTML 테이블에 직접 렌더**되어 있었다.

즉 1차 수집 원천은 현재 기준:
- **찜카 가격표 상세 HTML 파싱**

---

### 3-4. 모델 row 구조
페이지에서 확인된 예시 모델:
- `21-22년 MODEL 3`

행 구조 특징:
- `<tr data-pid="9512">` 같은 모델 row 존재
- 각 셀에 `data-pid` 가 붙어 있음
- 공통/주중/주말/확장 구간별로 서로 다른 pid 묶음이 있다.

이번 세션에서 확인한 예시 pid:
- 공통: `407432`
- 주중: `407433`
- 주말: `407434`
- 확장(주간/2주/월간/장기 일부): `407435+` 류와 `422774` 류 존재

주의:
- 찜카는 모델 이름만으로 저장하지 않고 **fee row pid** 단위로 저장된다.
- 따라서 허브에서 찜카 row를 연결할 때 `모델명`만 저장하면 불충분할 수 있다.

---

### 3-5. 모델 row 안 가격 필드
예시 모델 `21-22년 MODEL 3` 에서 확인한 값:

#### 공통(common)
- `fee6h = 0`
- `fee12h = 0`
- `fee24h = 160,000`
- `fee1h = 20,000`

#### 주중(weekday)
- `percentage = -10`
- `won = 0`
- `fee6h = 0`
- `fee12h = 0`
- `fee24h = 176,000`
- `fee1h = 22,000`

#### 주말(weekend)
- `percentage = -15`
- `won = 0`
- `fee6h = 0`
- `fee12h = 0`
- `fee24h = 184,000`
- `fee1h = 23,000`

#### 확장(extended)
예시 값:
- `350,000`
- `500,000`
- `750,000`
- 일부 `0`

해석:
- 찜카 모델 row는 단순 1일 요금만 있는 것이 아니라
  - 공통 기본요금
  - 주중 변형
  - 주말 변형
  - 주간/2주/월간/장기 확장요금
  로 나뉜다.
- IMS와 필드 구조가 유사한 부분도 있지만 정확히 같지는 않다.

---

### 3-6. 저장 경로와 저장 payload 구조
가격표 화면 JS (`/js/fee/section_detail.js`) 에서 확인한 저장 경로:
- `PUT /fee/detail`

JS 내부에서 모델 1개당 만드는 payload 덩어리:
- `standardFee`
- `weekdayFee`
- `weekendFee`
- `weeklyFee`
- `twoWeeklyFee`
- `monthlyFee`
- `longTermFee`

각 덩어리 필드 예시:
- `pid`
- `fee6h`
- `fee12h`
- `fee24h`
- `fee1h`
- 일부는 `per`
- 일부는 `weekendChk`

해석:
- 찜카의 저장 최소 단위는 **모델 1행**이 아니라 **모델 행 내부의 fee block pid 들**이다.
- 찜카 허브 적재 시 `fee_section_id + model row + block pid` 구조를 고려해야 한다.

---

## 4. IMS vs 찜카 구조 차이 요약

### IMS
단위:
- price table row
- applied car_groups[]
- weekday/weekend detail

성격:
- JSON API 조회 가능
- 그룹 기준 연결이 명시적
- 허브 적재가 비교적 쉬움

### 찜카
단위:
- fee section detail 화면
- model row
- common / weekday / weekend / extended block pid

성격:
- 현재 확인 기준 읽기는 HTML 파싱
- 저장은 `PUT /fee/detail`
- 모델명 + pid 구조라 IMS보다 거칠고 수집층이 한 단계 더 필요함

---

## 5. 찜카 HTML 기준 수집/주입 판단

### 5-1. 현재 선택
이번 세션 기준 찜카는 **HTML 기준으로 읽는 방향**을 우선 채택한다.

이유:
- 가격표 상세 화면에서 실제 운영값이 직접 보인다.
- 모델 row / block pid / 저장 payload 구조를 이미 확인했다.
- 별도 가격 JSON API는 아직 확인되지 않았다.

즉 현재 찜카 수집 기준은 아래다.
- 읽기: `GET /fee/section/detail/{id}` HTML 파싱
- 쓰기: `PUT /fee/detail` payload 구성

### 5-2. HTML 수집의 장점
- 현재 운영 화면과 같은 값을 읽는다.
- 모델 row / pid block 구조를 직접 확인할 수 있다.
- 허브 수집 기준을 추측이 아니라 실화면 기준으로 맞출 수 있다.

### 5-3. HTML 수집의 리스크
- 화면 HTML 구조가 바뀌면 파서가 깨질 수 있다.
- 컬럼 순서 변경에 민감할 수 있다.
- 숨은 필수 필드가 생기면 저장 payload 재현이 실패할 수 있다.

### 5-4. 주입 실패 가능성
중요:
- **명령어만 넣는다고 무조건 성공하는 구조는 아니다.**
- 찜카 주입은 실패 가능성이 있다.

대표 리스크:
1. pid 매칭 오류
2. 모델 row 순서/구조 변경
3. 필수 필드 누락
4. `weekendChk` 형식 불일치
5. 일부만 저장되는 partial failure
6. 화면/JS 변경으로 payload shape 변경

### 5-5. 안전한 집행 원칙
찜카 반영은 바로 전체 저장으로 가면 안 된다.
아래 단계를 유지한다.

1. **read-only 수집기**
   - HTML 파싱
   - normalized JSON 생성
2. **dry-run 주입기**
   - 실제 저장 없이 어떤 pid에 어떤 값을 넣을지 출력
3. **소량 실반영**
   - 모델 1개 또는 block 1세트만 반영
4. **재조회 검증**
   - 저장 후 다시 HTML을 읽어 diff 확인
5. **그 뒤에만 전체 반영 검토**

### 5-6. 지금 시점 추천
- 찜카는 **수집은 HTML 기준으로 진행**
- 주입은 **dry-run → 1건 실험 → 재조회 검증** 구조로만 접근
- 이후 더 직접적인 fee API가 발견되면 그때 수집/주입 경로를 교체 검토

---

## 6. 지금 시점의 안전한 판단

### 확정된 것
1. IMS 가격표는 더 이상 엑셀만 원천이 아니다.
   - 실제 운영 API에서 읽을 수 있다.
2. IMS는 `price table row -> applied car_groups[]` 구조다.
3. 찜카는 `fee section -> model row -> fee pid blocks` 구조다.
4. 두 시스템은 기준 단위가 달라서 직접 1:1 동치로 보면 안 된다.

### 아직 미확정인 것
1. 찜카에 HTML 말고 더 직접적인 fee JSON API가 있는지
2. 찜카 모델 row와 IMS car_group 을 어떤 기준으로 가장 안정적으로 매핑할지
3. IMS period 와 찜카 구간을 같은 축으로 묶을지 분리할지
4. 허브 key 를 `ims_group_id` 로 시작할지 별도 `hub_group_id` 를 둘지

---

## 7. 다음 세션 시작점
다음 세션은 이 순서로 이어가면 된다.

### Step 1
찜카 가격표의 직접 JSON/API 경로가 더 있는지 추가 탐색
- 없으면 HTML 파서 기준으로 수집기 설계

### Step 2
IMS 가격표 API 응답 샘플을 저장용 shape 로 정리
- periods
- daily tables
- filtered by `car_group_id`

### Step 3
허브 적재 전 임시 원천 모델 정리
- `ims_periods`
- `ims_daily_cost_tables`
- `ims_daily_cost_table_groups`
- `zzimcar_fee_sections`
- `zzimcar_fee_section_models`
- `zzimcar_fee_blocks`

### Step 4
그 다음에만 가격 허브 설계 문서 잠금

---

## 8. 다음 세션에서 하면 안 되는 착각
1. IMS 가격표를 아직도 엑셀 원본만 있다고 보면 안 됨
2. 찜카가 모델명만 있으면 끝난다고 보면 안 됨
3. IMS `car_group_id` 와 찜카 모델명을 곧바로 같은 축으로 보면 안 됨
4. period/구간 개념을 무시하고 단일 가격표로 단순화하면 안 됨
5. 지금 문서를 설계 확정 문서로 오해하면 안 됨

이 문서는 **구조 파악 메모의 기준본**이다.
