# RENTCAR00 PRICING_HUB execution current

Last updated: 2026-04-29

이 문서는 2026-04-29 기준 PRICING_HUB의 실제 실행 상태를 잠근다.
현재 active 기준은 **복잡한 허브 편집기를 미루고, 단일 폼 + 즉시 계산 + 수정 저장** 흐름을 먼저 운영 가능한 상태로 두는 것이다.

---

## 1. 오늘 완료된 것

### 완료 범위
- `/admin/pricing-hub` 단일 편집 폼 반영
- 그룹 목록 카드에서 현재 주중24 / 주말24 표시 유지
- 선택 그룹 카드에 차량번호 목록 1줄 추가
- 편집 인자 3개 고정
  - 기준 24시간 금액
  - 주중 %
  - 주말 %
- 값 변경 시 실시간 계산 반영
- `수정` 버튼 = 실제 저장 연결
- 저장 시 `pricing_hub_rates` 의 `common / weekday / weekend` 3 scope upsert 연결
- active period 가 없으면 `기본` period 자동 생성
- production 배포 완료

### 관련 커밋
- `2db8728` `feat: simplify pricing hub editor flow`
- `88edd57` `refactor: tighten pricing hub controls`

---

## 2. 현재 화면 기준

### 좌측
- IMS 그룹 / 정책 목록
- 각 그룹 카드에 현재 주중24 / 주말24 표시

### 우측 상단
- 선택 그룹 요약
- IMS 그룹 ID
- 그룹명
- 기존 정책명
- 현재 그룹 차량번호 목록

### 우측 편집 카드
- 상단 `수정` 버튼 1개
- `불러온 최초 기준금액` 강조 표시
- `기준 24시간 금액` 한 줄형 조작
  - 숫자 input
  - 좌우 `- / +` 버튼
- `주중 24시간 요금` 한 줄형 조작
  - 실시간 계산 금액 표시
  - `- [숫자] +`
  - `%` suffix 는 input 내부 흐린 표시
- `주말 24시간 요금` 한 줄형 조작
  - 실시간 계산 금액 표시
  - `- [숫자] +`
  - `%` suffix 는 input 내부 흐린 표시

---

## 3. 저장 동작

### 입력
- 기준 24시간 금액
- 주중 %
- 주말 %

### 실시간 계산
- 주중24 = 기준24 × 주중%
- 주말24 = 기준24 × 주말%
- 1h / 6h / 12h / 장기 금액은 legacy 비율 기반 계산

### 저장 시
- active period 기준으로 `pricing_hub_rates` 저장
- 저장 scope:
  - `common`
  - `weekday`
  - `weekend`
- legacy `price_policies` 는 직접 수정하지 않음

---

## 4. 지금 active 에서 숨긴 것

- legacy JSON 카드
- 범용 rate_scope 수동 편집 UI
- override 편집 UI
- preview 로그성 구조
- 불필요한 중복 비율 표시

---

## 5. 남은 다음 단계

1. 저장 후 값 검수하면서 계산 규칙 미세조정
2. 주중/주말/장기 계산식 실제 운영값 대조
3. IMS 반영 payload 명시 문서화
4. 찜카 파생 반영 규칙 후속 정리

---

## 6. 한 줄 상태

**PRICING_HUB는 현재 단일 폼 + 기준24/주중%/주말% 3인자 + 실시간 계산 + 수정 저장 구조까지 완료되어 production 반영됨.**
