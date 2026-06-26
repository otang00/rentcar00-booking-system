# RENTCAR00 pricing hub execution current

Last updated: 2026-04-29

이 문서는 **구현 직전 기준의 PRICING_HUB 실행 문서**다.
현재 목표는 아래다.

- 기존 운영 가격 계산은 유지
- 신규 `pricing_hub_*` 테이블만 추가
- 관리자 패널에서 새 요금체계를 조회/수정 가능하게 준비

---

## 1. 실행 범위

### 포함
- 신규 허브 테이블 범위 확정
- migration 초안 준비
- admin API 계약 확정
- admin page 진입 구조 확정
- preview 저장 구조 확정
- 충돌/꼬임 포인트 확인

### 제외
- 기존 검색 가격 계산 교체
- 찜카 publish
- IMS/찜카 수집기 연결
- 레거시 가격 테이블 교체
- 예약 sync 재구현

---

## 2. 실코드 확인 결과

### 라우트 / 페이지
- 라우트 등록: `src/App.jsx`
- 현재 관리자 페이지:
  - `/admin/bookings`
  - `/admin/booking-confirm`
- 관리자 진입/권한 패턴:
  - `src/pages/AdminBookingsPage.jsx`
  - `src/components/Layout.jsx`
  - `src/utils/adminAccess.js`

### admin API 패턴
- 현재 admin API: `api/admin/bookings.js`
- 인증 방식:
  - `Authorization: Bearer <access_token>`
  - `getUserFromAccessToken`
  - `assertAdminUser(authUser)`
- 신규 허브 API도 같은 패턴을 따라가는 것이 안전함

### 기존 가격 의존 경로
- 검색 가격 조회 repository:
  - `server/search-db/repositories/fetchGroupPricePolicies.js`
- 검색 가격 기준 view:
  - `v_active_group_price_policies`
- 레거시 가격 적재 스크립트:
  - `scripts/pricing/build-group-pricing-preview.js`
  - `scripts/pricing/apply-group-pricing.js`

### 실코드 기준 핵심 판단
1. 기존 검색 가격은 `v_active_group_price_policies` 만 본다.
2. 신규 허브 테이블을 추가해도 기존 검색 가격은 자동으로 바뀌지 않는다.
3. 이 분리가 1차에는 오히려 안전하다.
4. PRICING_HUB 구현은 반드시 기존 검색 경로와 분리해야 한다.

---

## 3. 구현 직전 결정

### 결정 1 — 메인 그룹 축
- `ims_group_id` 중심
- 그룹 본체는 기존 `car_groups`

### 결정 2 — 신규 테이블 범위
- `pricing_hub_periods`
- `pricing_hub_rates`
- `pricing_hub_overrides`
- `pricing_hub_previews`
- `pricing_hub_preview_items`
- `pricing_hub_publishes`
- `pricing_hub_publish_items`
- `pricing_hub_channel_mappings`

### 결정 3 — 1차에서 실제로 쓰는 테이블
- 읽기:
  - `car_groups`
  - `price_policies`
  - `price_policy_groups`
- 쓰기:
  - `pricing_hub_periods`
  - `pricing_hub_rates`
  - `pricing_hub_overrides`
  - `pricing_hub_previews`
  - `pricing_hub_preview_items`

### 결정 4 — 신규 API 분리
- `api/admin/bookings.js` 에 섞지 않는다.
- 신규 `api/admin/pricing-hub.js` 로 분리한다.

### 결정 5 — 신규 페이지 분리
- `AdminBookingsPage.jsx` 는 버튼만 추가
- 신규 `AdminPricingHubPage.jsx` 생성

---

## 4. 구현 직전 phase

### Phase 1 — migration 준비
목적:
- 신규 허브 테이블만 추가하는 migration 초안 준비

수정 대상:
- `supabase/migrations/<new>_create_pricing_hub_tables.sql`

종료 조건:
- 레거시 테이블 수정 없음
- 신규 허브 테이블 목록 확정
- FK 방향 확정

체크:
- `price_policy_id` → `price_policies.id`
- `car_group_id` → `car_groups.id`
- 기존 view 미수정

### Phase 2 — admin API 계약 준비
목적:
- 패널이 호출할 API shape 확정

수정 대상:
- `api/admin/pricing-hub.js` 신규
- 필요 시 `server/pricing-hub/*` 신규

권장 action:
- `list-groups`
- `get-policy-editor`
- `save-period`
- `save-rate`
- `save-override`
- `build-preview`

종료 조건:
- list 응답 shape 확정
- editor 응답 shape 확정
- save payload 확정
- preview 응답 shape 확정

### Phase 3 — admin page 준비
목적:
- 관리자 페이지에서 안전하게 진입 가능한 UI 준비

수정 대상:
- `src/App.jsx`
- `src/pages/AdminBookingsPage.jsx`
- `src/pages/AdminPricingHubPage.jsx` 신규
- `src/services/adminPricingHubApi.js` 신규

종료 조건:
- `/admin/pricing-hub` 라우트 추가 위치 확정
- 관리자 버튼 추가 위치 확정
- 페이지 state 구조 확정

실코드 기준 메모:
- 권한 체크는 `AdminBookingsPage.jsx` 복사 패턴 사용
- 1차 UI는 기존 panel/card 스타일 재사용

### Phase 4 — preview 구조 준비
목적:
- 저장 후 바로 preview 확인 가능한 최소 구조 준비

수정 대상:
- `api/admin/pricing-hub.js`
- `pricing_hub_previews`
- `pricing_hub_preview_items`

종료 조건:
- preview 생성 가능
- before / after / diff 저장 가능
- 기존 검색 가격 결과 미변경 확인

### Phase 5 — 충돌 방지 최종 점검
목적:
- 구현 직전 꼬임 방지

체크 대상:
- `server/search-db/repositories/fetchGroupPricePolicies.js`
- `v_active_group_price_policies`
- `scripts/pricing/apply-group-pricing.js`
- `api/admin/bookings.js`
- `src/pages/AdminBookingsPage.jsx`

종료 조건:
- 기존 검색 가격 경로 미수정 확인
- admin bookings API 와 pricing hub API 분리 확인
- admin bookings page 와 pricing hub page 분리 확인

---

## 5. 충돌 / 꼬임 체크 결과

### A. 바로 구현하면 안 되는 꼬임
1. `api/admin/bookings.js` 에 허브 action 추가
2. `AdminBookingsPage.jsx` 안에 허브 본문까지 같이 구현
3. 신규 허브 저장값을 기존 검색 조회에 바로 섞음
4. 레거시 스크립트 책임과 신규 허브 저장 책임을 합침

### B. 지금 안전한 방법
1. migration 추가
2. 신규 admin API 파일 추가
3. 신규 admin page 파일 추가
4. 기존 관리자 페이지엔 버튼만 추가
5. preview 까지만 먼저 연결

---

## 6. 구현 직전 산출물

### 문서
- `...PRICING_HUB_CURRENT.md`
- `...PRICING_HUB_SCHEMA_LOCK_CURRENT.md`
- `...PRICING_HUB_PANEL_DRAFT_CURRENT.md`
- 현재 문서

### 코드 예정
- migration 1개
- API 1개
- service 1개
- page 1개
- 기존 admin page 버튼 수정 1곳
- route 추가 1곳

---

## 7. 한 줄 결론

지금은 **설계 잠금 + 실코드 충돌 확인 완료 상태**다.
바로 다음은 **migration 초안 → admin API 초안 → admin page 뼈대** 순서로 들어가면 된다.
