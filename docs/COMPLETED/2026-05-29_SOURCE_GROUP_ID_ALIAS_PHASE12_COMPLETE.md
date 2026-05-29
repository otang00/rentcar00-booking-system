# Source Group ID Alias Phase 1-2 Complete

## 완료 범위
- 가격정책 검색 뷰 `v_search_pricing_hub_policies`에 `source_group_id` alias를 추가했다.
- 기존 `ims_group_id`는 호환을 위해 유지했다.
- 검색/상세 가격 로직은 `source_group_id`를 우선 사용하고 `ims_group_id`를 fallback으로 사용하도록 전환했다.

## 변경 파일
- `supabase/migrations/20260529112200_add_source_group_id_alias_to_search_pricing_view.sql`
- `server/search-db/repositories/fetchGroupPricePolicies.js`
- `server/search-db/transformers/mapDbCarsToDto.js`
- `server/search-db/pricing/calculateGroupPrice.js`
- `server/detail/buildDbCarDetailDto.js`

## 기준
- `cars.source_group_id`는 IMS 원본 그룹 ID로 유지한다.
- `v_search_pricing_hub_policies.source_group_id`도 같은 외부 원본 그룹 ID alias다.
- `ims_group_id`는 즉시 삭제하지 않고 기존 API/관리자 호환을 위해 남긴다.

## 검증
- `node --test server/search-db/**/*.test.js server/search-db/**/__tests__/*.test.js` 통과: 39개 pass
- `npm run build` 통과
- `git diff --check` 통과

## 남은 리스크 / 후속
- 실제 Supabase DB에는 migration을 아직 적용하지 않았다.
- 다음 phase에서 관리자/API 표시명까지 `source_group_id` 중심으로 정리할 수 있다.
- 최종적으로 `ims_group_id` 제거는 별도 phase에서 영향 범위 재검토 후 진행해야 한다.
