

## Plan: Add severity filters to custom reports + move Filter icon to the left in both views

### Changes

#### 1. `src/pages/NewReportPage.tsx`
- Add `severityFilter` state and severity helpers (same `getSeverity`, `severityDot`, `severityLabel` functions used in `ReportDetailPage`)
- Import `Filter` from lucide-react
- Add a filter bar above the attribute results table (between the header and the `<Table>`), with the Filter icon on the left followed by the four severity dot-buttons — same pattern as Dashboard
- Filter `attrResults` by severity before rendering

#### 2. `src/pages/ReportDetailPage.tsx`
- Move the Filter icon to the **left** of the severity buttons (currently the clear-filter icon is on the right)
- Replace the current layout: put `<Filter>` icon first, then the four severity buttons — matching the Dashboard pattern
- Remove the separate clear-filter button (clicking an active filter already deselects it)

### Files changed

| File | Change |
|---|---|
| `src/pages/NewReportPage.tsx` | Add severity filter state, helpers, Filter icon + dot buttons above results table, filter rows |
| `src/pages/ReportDetailPage.tsx` | Move Filter icon to left of severity buttons, match Dashboard layout |

