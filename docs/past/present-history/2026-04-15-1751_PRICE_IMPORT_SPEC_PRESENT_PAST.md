# PRICE IMPORT SPEC

## 목적
엑셀 원본 2개를 그룹 기준 가격 테이블로 안정적으로 적재하기 위한 import 규칙을 고정한다.

## 입력 원본
### 1. 요금표 파일
- 파일: `group_cost.xlsx`
- 성격: 정책 정의
- row 구조: 정책 1건 = 주중 1행 + 주말 1행

### 2. 그룹리스트 파일
- 파일: `20260415-car_group_list.xlsx`
- 성격: IMS 그룹 카탈로그
- row 구조: 그룹 1행 = IMS 그룹 1건

## 적재 대상
- `public.car_groups`
- `public.price_policies`
- `public.price_policy_groups`

## 그룹리스트 -> car_groups
### 입력 컬럼
- `차량 등급`
- `그룹명`
- `수입여부`
- `브랜드`
- `모델`
- `서브모델`
- `유종`
- `연식`
- `운전 경력`
- `대여 가능 면허`

### 필수 추가 데이터
- `ims_group_id`
  - 1순위: IMS API
  - 2순위: 기존 파싱/seed 데이터

### 적재 규칙
- `그룹명` -> `car_groups.group_name`
- `차량 등급` -> `car_groups.grade`
- 나머지 컬럼은 `metadata` 로 저장
- `ims_group_id` 없이는 최종 적재 완료로 보지 않는다

### 예시 row
```json
{
  "ims_group_id": 23069,
  "group_name": "더 뉴 아반떼 (CN7) (2023년)_가솔린",
  "grade": "준중형",
  "metadata": {
    "brand": "현대",
    "model": "더 뉴 아반떼 (CN7)",
    "submodel": "아반떼",
    "fuelType": "가솔린",
    "modelYear": "2025",
    "drivingCareer": "1년 이상",
    "licenseType": "2종보통",
    "importFlag": "국산차"
  }
}
```

## 요금표 -> price_policies
### 정책 식별 규칙
- `A열(요금표)` 값이 있는 행이 정책 시작 행
- 다음 행은 같은 정책의 주말 행으로 묶는다
- 두 행이 모두 있어야 정상 정책 1건으로 인정

### 컬럼 매핑
- `A열` -> `policy_name`
- `C열` -> `base_daily_price`
- 주중 행 `D열` -> `weekday_rate_percent`
- 주말 행 `D열` -> `weekend_rate_percent`
- 주중 행 `E,F,G,H` -> `weekday_1_2d_price`, `weekday_3_4d_price`, `weekday_5_6d_price`, `weekday_7d_plus_price`
- 주말 행 `E,F,G,H` -> `weekend_1_2d_price`, `weekend_3_4d_price`, `weekend_5_6d_price`, `weekend_7d_plus_price`
- 주중 행 `I,J,K` -> `hour_1_price`, `hour_6_price`, `hour_12_price`
- `source_file` -> 엑셀 파일명
- 원본 행 전체는 `metadata.rawRows` 로 저장

### 숫자 정규화
- `240,000` -> `240000`
- `(주중) 45%` -> `45.00`
- `(주말) 50%` -> `50.00`
- 빈 값은 0이 아니라 **파싱 실패**로 본다. 단 시간요금 컬럼만 빈 값이면 0 허용.

### 예시 row
```json
{
  "policy_name": "테슬라 모델3",
  "base_daily_price": 240000,
  "weekday_rate_percent": 45.00,
  "weekend_rate_percent": 50.00,
  "weekday_1_2d_price": 108000,
  "weekday_3_4d_price": 96000,
  "weekday_5_6d_price": 90000,
  "weekday_7d_plus_price": 84000,
  "weekend_1_2d_price": 120000,
  "weekend_3_4d_price": 108000,
  "weekend_5_6d_price": 102000,
  "weekend_7d_plus_price": 96000,
  "hour_1_price": 10800,
  "hour_6_price": 0,
  "hour_12_price": 0,
  "source_file": "group_cost.xlsx"
}
```

## 요금표 적용 그룹 -> price_policy_groups
### 규칙
- `적용 차량 그룹` 값을 `/` 로 split
- trim 후 정확히 일치하는 `car_groups.group_name` 을 찾는다
- 찾은 모든 그룹에 대해 `price_policy_groups` row 생성

### 예시
```json
{
  "policy_name": "디올뉴그렌져2.5",
  "appliesTo": [
    "디 올 뉴 그랜저 (2022년)_가솔린",
    "카니발 4세대 (2020년~)_디젤_9인승",
    "더 뉴 K8 (2025년)_가솔린_베스트셀렉션",
    "디 올 뉴 그랜저 (2025년)_가솔린",
    "더 뉴 카니발(KA4) (2023년)_디젤"
  ]
}
```

## import 단계
### Step 1. 그룹 카탈로그 적재
- 그룹리스트 파싱
- `ims_group_id` 조회/보강
- `car_groups upsert`

### Step 2. 가격 정책 적재
- 요금표 2행 세트 파싱
- `price_policies upsert`

### Step 3. 정책-그룹 연결 적재
- 요금표의 적용 그룹 split
- `price_policy_groups upsert`

## 실패 처리 규칙
### hard fail
- 주중/주말 2행 세트 불완전
- 필수 숫자 컬럼 파싱 실패
- 적용 그룹명이 `car_groups` 와 매칭되지 않음
- 동일 `policy_name` 이 중복인데 기간 구분이 없음

### soft fail
- 시간 요금 6시간/12시간이 0
- metadata 보조 컬럼 일부 누락

## import 완료 조건
- `car_groups`: 그룹리스트 기준 전부 적재
- `price_policies`: 요금표 정책 19건 적재
- `price_policy_groups`: 적용 그룹명 34건 전부 연결
- 미매핑 0건
