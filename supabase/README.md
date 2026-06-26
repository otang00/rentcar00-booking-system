# Supabase setup

## 현재 구성
- migration: `supabase/migrations/20260414000000_create_cars.sql`
- rename migration: `supabase/migrations/20260421195800_rename_reservations_to_ims_sync_reservations.sql`
- seed: `supabase/seed.sql`
- generator: `scripts/build-cars-seed.mjs`

## 테이블
- `public.cars`
  - 차량 기본정보만 저장
  - 예약 가능 여부는 아직 저장하지 않음
  - 예약 가능 여부는 이후 AppSheet/Google Sheet에서 읽어 제외하는 방식으로 붙일 예정

## 현재 seed 기준
- 총 차량: 58대
- 이미지 보유: 44대
- 원본: `../../tmp/ims-api-probe-20260408/ims_with_partner_imageurl.csv`

## seed 재생성
```bash
npm run build:cars-seed
```


## Supabase SQL Editor 적용 순서
1. `supabase/migrations/20260414000000_create_cars.sql` 실행
2. IMS sync 관련 migration 들을 순서대로 실행
3. rename migration `supabase/migrations/20260421195800_rename_reservations_to_ims_sync_reservations.sql` 확인
4. `supabase/seed.sql` 실행

## 컬럼 설명
- `source_car_id`: 원본 차량 id
- `source_group_id`: 원본 차종 그룹 id
- `car_number`: 차량번호
- `name`: 홈페이지 노출 기준 이름
- `display_name`: 원본 차량명
- `image_url`: 대표 이미지 URL
- `model_year`: 연식
- `fuel_type`: 유종
- `seats`: 승차인원
- `color`: 색상
- `rent_age`: 대여 가능 연령 기준
- `active`: 노출 여부
- `options_json.ids`: IMS 옵션 id 배열
- `options_json.names`: 옵션 한글명 배열
- `options_json.other`: 기타 직접입력 옵션
- `metadata`: 원본 매핑 정보
