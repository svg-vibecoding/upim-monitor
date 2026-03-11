

## Dashboard Visual Refinement Plan

### Changes to `src/pages/DashboardPage.tsx` only

**1. KPI Cards -- Better hierarchy**
- Remove icon boxes (the 8x8 rounded-lg squares with Layers/Settings2/Eye) -- they add visual noise without value
- Keep uppercase labels but make them smaller/lighter
- Increase main number size from `text-4xl` to `text-5xl` for more punch
- Make secondary percentages use a consistent, quieter style: inline with the sub-values using `text-muted-foreground` without parentheses
- Sub-labels ("Activos", "Inactivos") become even smaller and use color dots instead of colored text for cleaner look

**2. Bottom section -- Asymmetric layout favoring Focos**
- Change grid from `lg:grid-cols-2` to `lg:grid-cols-5` with Informes getting `col-span-2` and Focos getting `col-span-3`
- Swap column order: Focos first (left, wider), Informes second (right, narrower)

**3. Informes Predefinidos -- Lighter weight**
- Remove the `h-9 w-9` icon boxes per report row
- Remove numbering (`{idx + 1}.`)
- Reduce padding, use a simpler row style
- Smaller section title, no icon in header
- Keep chevron on hover

**4. Focos de atención -- More presence**
- Slightly larger section title
- Severity filter dots get labels on hover (already done) but increase dot size slightly to `h-3.5 w-3.5`
- Add severity count badges next to dots
- Keep the tabs + scroll list as-is, just benefits from wider space

**5. General spacing**
- Increase gap between header and KPI cards
- Reduce gap between KPI cards slightly for tighter grouping
- More breathing room before the bottom section

