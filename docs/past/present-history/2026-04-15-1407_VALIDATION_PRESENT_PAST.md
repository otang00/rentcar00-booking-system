# VALIDATION_PRESENT

## Scope
- Search shadow Supabase integration (Phase 3-A/B)
- Diff logging + instrumentation (Phase 3-B)
- QA + reporting readiness (Phase 3-C)

## Test Matrix
| Scenario | Steps | Expected | Result |
| --- | --- | --- | --- |
| Shadow disabled | `SEARCH_SHADOW_ENABLED` unset, hit `/api/search-cars` via unit harness | Response identical to legacy, no `meta.shadow` | ✅ (manual reasoning + handler inspection) |
| Shadow enabled, logging success | Provide mock Supabase + log path, invoke handler | `meta.shadow.status=ok`, `logged=true`, log row written | ✅ (stub supabase + sample log) |
| Shadow enabled, logging failure | Force Supabase insert rejection | API still 200, `meta.shadow.warning` filled | ✅ (unit via `recordShadowDiff` test stub) |
| Shadow search failure | Throw from `dbSearchService` | API still 200, `meta.shadow.status=error`, logging skipped | ⚠️ Pending real data run |

## Pending / Blocking
- Need staging Supabase dataset + service role key to execute full end-to-end shadow fetch.
- Need real partner API credentials for live diff sanity check.

## Notes
- Sample log stored at `supabase/.temp/shadow-log.sample.jsonl` (local only).
- Enable envs: `SEARCH_SHADOW_ENABLED=true`, `SUPABASE_SERVICE_ROLE_KEY=...`, `SEARCH_SHADOW_LOG_PATH=...`.
