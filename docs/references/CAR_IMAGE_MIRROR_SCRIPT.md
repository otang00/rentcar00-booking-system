# Car image mirror script

- 스크립트: `scripts/mirror-car-images.js`
- 실행: `node scripts/mirror-car-images.js`
- 대상: `public.cars.image_url` 에 들어있는 현재 URL을 내려받아 Supabase Storage `car-images` 버킷으로 미러링하고, 이후 `image_url` 을 Storage public URL로 교체한다.
- 추가 차량이 들어온 뒤 다시 미러링이 필요하면, 새 차량의 `public.cars.image_url` 에 들어있는 값을 원문 주소로 보고 이 스크립트를 다시 실행하면 된다.
- 기본 동작은 이미 Storage URL 인 항목은 건너뛴다.
- 선택 옵션:
  - `CAR_IMAGE_MIRROR_DRY_RUN=true` : 업로드/DB 갱신 없이 경로만 검증
  - `CAR_IMAGE_MIRROR_LIMIT=10` : 일부만 처리
  - `CAR_IMAGE_MIRROR_FORCE=true` : 이미 Storage URL 인 항목도 다시 업로드
