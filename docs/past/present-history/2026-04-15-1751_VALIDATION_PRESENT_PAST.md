# VALIDATION

## 목적
남은 우선순위를 같은 기준으로 검증한다.

## 우선순위별 검증 항목
### V01. delivery 조건 반영
- 완료
- 실측: valid `dongId=425` 는 `totalCount=21`, invalid `dongId=999999` 는 `totalCount=0`
- 결과: `dongId` 가 실제 결과에 영향을 준다

### V02. deliveryPrice 반영
- 완료
- 실측: valid `dongId=425` 첫 차량 `deliveryPrice=20000`
- 결과: delivery 검색에서 지역 왕복요금이 응답 DTO에 반영된다

### V03. 가격표 / 운영 설정
- 설계 기준 문서: `docs/present/PRICE_SYSTEM_PRESENT.md`
- 원본 검증: 요금표 정책 19개, 적용 그룹명 34개 추출 확인
- 매핑 검증: 그룹리스트 34개와 현재 활성 차량 그룹명 exact match 34 / 34
- 결론: 그룹 기준 가격 테이블 설계와 1차 import 준비 가능

### V04. 21세 결과 검증
- 완료
- 실측: 활성 차량 58대 중 `rent_age <= 21` 인 차량 0대
- 결과: `driverAge=21` 검색 0건은 현재 데이터 기준 정상

### V05. 검색-상세 불일치
- 실측: 검색 첫 결과 `carId=23069` 로 상세 진입 시 응답 `car.carId=220644`
- 실측: `220644` 를 상세 API에 직접 넣으면 `partner_detail_parser_failed`
- 결과: search/detail 간 ID 계약이 다르며, 동일 ID로 취급하면 깨진다

## 공통 확인 항목
- status code
- totalCount
- 대표 carId 목록
- price / discountPrice / deliveryPrice
- 정렬 일관성
- `company.deliveryCostList` 제공 여부

## 오류 등급
### Critical
- 500/502
- 전체 검색 불가
- 상세 즉시 실패

### Major
- delivery 미반영
- 배송비 미반영
- 가격 왜곡
- 결과 과다/과소 노출
- 허용 동 정책 누락

### Minor
- 부가정보 오차
- 정렬 미세 오차
