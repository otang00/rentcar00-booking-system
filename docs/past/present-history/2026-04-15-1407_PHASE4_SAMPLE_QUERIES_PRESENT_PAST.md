# PHASE 4 SAMPLE QUERIES

## Purpose
Phase 4-A에서는 shadow diff 품질 확인을 위해, 실제 사용자 패턴을 닮은 최소 12개의 검색 케이스를 고정 세트로 사용한다. 각 케이스는 검색 옵션(픽업/딜리버리), 기간, 정렬, 운전자 연령 조합을 달리해 상태/시간/정렬/가격 차이를 재현할 수 있도록 구성했다.

## Sample Set
| ID | Scenario | pickupOption | driverAge | order | deliveryDateTime | returnDateTime | dongId | deliveryAddress | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | Weekday 24h baseline | pickup | 26 | lower | 2026-04-16 10:00 | 2026-04-17 10:00 | – | – | Shadow 기준 케이스 |
| S02 | 48h price high-sort | pickup | 26 | higher | 2026-04-18 09:00 | 2026-04-20 09:00 | – | – | 장거리 + high price 정렬 |
| S03 | Weekend newer-sort | pickup | 26 | newer | 2026-04-19 12:00 | 2026-04-21 12:00 | – | – | 신차 정렬 영향 확인 |
| S04 | Long-term 5d | pickup | 26 | lower | 2026-04-22 08:00 | 2026-04-27 08:00 | – | – | 장기 대여 가용성 |
| S05 | Long-term 10d | pickup | 26 | lower | 2026-04-25 14:00 | 2026-05-05 14:00 | – | – | 재고 소진 시나리오 |
| S06 | Young driver (21) | pickup | 21 | lower | 2026-04-23 11:00 | 2026-04-24 11:00 | – | – | 운전자 연령 필터 검증 |
| S07 | Delivery 24h baseline | delivery | 26 | lower | 2026-04-16 10:00 | 2026-04-17 10:00 | 1 | 서울 종로구 청운동 | 서울 도심 배송 |
| S08 | Delivery short same-day | delivery | 26 | lower | 2026-04-16 14:00 | 2026-04-16 20:00 | 436 | 서울 강남구 삼성동 | 6시간 단기 대여 |
| S09 | Delivery weekend high-sort | delivery | 26 | higher | 2026-04-19 09:00 | 2026-04-21 09:00 | 414 | 서울 동작구 흑석동 | 고가 정렬 + 주말 |
| S10 | Delivery 7d + young driver | delivery | 21 | lower | 2026-04-24 15:00 | 2026-05-01 15:00 | 1598 | 경기도 성남시 분당구 분당동 | 연령 필터 + 장기 |
| S11 | Delivery overnight newer-sort | delivery | 26 | newer | 2026-04-17 18:00 | 2026-04-18 12:00 | 270 | 서울 성북구 정릉동 | 야간 픽업 |
| S12 | Delivery midday higher-sort | delivery | 21 | higher | 2026-04-20 13:00 | 2026-04-21 13:00 | 373 | 서울 금천구 가산동 | 21세 + high price |

- `dongId` 값은 2026-04-15 shadow 실행 시 partner `deliveryCostList`에서 수집한 내부 ID이며, 재실행 시 동일 테이블로 검증한다.
- 모든 시간대는 KST 기준.
- 필요 시 `deliveryAddressDetail` 은 프론트 상태 필드라서 검색에는 포함하지 않는다.

## Usage Notes
1. Shadow 스크립트는 위 표 순서대로 실행해 `supabase/.temp/shadow-log.phase4a.jsonl`에 diff를 누적한다.
2. 케이스별 diff 결과는 Phase 4-A 리포트에서 최소 `resultCountDelta, missingInDb, extraInDb, orderVariance, priceDiffs` 로 요약한다.
3. 배송 검색(`S07~S12`)에서 `validateSearchState` 가 `dongId` 누락을 막기 때문에, 상기 코드가 partner 측에서 유효하지 않다면 즉시 새 코드로 교체하고 문서를 업데이트한다.
4. 유효 `dongId`/배송비 목록은 `docs/present/DELIVERY_DONG_IDS_PRESENT.md` 와 `supabase/.temp/delivery-cost-list.json` 을 참고한다.
