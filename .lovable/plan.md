

## Diagnosis: Slow checkbox toggle in attribute selection

The root cause is that every checkbox toggle triggers a full re-render of the entire attribute grid (100+ items). Each render:

1. `filteredAttrs` is **not memoized** — recalculated every render
2. `getAttributeClassification(attr)` is called for **every attribute** on every render
3. `selectedAttrs.includes(attr)` does a linear scan (O(n)) per attribute
4. `toggleAttr` creates a new function reference each render, preventing any child memoization

Combined, this causes hundreds of unnecessary computations and DOM updates on each checkbox click.

## Fix

### In `NewReportPage.tsx`

**A. Memoize `filteredAttrs`**
Wrap in `useMemo` with deps `[fullAttributes, searchAttr]`.

**B. Use a `Set` for selected attributes lookup**
Create `const selectedSet = useMemo(() => new Set(selectedAttrs), [selectedAttrs])` and use `selectedSet.has(attr)` instead of `selectedAttrs.includes(attr)`.

**C. Stabilize `toggleAttr` with `useCallback`**
Wrap `toggleAttr` in `useCallback` — the current implementation already uses the functional updater form of `setSelectedAttrs`, so it needs no deps.

**D. Extract attribute row into a `React.memo` component**
Create a small `AttributeCheckboxItem` component wrapped in `React.memo`. It receives `attr`, `checked`, `onToggle`, and pre-computed classification. This prevents re-rendering rows whose props haven't changed.

**E. Pre-compute classifications**
Inside the memoized `filteredAttrs`, map each attr to its classification once, producing `{ attr, classification }` objects, so `getAttributeClassification` isn't called on every render.

### Files changed

| File | Change |
|---|---|
| `src/pages/NewReportPage.tsx` | Memoize filteredAttrs, use Set, useCallback, extract memoized row component |

