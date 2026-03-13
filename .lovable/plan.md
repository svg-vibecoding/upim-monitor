

## Plan: Dynamic Attribute Classification and PIM Activation Validation

### Context

Currently, attribute classification is hardcoded in `ATTRIBUTE_CLASSIFICATION` (usePimData.ts) and the PIM activation validation in `activate_pim_version` uses a static list of 4 mandatory attributes. But the system now has dynamic reports and dimensions that depend on specific attributes. These dependencies are not reflected in the classification nor in the activation validation.

**Attributes currently missing from classification:**
- `Código SumaGo` — used by SumaGO B2B and SumaGO B2C reports (universe `digital_base`) — should be **funcional**
- `Producto foco` — used by Portafolio foco report (universe `producto_foco`) — should be **funcional**
- `Marca Comercial` — used as an active dimension — should be **dimensión**
- `Estado (Global)` and `Visibilidad Adobe B2B` are also used as dimensions but already classified as funcional (dual use is fine, funcional takes precedence)

### How each question is resolved

**1. How to identify attributes in active use:**

A constant maps each `universe_key` to the attribute it depends on:

```text
UNIVERSE_KEY_ATTRIBUTE_MAP = {
  active       → "Estado (Global)"
  digital_base → "Código SumaGo"
  visible_b2b  → "Visibilidad Adobe B2B"
  visible_b2c  → "Visibilidad Adobe B2C"
  producto_foco→ "Producto foco"
  all          → (none)
}
```

- **Funcional attributes**: scan `predefined_reports` universe_keys, map to attributes via the constant above. This captures any future report that uses a universe_key.
- **Dimensión attributes**: scan `dimensions.field` for all active dimensions.
- **Base**: always `Código Jaivaná` (hardcoded, it's the PK).

**2. How classification becomes visible:**

`getAttributeClassification()` becomes a function that receives reports and dimensions as parameters (or a new hook `useAttributeClassifications` wraps it). The Attributes tab, report editor, and dimension editor all show the dynamically computed type.

**3. How protected attributes show in PIM upload:**

Replace `MANDATORY_ATTRIBUTES` (hardcoded 4 items) with a dynamically computed list grouped by reason:
- Base: Código Jaivaná
- Funcional: attributes from universe_key mapping (with which report uses them)
- Dimensión: attributes from active dimensions (with which dimension uses them)

The validation box shows each missing attribute with its type and the feature that depends on it.

**4. How activation is blocked:**

- **Client-side**: `canActivate` checks all protected attributes are present in the uploaded file's `attributeOrder`.
- **Server-side**: `activate_pim_version` queries `predefined_reports` and `dimensions` to dynamically build the required list, instead of using a hardcoded array.

**5. What is code vs data:**

- **Code**: the `universe_key → attribute` mapping (because the filtering SQL is also in code)
- **Data**: which reports exist, which dimensions exist (from DB)
- **Derived**: the full protected attributes list (computed at runtime from both)

### Changes

| File | Change |
|---|---|
| `src/hooks/usePimData.ts` | Add `UNIVERSE_KEY_ATTRIBUTE_MAP` constant. Replace hardcoded `ATTRIBUTE_CLASSIFICATION` with a dynamic `computeAttributeClassification(reports, dimensions)` function. Export `getProtectedAttributes(reports, dimensions)` returning `{attr, type, reason}[]`. Keep `getAttributeClassification` signature but make it accept optional reports/dimensions. Add `useProtectedAttributes()` hook. |
| `src/pages/AdminPage.tsx` | Replace hardcoded `MANDATORY_ATTRIBUTES` with dynamic protected list from `useProtectedAttributes()`. Update missing-attributes UI to show type and reason. Attributes tab uses dynamic classification. |
| `activate_pim_version` (DB function) | Replace hardcoded `v_required` array with dynamic query: select distinct attributes from `predefined_reports` universe_keys (via a CASE mapping) + `dimensions.field`. Validate all are present in `v_attr_order`. |

### Server-side function change (SQL)

The `activate_pim_version` function will build `v_required` dynamically:

```sql
-- Functional: from universe_key mapping
SELECT DISTINCT CASE universe_key
  WHEN 'active' THEN 'Estado (Global)'
  WHEN 'digital_base' THEN 'Código SumaGo'
  WHEN 'visible_b2b' THEN 'Visibilidad Adobe B2B'
  WHEN 'visible_b2c' THEN 'Visibilidad Adobe B2C'
  WHEN 'producto_foco' THEN 'Producto foco'
END FROM predefined_reports WHERE universe_key != 'all'
UNION
-- Dimensions
SELECT DISTINCT field FROM dimensions;
```

This ensures any new report or dimension automatically protects its attribute.

