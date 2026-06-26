# CURRENT STATE

## 현재 기준점
- 검색은 **DB-only** 로 고정한다.
- `/api/search-cars` 는 partner 검색 경로 없이 Supabase 결과만 반환한다.
- `/api/car-detail` 및 예약 플로우는 아직 partner 의존이 남아 있다.
- 운영 방식은 rollback 보다 **fix-forward** 를 우선한다.

## 현재까지 완료
1. 검색 partner 경로 제거 완료
2. 검색 UI의 partner 문구/분기 제거 완료
3. 서버 정렬 `lower / higher / newer` 반영 완료
4. `delivery_regions` 테이블 추가 및 1,363개 동 정책 적재 완료
5. delivery 검색 시 `dongId` 허용 여부 반영 완료
6. delivery 검색 응답의 `deliveryPrice` 를 지역 왕복요금 기준으로 반영 완료
7. 검색 응답 `company.deliveryCostList` 를 DB 정책 기준으로 제공 완료

## 지금 남은 핵심 우선순위
### Priority 3. 가격표/운영 설정 보강
- 활성 차량 58대 중 `car_prices` 보유는 46대다.
- 현재 12대는 가격표가 없어 검색 결과에서 빠질 수 있다.
- 추가 가격 원본 확보 또는 적재 보강이 필요하다.

### Priority 5. 검색-상세 source 불일치 리스크
- 검색은 group 기준 `carId`, 상세는 partner 상세 응답에서 source car 기준 `carId` 를 반환한다.
- 검색에서 넘긴 `carId=23069` 는 상세에서 `car.carId=220644` 로 해석된다.
- 반대로 source car id (`220644`) 를 직접 상세에 넣으면 실패한다.
- 즉 현재는 "동일 ID 계약" 이 아니라 "검색용 ID -> 상세 내부 실차 ID 해석" 구조다.

## 현재 작업 원칙
- 21세 0건은 현재 데이터 기준 정상으로 확인했다.
- 지금은 남은 우선순위를 **3번, 5번 순서로** 처리한다.
- 코드 버그와 데이터 부족을 먼저 분리한다.
- 검색 안정화 전에는 상세/예약 전환으로 범위를 넓히지 않는다.
