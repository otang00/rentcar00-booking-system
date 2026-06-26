# IMS API 호출 문서

## 목적
`rentcar00-booking-system` 기준 IMS 연동 시 현재 확인된 인증 방식, API 엔드포인트, 호출 흐름을 정리한다.

이 문서는 **현재 workspace 안의 별도 실험/운영 코드**를 기준으로 작성한 참고 문서다.
즉, 이 파일에 적힌 외부 참조는 `rentcar00-booking-system` repo 내부 문서가 아니라,
**workspace의 다른 프로젝트/스크립트**를 가리키는 메모 성격이다.

---

## 결론
최신 검증 기준으로 IMS는 **브라우저 없이 직접 로그인 API 호출이 가능**하다.

1. `POST https://api.rencar.co.kr/auth`
2. `username` 은 평문 아이디 사용
3. `password` 는 `sha256(plainPassword).hex()` 로 변환 후 전송
4. 응답의 `access_token` 을 받아
5. `Authorization: JWT <access_token>` 로 `https://api.rencar.co.kr/...` API 호출

즉, 브라우저 로그인 + Authorization 캡처는 임시 디버깅 수단일 수는 있지만,
현재 기준 **기본 운영 경로는 서버 단독 로그인 + JWT 호출**이다.

---

## 확인된 외부 참고 소스 (workspace 기준)

### 기준 문서
- workspace의 `telegram-parser-bot` current-state 문서
- workspace의 `telegram-parser-bot` README

### 실제 동작 코드
- workspace의 `telegram-parser-bot/src/index.js`
- workspace의 `tools/playwright/scripts/ims-reservations-export.js`
- workspace의 `tools/playwright/scripts/ims-reservation-cancel.js`
- workspace의 `tools/playwright/scripts/ims-reservation-draft.js`

---

## 인증 방식

### 확인된 로그인 페이지
- `https://imsform.com/`

### 로그인 입력 셀렉터
- 아이디: `input[placeholder="아이디"]`
- 비밀번호: `input[placeholder="비밀번호"]`
- 로그인 버튼: `button:has-text("로그인")`

### 사용 환경변수
- `IMS_ID`
- `IMS_PW`

### 중요한 점
현재 확인된 API용 로그인 엔드포인트는 아래다.

- `POST https://api.rencar.co.kr/auth`

로그인 페이지 소스맵 기준 프론트는 아래 값을 전송한다.
- `username: this.refs.id.value`
- `password: sha256(this.refs.password.value).toString()`

즉, 서버 사이드에서 IMS API를 직접 쓰는 기본 방식은 아래다.
- `IMS_PW` 를 SHA-256 hex 로 변환
- `/auth` 로 `access_token` 발급
- `Authorization: JWT <token>` 로 IMS API 호출

브라우저 자동화로 헤더를 캡처하는 방식은 보조 진단 경로로만 남긴다.

---

## 확인된 API 베이스
- `https://api.rencar.co.kr`

---

## 1) 예약/스케줄 조회 API

### 확인된 엔드포인트
`GET https://api.rencar.co.kr/v2/company-car-schedules/reservations`

### 인증
헤더에 JWT Authorization 필요

```http
Authorization: JWT <access_token>
Accept: application/json, text/plain, */*
```

토큰 발급:
```http
POST https://api.rencar.co.kr/auth
Content-Type: application/json

{
  "username": "<IMS_ID>",
  "password": "<sha256 hex of IMS_PW>",
  "disableErrorHandler": true
}
```

### 현재 확인된 쿼리 파라미터
workspace의 `ims-reservations-export.js` 기준

- `page`
- `base_date`
- `rental_type`
- `status`
- `option`
- `exclude_returned`
- `date_option`
- `start`
- `end`

### 예시
```txt
GET https://api.rencar.co.kr/v2/company-car-schedules/reservations?page=1&base_date=2026-04-01&rental_type=all&status=all&option=customer_name&exclude_returned=false&date_option=start_at&start=2026-04-01&end=2026-04-30
```

### 코드 예시
```js
const res = await fetch(url, {
  headers: {
    Accept: 'application/json, text/plain, */*',
    Authorization: auth,
  },
});
```

### 응답에서 실제 사용 중인 주요 필드
workspace의 `flattenSchedule()` 기준

상위 스케줄 필드
- `id`
- `status`
- `self_contract_status`
- `title`
- `start_at`
- `end_at`

차량 필드
- `car.id`
- `car.car_identity` → 차량번호
- `car.car_name`
- `car.car_group_id`
- `car.car_age`
- `car.oil_type`
- `car.use_connect`

상세 필드
- `detail.id`
- `detail.type`
- `detail.rental_type`
- `detail.customer_name`
- `detail.customer_contact`
- `detail.customer_car_number`
- `detail.pickup_address`
- `detail.dropoff_address`
- `detail.delivery_user_name`
- `detail.recommender_name`
- `detail.status`
- `detail.license_verification`

### 프리무브 클론에서의 의미
이 조회 API는 최소한 아래 용도로 바로 쓸 수 있다.
- 기존 예약/스케줄 확인
- 특정 기간 예약 현황 조회
- 예약 데이터 백오피스 동기화

다만 **메인 차량 가용 목록 API와 1:1로 같은지 여부는 아직 확인 필요**다.

---

## 2) 예약 취소 API

### 확인된 엔드포인트
`POST https://api.rencar.co.kr/v2/company-car-schedules/delete`

### 인증
헤더에 로그인 후 캡처한 Authorization 필요

```http
Content-Type: application/json
Accept: application/json, text/plain, */*
Authorization: <captured header>
```

### 요청 바디
```json
{
  "ids": [12345]
}
```

### 현재 코드
```js
const res = await fetch(`${apiBaseUrl}/v2/company-car-schedules/delete`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
    Authorization: authHeader,
  },
  body: JSON.stringify({ ids: [scheduleId] }),
});
```

### 성공 판정 기준
현재 코드는 아래를 성공으로 본다.
- HTTP OK
- `data.success === true`
- `failed_deletion_schedule_ids` 가 비어 있음

---

## 차량 추가 시 홈페이지 DB 반영 체크

IMS에 차량이 먼저 등록된 뒤, 홈페이지 DB에 반영할 때는 아래 순서로 확인한다.

### 1. IMS 차량 기본 식별값 확인
IMS 차량 목록 API (`GET /v2/rent-company-cars`)에서 아래 값을 확인한다.

- `id` → 홈페이지 `cars.source_car_id`
- `car_group_id` → 홈페이지 `cars.source_group_id`
- `car_identity` → 차량번호
- `car_name` → 차량명
- `car_group_name` → 그룹명
- `model_year`
- `oil_type`
- `seater`
- `color`
- `insurance_age`
- `can_general_rental`
- `can_monthly_rental`

### 2. 홈페이지 DB 매핑 확인
차량 추가 전 아래를 먼저 본다.

1. `car_groups.ims_group_id = IMS car_group_id` 가 이미 있는지
2. 있으면 그 그룹이 어떤 `price_policy_id` 에 연결돼 있는지
3. 없으면 `car_groups` 신규 생성 + `price_policy_groups` 연결까지 같이 필요

즉, 가격정책 ID는 IMS에서 직접 받는 값이 아니라
**IMS 그룹 ID → 홈페이지 car_groups → price_policy_groups.price_policy_id** 순서로 매핑한다.

### 3. 사진 URL 확인 규칙
차량 대표사진은 단순히 IMS `car_model.id` 를 S3 경로에 넣으면 안 된다.

틀린 방식:
```text
https://ims-mobility-public.s3.ap-northeast-2.amazonaws.com/cars/{car_model.id}.png
```

이 값은 IMS 내부 모델 ID일 뿐이고, premove/partner 홈페이지의 이미지 ID와 다를 수 있다.

정확한 순서:
1. premove partner 검색/상세 HTML에서 `carInfo.imageUrl` 을 확인한다.
2. partner 쪽 `carInfo.id` 는 보통 IMS `car_group_id` 와 매칭된다.
3. 기존 추적 스크립트 기준으로는 `IMS car_group_id` ↔ `partner carId` 를 조인해 `partner_imageUrl` 을 얻는다.
4. 새 그룹이 partner 검색에 아직 노출되지 않으면 이미지 URL은 확정하지 말고 후보로만 둔다.

기존 추적 파일:
```text
openclaw_backup_20260518_153845/.openclaw/workspace/tmp/ims-api-probe-20260408/partner-imageurl-export.js
openclaw_backup_20260518_153845/.openclaw/workspace/tmp/ims-api-probe-20260408/join-ims-partner-imageurl.py
openclaw_backup_20260518_153845/.openclaw/workspace/tmp/ims-api-probe-20260408/ims_with_partner_imageurl.csv
```

주의:
- 현재 IMS 차량 목록 응답에서 `car_photos` 는 비어 있을 수 있다.
- `car_model.id` 기반 URL은 실제 대표사진 검증용으로 쓰면 안 된다.
- 이후 `cars.image_url` 에 원본 URL을 넣고, 필요 시 `scripts/mirror-car-images.js` 로 Supabase Storage 미러링 가능하다.

### 4. 이번 확인 사례
#### 175호2135 / 스타리아
- IMS 차량 ID: `242896`
- IMS 그룹 ID: `25141`
- IMS 차량명: `스타리아 투어러(2023년)_디젤`
- IMS 그룹명: `스타리아 투어러 (2021년)_디젤`
- `car_model.id`: `331`
- 주의: `cars/331.png` 는 실제 대표사진으로 확정하면 안 됨
- 확정 대표 이미지 URL: `https://ims-mobility-public.s3.ap-northeast-2.amazonaws.com/cars/688.png`
- 비고: `cars/1105.png` 도 유사/중복 후보였으나 DB 반영값은 `688` 로 고정

#### 165허8095 / 모닝
- IMS 차량 ID: `242895`
- IMS 그룹 ID: `25142`
- IMS 차량명: `모닝 어반 (2020년)_가솔린`
- IMS 그룹명: `모닝 어반 (2020년)_가솔린`
- `car_model.id`: `2`
- 주의: `cars/2.png` 는 실제 대표사진으로 확정하면 안 됨
- 확정 대표 이미지 URL: `https://ims-mobility-public.s3.ap-northeast-2.amazonaws.com/cars/6.png`

### 5. 최종 반영 체크리스트
1. IMS 차량 ID 확인
2. IMS 그룹 ID 확인
3. 홈페이지 `car_groups` 존재 여부 확인
4. 연결할 `price_policy_id` 확인
5. `cars` row insert/upsert
6. `ims_can_general_rental`, `ims_can_monthly_rental` 반영
7. `image_url` 입력 또는 미러링 실행
8. 가격정책 신규 생성이 필요하면 `price_policies` + `pricing_hub_periods` + `pricing_hub_rates` + `price_policy_groups` 를 함께 생성
9. 검색/상세에서 노출 확인

## 3) 예약 생성

### 현재 확인 상태
**직접 API 엔드포인트는 아직 못 찾았다.**

지금 파서봇은 예약 생성을 아래 방식으로 처리한다.
- Playwright로 로그인
- 차량 검색 화면 이동
- 날짜/시간/차량번호 입력
- 결과 리스트에서 차량 선택
- 예약 상세 폼 입력
- 저장 버튼 클릭

즉, 현재 검증된 예약 생성은 **UI 자동화 방식**이다.

### 현재 입력 필드
workspace의 예약 draft 스크립트 기준

필수
- `rentalAt`
- `returnAt`
- `carNumber`
- `totalFee`
- `customerName`
- `customerPhone`

선택
- `address`
- `useDelivery`
- `memo`
- `dispatchMemo`

### IMS 폼 셀렉터
- 딜리버리 사용: `#delivery_use`
- 배/회차 장소 동일: `text=배/회차 장소 동일`
- 주소: `[data-input="address"]`
- 총 금액: `[data-input="rentFee"]`
- 고객명: `[data-input="customerName"]`
- 고객번호: `[data-input="customerContract"]`
- 메모: `[data-input="booking_memo"]`
- 저장 버튼: `button.Register_submit__wJTwr`

### 현재 매핑 요약
- 대여일 → `rentalAt`
- 반납일 → `returnAt`
- 차량번호 → `carNumber`
- 결제금액 → `totalFee`
- 임차인 → `customerName`
- 고객번호 → `customerPhone`
- 배반차위치 → `address`
- 배반차위치 존재 시 → `useDelivery=true`

메모 규칙
- `예약:{예약번호} | 운전자:{운전자명}/{생년월일} | 보험:{차량보험}`
- 120자 초과 시 절삭

---

## 4) 프리무브 메인 목록 구현에 대한 해석

현재 확보된 사실은 이렇다.

### 이미 확인된 것
- IMS 내부 API는 `api.rencar.co.kr` 를 쓴다.
- 브라우저 로그인 세션 기반 Authorization 헤더가 필요하다.
- 예약/스케줄 조회 API가 존재한다.
- 삭제 API가 존재한다.
- 생성은 UI 자동화로 검증되어 있다.

### 아직 확인이 필요한 것
- 메인 차량 검색 결과를 직접 주는 API 엔드포인트
- 가용 차량 검색 API의 쿼리 규격
- 예약 생성용 직접 API 존재 여부
- 결제 후 IMS 등록 순서에서 사용할 최종 엔드포인트

즉, **메인 차량 목록을 API로 붙이려면 추가 API 캡처가 필요**하다.

---

## 5) 서버 구현 권장 방식

### 권장 아키텍처
프론트에서 IMS를 직접 치지 말고, 서버 라우트를 둔다.

예시
- `GET /api/ims/available-cars`
- `POST /api/ims/create-reservation`
- `POST /api/ims/cancel-reservation`

### 이유
- Authorization 헤더를 브라우저에 직접 노출하면 안 됨
- IMS 로그인/세션/헤더 갱신 로직을 서버에서 숨길 수 있음
- IMS 구조 변경 시 프론트 수정 범위를 줄일 수 있음

### 서버 내부 방식 초안
1. 서버가 Playwright 또는 세션 캐시로 IMS 로그인
2. Authorization 확보
3. IMS API 호출
4. 프론트에는 필요한 필드만 가공해 전달

---

## 6) 현재 판단

### 확정
- IMS는 브라우저 로그인 기반 인증을 사용 중이다.
- 로그인 후 내부 API 호출에서 Authorization 헤더를 캡처해 API를 호출할 수 있다.
- 조회 API와 삭제 API는 확인됐다.
- 생성은 아직 직접 API가 아니라 UI 자동화만 검증됐다.

### 미확정
- 차량 가용 목록 API
- 직접 예약 생성 API
- 결제 후 최종 계약 확정 API

---

## 7) 다음 액션 추천

1. **차량 가용 목록 API 캡처 문서 추가 작성**
2. **IMS 세션/Authorization 재사용 전략 설계**
3. **프리무브 클론 API 스펙 초안 작성**
4. **결제 이후 예약 생성 순서 확정**

---

## 부록: 현재 확인된 환경변수

### parser-bot
- `IMS_ID`
- `IMS_PW`

### Playwright 예약 생성
- `IMS_SAVE=true` 일 때 실제 저장

### Playwright 예약 취소
- `IMS_CANCEL_DELETE=true` 일 때 실제 삭제
