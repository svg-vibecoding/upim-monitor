

## Plan: Add "Portafolio foco" to Focos de atención

### Problem
1. The Dashboard's "Focos de atención" panel hardcodes which reports appear as tabs (line 73 of `DashboardPage.tsx`), excluding the new "Portafolio foco" report.
2. No PIM reload is needed — the `producto_foco` universe filter runs dynamically against the active PIM data.

### Change

| File | Change |
|---|---|
| `src/pages/DashboardPage.tsx` | Add `"Portafolio foco"` to the filter array on line 73 so it appears as a tab in the Focos de atención panel |

### Detail
Line 73 currently:
```typescript
.filter((r) => ["PIM General", "SumaGO B2B", "SumaGO B2C", "Compras"].includes(r.name))
```
Change to:
```typescript
.filter((r) => ["PIM General", "Portafolio foco", "SumaGO B2B", "SumaGO B2C", "Compras"].includes(r.name))
```

The `sortReportsByDisplayOrder` already handles the correct position (second) since `REPORT_DISPLAY_ORDER` was updated in the previous change.

