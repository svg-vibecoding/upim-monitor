

## Plan: Adjust KPI card color system

### Changes

#### 1. `src/lib/severity.ts` — Add `severityBgColor` helper

New function mapping standard severity → soft background class (bg-destructive/10, bg-warning/10, bg-caution/10, bg-good/10, bg-success/10). Used by completeness cards.

#### 2. `src/pages/ReportDetailPage.tsx` — Card 3 "Atributos foco" + Card 4 "Completitud promedio"

**Card 3 (lines 226–236)**: Remove dynamic bg and border-0. Use default Card (white bg). Change text colors of focusCount, "de Y", and focusPct to foreground/black. Keep AlertTriangle with `fc.text` color and tenue opacity.

**Card 4 (line 239)**: Add dynamic soft bg using `severityBgColor(avgCompleteness)` and `border-0`. Keep CompletenessCircle and text color as-is.

#### 3. `src/pages/NewReportPage.tsx` — Same changes as ReportDetailPage

**Card 3 (lines 565–575)**: White bg, black text, AlertTriangle keeps dynamic color.

**Card 4 (line 578)**: Dynamic soft bg from severity.

#### 4. `src/components/DimensionSummaryCards.tsx`

**Card "Mejor completitud" (line 45)**: Rename label to "Grupo con mejor completitud". Change `text-success` to `severityTextColor(best.completeness)`.

**Card "Grupo a mejorar" (line 62)**: Change `text-destructive` to `severityTextColor(worst.completeness)`.

**Card "Completitud promedio de los grupos" (line 71)**: Add dynamic soft bg using `severityBgColor(avgCompleteness)` and `border-0`.

### Files modified
- `src/lib/severity.ts`
- `src/pages/ReportDetailPage.tsx`
- `src/pages/NewReportPage.tsx`
- `src/components/DimensionSummaryCards.tsx`

