# 2026-06-09 카니발 홈페이지/카모아 가격 조정 완료

## 목적
카니발 요금이 높다는 운영 판단에 따라 홈페이지 가격 truth와 카모아 단기/월렌트 요금을 같은 기준으로 낮춘다.

## 적용 기준
- 디젤 source_group_id `22031`, `24154`: 기준 24h `135,000`
- 가솔린 source_group_id `23032`: 기준 24h `140,000`
- 자동 재계산:
  - 주중 24h: 기준 × 90%, 1,000원 단위 올림
  - 주말 24h: 기준 × 115%, 1,000원 단위 올림
  - 1시간: 기준 × 12%, 1,000원 단위 올림
  - 7일: 기준 × 5.5, 1,000원 단위 올림
  - 14일: 기준 × 8
  - 30일: 기준 × 11

## 홈페이지 DB 반영 결과

| source_group_id | 구분 | 기준24h | 주중24h | 주말24h | 1시간 | 7일 | 14일 | 30일 |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 22031 | 카니발 9인승 경유 | 135,000 | 122,000 | 156,000 | 17,000 | 743,000 | 1,080,000 | 1,485,000 |
| 23032 | 더 뉴 카니발 KA4 2025 가솔린 | 140,000 | 126,000 | 161,000 | 17,000 | 770,000 | 1,120,000 | 1,540,000 |
| 24154 | 더 뉴 카니발 KA4 디젤 | 135,000 | 122,000 | 156,000 | 17,000 | 743,000 | 1,080,000 | 1,485,000 |

## 홈페이지 계산 검증
`server/search-db/pricing/calculateGroupPrice.js` 기준 직접 계산 확인.

- 7일: 디젤 `743,000`, 가솔린 `770,000`
- 8일: 디젤 `810,500`, 가솔린 `840,000`
- 14일: 디젤 `1,080,000`, 가솔린 `1,120,000`
- 30일: 디젤 `1,485,000`, 가솔린 `1,540,000`

## 카모아 연결 기준
카모아 가격은 차량별이 아니라 carModel serial 기준으로 반영한다.

| source_group_id | 카모아 serial | 카모아 차종명 |
|---:|---:|---|
| 22031 | 10881 | 카니발 4세대 9인승 (2023) |
| 23032 | 10893 | 더 뉴 카니발(KA4) (2025) |
| 24154 | 10900 | 더 뉴 카니발(KA4) (2024) |

## 카모아 반영 결과
- 단기 Type2 요금 저장 endpoint: `set/pricetableType2_ver2.php`
- 월렌트 요금 저장 endpoint: `set/monthRentPriceTable.php`
- 카모아 요금그룹: `카모아`, serial `4084`
- Type2 기본요금표: serial `12950`
- 저장 후 재조회 검증:
  - Type2 targets `3`, mismatch `0`
  - Month targets `3`, mismatch `0`

## 관련 산출물
`rentcar00-pricing-normalizer` repo:
- `outputs/carmore/carnival-price-payload-20260609.json`
- `outputs/carmore/carnival-price-carmore-diff-20260609.json`
- `outputs/carmore/carnival-price-carmore-apply-result-20260609.json`

## 커밋
`rentcar00-pricing-normalizer`:
- `64a8e6f chore: prepare carnival carmore price payload`
- `486a147 chore: capture carnival carmore price diff`
- `74b6ad7 chore: apply carnival carmore prices`

`rentcar00-booking-system`:
- 이 문서 커밋 예정

## 남은 리스크
- 홈페이지 DB 가격은 직접 반영했으므로 별도 migration 이력은 없다. 필요 시 운영 SQL 형태로 후속 정리할 수 있다.
- 카모아는 외부 플랫폼 저장 완료 상태다. 문제 발생 시 apply 결과 파일의 backupRows 값으로 복구한다.
