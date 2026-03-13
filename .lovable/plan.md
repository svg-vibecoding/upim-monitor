

## Plan: Filter by attribute classification in Attributes tab

### 1. UI Component for the filter

A row of compact `ToggleGroup` items (single-select, pill/chip style) placed right above the table, using the existing `ToggleGroup` + `ToggleGroupItem` components already in the project. Options: Todos | Base | Funcional | Dimensión | General. Default: "Todos". This is visually lightweight and consistent with the existing admin UI.

### 2. Classification description display

A single line of muted text below the filter chips that changes based on the selected type. Not a card, not a box — just a `<p className="text-sm text-muted-foreground">` that swaps content instantly via state. This avoids visual weight while providing context.

### 3. Empty state

When a filter has no matching attributes, the table is replaced with a simple centered message: "No hay atributos clasificados como [tipo]." — same muted style used elsewhere.

### 4. Implementation details

**State**: Add `const [attrTypeFilter, setAttrTypeFilter] = useState<string>("todos")` in AdminPage.

**Filter logic**: Before rendering the table rows, filter `["Código Jaivaná", ...fullAttributeList]` by checking if `getAttributeClassification(attr, dbReports, dbDimensions).type` matches the selected filter (skip filter when "todos").

**Counter update**: The summary text changes from static count to show filtered count: "Mostrando X de Y atributos."

**Changes**: Only `src/pages/AdminPage.tsx` — no new files, no new components.

| Area | Detail |
|---|---|
| File | `src/pages/AdminPage.tsx` |
| New state | `attrTypeFilter` (string, default "todos") |
| UI addition | `ToggleGroup` row + description `<p>` between existing summary and table |
| Filter logic | `useMemo` filtering the attribute list by classification type |
| Empty state | Simple `<p>` centered text when filtered list is empty |

