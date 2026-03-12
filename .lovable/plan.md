

## Plan: Loading feedback when generating custom report

### Problem
When clicking "Generar informe", the step switches to "results" immediately but `allRecords` may still be loading from the database. The user sees a table with all zeros (0 SKUs, 0%, etc.) for several seconds until data arrives.

### Solution
Add a loading state between clicking "Generar informe" and the results being ready. Use `isLoading` from `usePimRecords()` to detect when data is still fetching.

### Changes to `src/pages/NewReportPage.tsx`

1. **Extract `isLoading` from `usePimRecords()`**: Destructure `isLoading` (or `isFetching`) alongside `data`.

2. **Show loading state in results view**: When `step === "results"` and records are still loading (`isLoading` or `records.length === 0 && isFetching`), show a loading message with spinner: *"Informe en proceso..."* — consistent with the pattern used in dashboard and dimension reports.

3. **Condition flow in results section**:
   - If loading → show spinner + "Informe en proceso..."
   - If loaded → show summary stats + table (current behavior)

### Single file changed

| File | Change |
|---|---|
| `src/pages/NewReportPage.tsx` | Extract `isLoading` from query, show loading feedback before results render |

