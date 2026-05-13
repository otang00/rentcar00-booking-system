# RENTCAR00 PRICING_HUB next steps current

Last updated: 2026-04-30

이 문서는 다음 세션에서 PRICING_HUB 작업을 바로 이어가기 위한 active 체크리스트다.
현재 기준점은 production 반영된 단일 편집 폼 baseline 이다.

---

## 1. 현재 기준점

배포 완료 baseline:
- `2db8728` `feat: simplify pricing hub editor flow`
- `88edd57` `refactor: tighten pricing hub controls`

현재 production 기준 UI:
- 단일 폼
- 편집 인자 3개
  - 기준 24시간 금액
  - 주중 %
  - 주말 %
- `수정` 버튼 저장 연결 완료
- 선택 그룹 차량번호 표시 완료

---

## 2. 다음 우선순위

### Priority 1. 월차/보름 source 반영 설계
목표:
- IMS monthly API 구조를 pricing hub 계산 기준에 반영

확인된 source:
- `GET /v2/group-cost-tables/monthly?page=1`
- 필드:
  - `d15_total_cost`
  - `d15_daily_cost`
  - `d15_security_deposit`
  - `m1_total_cost`
  - `m1_daily_cost`
  - `m1_security_deposit`

핵심 과제:
- 15일 초과 시 `15일 금액` vs `일차 누적 금액` 비교 규칙 반영
- 30일 단위 + 잔여일 계산식 반영
- daily source 와 monthly source 결합 key 확정
- 장기 4개 입력값 기준 잠금
  - `d15_total_cost`
  - `d15_daily_cost`
  - `m1_total_cost`
  - `m1_daily_cost`

종료 조건:
- 보름/월차 계산 source 와 규칙이 문서 기준으로 잠김
- 장기 4개 입력값 설계 기준 초안 확보

### Priority 2. 장기 입력값 기준 설계
목표:
- 월차 가격이 공격적으로 낮은 상황에서도 15일/30일/잔여일 역전이 덜 생기게 기준을 잡기

핵심 질문:
- 15일 총액을 14일 단기합 대비 어느 수준으로 둘지
- 15일 daily 를 보조값으로 어떻게 둘지
- 30일 총액이 매우 낮을 때 15일 총액을 어떤 범위로 잡을지
- 30일 daily 를 15일 daily 보다 얼마나 낮게 둘지

종료 조건:
- 차급별 또는 그룹별 장기 입력값 설계 원칙 초안 확보

### Priority 3. 저장 후 피드백 UX
목표:
- 저장 후 성공/실패/재조회 UX를 더 명확히 정리

후보:
- 저장 성공 시 강조 메시지 톤 조정
- 변경값 diff 간단 표시 여부
- 저장 중 버튼 상태 개선

종료 조건:
- 실사용 시 혼동 없는 수준 확보

### Priority 4. IMS 반영 계약 문서화
목표:
- 허브 저장값을 IMS에 어떻게 풀어 넣을지 문서 확정

종료 조건:
- IMS payload 기준 문서 1개 추가

---

## 3. 다음 시작 추천 순서

1. monthly API source 기준 문서 확인
2. 실제 그룹 1개로 daily / monthly source 매핑 확인
3. 15일 초과 계산식 확정
4. 30일 계산식 확정
5. 그 다음 코드 수정 범위 잠금

---

## 4. 한 줄 결론

**다음 작업은 새 UI를 더 만드는 단계가 아니라, 지금 저장되는 계산값이 운영 기대값과 정확히 맞는지 검수하고 계산식을 잠그는 단계다.**
