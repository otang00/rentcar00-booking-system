# DELIVERY DONG IDS (PHASE 4 REFERENCE)

- **Source API:** `GET https://partner.premove.co.kr/35457` via existing `api/search-cars` handler (any pickup search returns the same `company.deliveryCostList`).
- **Latest capture:** 2026-04-15 (`supabase/.temp/delivery-cost-list.json`, 1,363 dong entries).
- **Regeneration:**
  ```bash
  cd projects/premove-clone
  set -a && source .env && set +a && node scripts/dump-delivery-costs.js
  ```
  - For ad-hoc use without the helper script, reference the snippet logged during Phase 4 P1 (output stored in `supabase/.temp/delivery-cost-list.json`).

## Sample dongId pairs (for S07~S12 scenarios)
| Scenario | City | Dong | dongId | Round-trip delivery |
| --- | --- | --- | --- | --- |
| 서울 종로구 청운동 | 종로구 | 청운동 | `1` | 60,000 KRW |
| 서울 강남구 삼성동 | 강남구 | 삼성동 | `436` | 40,000 KRW |
| 서울 동작구 흑석동 | 동작구 | 흑석동 | `414` | 60,000 KRW |
| 경기도 성남시 분당구 분당동 | 성남시 분당구 | 분당동 | `1598` | 120,000 KRW |
| 서울 성북구 정릉동 | 성북구 | 정릉동 | `270` | 60,000 KRW |
| 서울 금천구 가산동 | 금천구 | 가산동 | `373` | 60,000 KRW |

## Notes
- `supabase/.temp/delivery-cost-list.json` includes all provinces/cities/dongs with their partner `id` and `roundTrip` fee. Use it to swap in alternate `dongId` values without re-hitting the partner site.
- When updating `docs/present/PHASE4_SAMPLE_QUERIES_PRESENT.md`, keep the `dongId` column in sync with the table above.
