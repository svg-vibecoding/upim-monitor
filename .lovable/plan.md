

## Plan: Loading feedback for dimension + include dimension in download

### Changes to `src/pages/ReportDetailPage.tsx`

**1. Loading state when dimension selected**

When `selectedDimension` is set but `loadingRecords` is true (records still fetching), show a message: "Informe por distribución {dimension name} en proceso..." instead of the empty placeholder or table.

The condition flow in the dimension section becomes:
- If `selectedDimension && loadingRecords` → show loading message with a spinner/skeleton
- If `dimensionResults.length > 0` → show table
- Else → show "Selecciona una dimensión..."

**2. Include dimension data in CSV download**

Update `handleDownload` to append a second section to the CSV when `dimensionResults.length > 0`:
- Add a blank separator row
- Add header row: `[dimension.name, "SKUs", "Poblados", "Completitud %"]`
- Add dimension result rows

This way the single "Descargar resumen" button exports both the attribute detail and the dimension breakdown in one file.

### Files changed

| File | Change |
|---|---|
| `src/pages/ReportDetailPage.tsx` | Add loading state for dimension computation; append dimension results to CSV download |

