

# Plan: Show all fields including functional and dimension fields in the attribute dialog

## Problem
The upload edge function maps 7 fields to fixed DB columns and only saves the remaining JSONB keys to `pim_metadata.attribute_order`. This means "Estado (Global)", "SumaGO", "Visibilidad Adobe B2B", "Visibilidad Adobe B2C", "Categoría N1 Comercial", and "Clasificación del Producto" are invisible in the report configuration dialog.

## Solution
In `AdminPage.tsx`, build the full attribute list by prepending the missing fields to `attributeOrder` in their natural position.

### File: `src/hooks/usePimData.ts`
- Add a new constant `FIXED_COLUMN_FIELDS` listing the 6 fields that get mapped to fixed columns (excluding Código Jaivaná which is already handled separately as "always visible").
- Add a helper `getFullAttributeList(attributeOrder)` that prepends these fields to the attribute order array (only those not already present), placing them at the start in a logical order matching the Excel layout.

### File: `src/pages/AdminPage.tsx`
- Replace `attributeOrder` with `getFullAttributeList(attributeOrder)` when building `filteredAttrs` and the dialog list.
- The existing tagging logic (badges for "funcional" / "dimensión") already handles `NON_EVALUABLE_FIELDS` and `DIMENSION_FIELDS`, so those badges will appear automatically.

### No other files need changes
The report detail/list pages already use `filterRealAttributes` which validates against `attributeOrder` — but since these fields are fixed columns accessed via `dbRowToPIMRecord`, they will resolve correctly from the record objects regardless.

### Technical detail
The fields to inject before `attributeOrder`:
1. Estado (Global)
2. SumaGO
3. Visibilidad Adobe B2B
4. Visibilidad Adobe B2C
5. Categoría N1 Comercial
6. Clasificación del Producto

