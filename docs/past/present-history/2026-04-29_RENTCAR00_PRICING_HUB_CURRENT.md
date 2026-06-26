# RENTCAR00 PRICING_HUB current

Last updated: 2026-04-29

이 문서는 RENTCAR00 PRICING_HUB의 현재 운영 기준을 잠근다.
active 기준은 **IMS 우선 + 단일 편집 폼 + additive 저장 구조**다.

---

## 1. 잠긴 원칙

### 1-1. 구조 원칙
1. 기존 운영 pricing/search/reservation/sync 경로는 건드리지 않는다.
2. PRICING_HUB는 별도 페이지와 별도 API, 별도 `pricing_hub_*` 테이블로 유지한다.
3. legacy `price_policies` 는 조회 기준으로만 두고, 새 저장값은 `pricing_hub_*` 쪽에 적재한다.

### 1-2. 편집 원칙
1. 관리자가 직접 만지는 값은 3개만 둔다.
   - 기준 24시간 금액
   - 주중 %
   - 주말 %
2. 나머지 시간/기간 금액은 수식으로 계산한다.
3. `수정` 버튼은 실제 저장 버튼이다.

### 1-3. UI 원칙
1. 화면은 단일 카드/단일 폼으로 유지한다.
2. 불필요한 모드 토글은 두지 않는다.
3. 원래 기준값과 현재 편집값을 같이 보여준다.
4. 사용자는 계산 구조보다 실제 금액 변화를 바로 보게 한다.

---

## 2. 현재 저장 구조

### 조회 기준
- 그룹/정책 기본값은 `v_pricing_hub_policy_editor` 조회
- 그룹 차량번호는 `cars.source_group_id = ims_group_id` 기준 조회

### 저장 기준
- 대상 period 는 active period 우선
- 없으면 `pricing_hub_periods` 에 `기본` period 자동 생성
- 저장 row 는 `pricing_hub_rates` 기준
  - `common`
  - `weekday`
  - `weekend`

### 비수정 범위
- legacy `price_policies`
- 기존 검색 계산 경로
- 기존 예약/동기화 경로

---

## 3. 현재 화면 의미

### 최초 기준금액
- legacy 에서 읽어온 비교 기준값
- 편집 전 원래 값 확인용

### 기준 24시간 금액
- 실제 계산의 중심값
- `common.fee_24h` 저장 기준

### 주중 / 주말 %
- 기준24를 주중/주말 24금액으로 파생시키는 조정값
- 각각 `weekday.fee_24h`, `weekend.fee_24h` 계산 기준

---

## 4. 오늘 완료 상태

- 단일 폼 UI 완료
- 실시간 계산 반영 완료
- 수정 버튼 저장 연결 완료
- 선택 그룹 차량번호 표시 완료
- production 배포 완료

관련 커밋:
- `2db8728` `feat: simplify pricing hub editor flow`
- `88edd57` `refactor: tighten pricing hub controls`

---

## 5. 한 줄 결론

**현재 PRICING_HUB는 기존 운영 경로를 건드리지 않는 별도 허브로서, 기준24/주중%/주말% 3개만 편집하고 계산 결과를 `pricing_hub_rates` 에 저장하는 구조로 잠김.**
