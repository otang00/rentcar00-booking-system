# 2026-05-14 RENTCAR00 CURRENT

## 문서 상태
- 상태: active current
- 목적: 지금 당장 이어서 볼 실행 기준을 1개 문서로 유지한다.

## 현재 active 범위
현재 active 범위는 pricing hub admin 반영 후 **운영 확인과 후속 정리**다.

### 지금 완료된 것
- admin pricing hub 3단 구조 개편 완료
- 연결 정책 / 정책 수정 문맥 분리 완료
- 상태 배지 / 금액 카드 / 차량 chip 정리 완료
- `pricing_hub_rates.metadata` backfill 완료
- 소수점 역산 비율 노출 문제 정리 완료
- 관련 production 배포 완료

### 지금 바로 확인할 것
1. production admin 화면 실사용 확인
2. 운영자가 보는 값이 직관적인지 확인
3. 차량그룹 상세 / 연결 정책 / 정책 수정 흐름이 실제 운영 순서와 맞는지 확인

## 현재 기준
- 장기 구조 기준은 `docs/policies/RENTCAR00_POLICY.md`
- pricing hub 장기 기준은 `docs/policies/RENTCAR00_PRICING_HUB.md`
- 완료된 구현 기준은 `docs/complete/2026-05-14_RENTCAR00_PRICING_HUB_ADMIN_COMPLETE.md`

## 다음 current 로 넘길 수 있는 후보
1. `v_search_pricing_hub_policies` view shape 슬림화
2. `v_active_group_price_policies` 유지/삭제 최종 판단
3. admin 화면 추가 피드백 반영

## current 운영 원칙
- active current 는 이 문서 1개만 유지한다.
- 구현이 끝난 내용은 이 문서에 길게 누적하지 않고 complete 로 올린다.
- 새로운 아이디어/초안/스냅샷은 current 에 두지 않고 past 또는 archive 로 분리한다.

## 한 줄 결론
지금 active current 는 **pricing hub admin 운영 확인과 후속 정리**만 남긴 상태다.
