# RENTCAR00 pricing hub panel draft current

Last updated: 2026-04-29

이 문서는 **구현 직전 기준의 PRICING_HUB 운영자 패널 초안**이다.
현재 1차 목표는 아래다.

- 기존 운영 가격 계산은 안 건드린다.
- 새 `pricing_hub_*` 체계만 추가한다.
- 관리자 패널에서 새 체계를 조회/생성/수정할 수 있게 만든다.

---

## 0. 네이밍 규칙

### 공식 명칭
- **`RENTCAR00_PRICING_HUB`**

### 화면 표기
- 버튼명: `통합 요금 관리`
- 페이지 제목: `RENTCAR00 PRICING HUB`
- 경로: `/admin/pricing-hub`

---

## 1. 1차 목표

### 한 줄 목표
- 운영자 페이지에 버튼 1개 추가
- `/admin/pricing-hub` 진입
- 패널에서 아래를 처리
  1. IMS 그룹 기준 요금표 조회
  2. 기간/요율 생성 및 수정
  3. override 생성 및 수정
  4. preview 확인

### 이번 단계 비포함
- 찜카 실제 publish
- 기존 검색 가격 즉시 교체
- 외부 수집기 연결
- 레거시 가격 테이블 교체

---

## 2. 진입 구조

### 현재 실제 기준
- 현재 관리자 페이지는 `/admin/bookings`
- 라우트 등록 파일은 `src/App.jsx`
- 관리자 인증 패턴은 `AdminBookingsPage.jsx` 를 따른다.

### 1차 구현 방식
- `src/App.jsx` 에 `/admin/pricing-hub` 추가
- `src/pages/AdminBookingsPage.jsx` 상단에 `통합 요금 관리` 버튼 추가
- 신규 페이지 `src/pages/AdminPricingHubPage.jsx` 생성

---

## 3. 패널 핵심 원칙

### 원칙 1 — IMS 그룹 기준
패널의 기본 축은 `ims_group_id` 기준이다.

### 원칙 2 — 기존 검색 가격과 분리
패널에서 수정하는 값은 1차에서 기존 검색 가격에 자동 반영되지 않는다.

### 원칙 3 — 저장과 반영 분리
1차에서는 저장/preview 까지만 우선한다.
publish 는 테이블 구조만 준비하고 실제 집행은 후순위다.

### 원칙 4 — 기존 admin 예약 페이지와 분리
`AdminBookingsPage.jsx` 는 버튼 추가만 한다.
PRICING_HUB 본문은 신규 페이지로 분리한다.

---

## 4. 화면 구성 초안

### 탭 1 — 그룹/정책 목록
역할:
- IMS 그룹 목록 조회
- 연결된 기존 정책 확인
- 신규 허브 기간/요율 존재 여부 확인

필수 컬럼 예시:
- `ims_group_id`
- `group_name`
- `price_policy_id`
- `policy_name`
- `hub_periods_count`
- `hub_overrides_count`
- `status`

핵심 액션:
- 정책 편집 진입
- preview 진입

### 탭 2 — 기간/요율 편집
역할:
- `pricing_hub_periods`
- `pricing_hub_rates`
수정

필수 필드 예시:
- period name
- start/end
- apply_mon ~ apply_sun
- common / weekday / weekend / extended
- 6h / 12h / 24h / 1h
- weekly / biweekly / monthly
- long 24h / long 1h

핵심 액션:
- 기간 추가
- 기간 수정
- 요율 추가/수정
- 비활성화

### 탭 3 — 예외 가격
역할:
- `pricing_hub_overrides` 수정

필수 필드 예시:
- target type
- target id
- field name
- override type
- override value
- start/end
- priority
- reason
- status

### 탭 4 — 미리보기
역할:
- `pricing_hub_previews`
- `pricing_hub_preview_items`
확인

필수 컬럼 예시:
- `ims_group_id`
- `group_name`
- before
- after
- diff
- warning

핵심 액션:
- preview 생성
- 변경분만 보기
- 경고 보기

---

## 5. 1차 DB 사용 범위

### 읽기
- `car_groups`
- `price_policies`
- `price_policy_groups`
- 필요 시 `v_active_group_price_policies`

### 쓰기
- `pricing_hub_periods`
- `pricing_hub_rates`
- `pricing_hub_overrides`
- `pricing_hub_previews`
- `pricing_hub_preview_items`

### 1차에서 안 씀
- `pricing_hub_publishes`
- `pricing_hub_publish_items`
- `pricing_hub_channel_mappings`

---

## 6. 구현 순서 초안

### Phase 1 — 페이지 뼈대
- `/admin/pricing-hub` 라우트 생성
- `AdminPricingHubPage.jsx` 생성
- `AdminBookingsPage.jsx` 에 버튼 추가

종료 조건:
- 관리자 로그인 상태에서 페이지 진입 가능

### Phase 2 — 목록 조회
- 그룹/정책 목록 조회 API
- 화면 리스트 렌더

종료 조건:
- `ims_group_id` 기준으로 목록 확인 가능

### Phase 3 — 기간/요율 저장
- 기간 저장 API
- 요율 저장 API
- 편집 UI

종료 조건:
- 신규 허브 값 생성/수정 가능

### Phase 4 — override 저장
- override 저장 API
- 간단 편집 UI

종료 조건:
- 예외 규칙 저장 가능

### Phase 5 — preview 저장
- preview 생성 API
- preview 결과 렌더

종료 조건:
- before/after/diff 확인 가능

---

## 7. 충돌 방지 메모

1. `AdminBookingsPage.jsx` 안에 PRICING_HUB 본문을 넣지 않는다.
2. 기존 `api/admin/bookings.js` 에 PRICING_HUB 액션을 섞지 않는다.
3. 신규 API는 `api/admin/pricing-hub.js` 로 분리한다.
4. 레거시 적재 스크립트와 신규 허브 저장 로직을 섞지 않는다.
5. 1차에서는 기존 검색 가격이 안 바뀌는 것이 정상이다.

---

## 8. 결론

현재 패널 1차 목표는 아래로 잠근다.
- **신규 허브 체계 조회/수정**
- **IMS 그룹 기준 편집**
- **preview 확인**
- **기존 운영 가격 계산과 분리**
