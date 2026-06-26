# SAMPLE QUERIES

## 목적
DB-only 검색 검증용 고정 샘플 세트

## 기본 세트
### Q01 pickup lower
- `deliveryDateTime=2026-04-16 10:00`
- `returnDateTime=2026-04-17 10:00`
- `pickupOption=pickup`
- `driverAge=26`
- `order=lower`

### Q02 pickup 21세
- `deliveryDateTime=2026-04-23 11:00`
- `returnDateTime=2026-04-24 11:00`
- `pickupOption=pickup`
- `driverAge=21`
- `order=lower`

### Q03 delivery
- `deliveryDateTime=2026-04-16 14:00`
- `returnDateTime=2026-04-16 20:00`
- `pickupOption=delivery`
- `driverAge=26`
- `order=lower`
- `dongId=436`
- `deliveryAddress=서울 강남구 삼성동`

### Q04 higher
- `deliveryDateTime=2026-04-18 09:00`
- `returnDateTime=2026-04-20 09:00`
- `pickupOption=pickup`
- `driverAge=26`
- `order=higher`

### Q05 newer
- `deliveryDateTime=2026-04-19 12:00`
- `returnDateTime=2026-04-21 12:00`
- `pickupOption=pickup`
- `driverAge=26`
- `order=newer`

## 사용 원칙
- fix-forward 전후로 같은 쿼리를 반복한다.
- 필요 시 Q06+ 를 추가하되, 기존 세트는 유지한다.
