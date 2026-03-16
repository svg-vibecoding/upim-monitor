

## Root Cause

The discrepancy is a **stale cache** problem:

- **Live count** (`get_pim_kpis` / `get_operation_count`): **56,498** active SKUs (correct)
- **Cached value** in `computed_results`: **56,489** (stale, computed at 03:13 UTC, before the latest data upload at 15:04 UTC)

Card 1's main value is configured to use the "SKUs Activos" operation (`9ede96d8-...`), which reads from `computed_results`. The cache never got refreshed because `refresh_all_computed_results` only refreshes operations where `linked_kpi IS NOT NULL` — but **none** of the operations have `linked_kpi` set.

```text
refresh_all_computed_results()
  └─ FOR v_op IN SELECT id FROM operations 
       WHERE linked_kpi IS NOT NULL   ← filters out ALL operations
       AND active = true
     LOOP ...
```

## Fix

**1. SQL Migration**: Update `refresh_all_computed_results` to refresh ALL active operations, not just those with `linked_kpi IS NOT NULL`. Since operations are now used directly in dashboard card configs, the `linked_kpi` filter is obsolete.

```sql
-- Change line 273 from:
FOR v_op IN SELECT id::text FROM operations WHERE linked_kpi IS NOT NULL AND active = true
-- To:
FOR v_op IN SELECT id::text FROM operations WHERE active = true
```

**2. No code changes needed** — the TypeScript side already reads from `computed_results` correctly. Once the SQL function refreshes all active operations, the cached values will stay in sync after each PIM activation.

This is a single SQL migration. No table changes, no code changes, no changes to Card 1/2/3 logic.

