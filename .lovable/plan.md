

## Inventario: valores únicos por dimensión

### 1. Base de datos

- **Tabla `dimensions`**: solo `id`, `name`, `field`, `created_at`. No almacena valores únicos.
- **Tabla `computed_results`**: existe y se usa para cachear KPIs, conteos de operaciones y completitud de informes. No tiene entradas de tipo dimensión actualmente.
- **Funciones SQL**:
  - `refresh_all_computed_results`: itera reports y operations, pero **no calcula nada sobre dimensiones**.
  - `activate_pim_version`: valida que el atributo de cada dimensión exista en el archivo, pero **no calcula valores únicos**.
  - No existe ninguna función que extraiga `DISTINCT` values de un campo de dimensión.

### 2. Código TypeScript

- **`src/pages/AdminPage.tsx` (líneas 415-416)**: `dimensionUniqueValues` es un objeto vacío hardcodeado (`{}`). Nunca se llena con datos reales.
- **`src/pages/AdminPage.tsx` (línea 1197)**: lee `dimensionUniqueValues[dim.id]` que siempre devuelve `[]`, resultando en "Sin valor asignado · 1 grupos".
- **`src/hooks/usePimData.ts`**: `useDimensions()` fetch de la tabla `dimensions`, no incluye valores únicos. No hay hook para obtener valores de dimensión.

### 3. UI afectada

- **Admin → Dimensiones**: cada dimensión muestra `{uniqueVals.length + 1} grupos` (siempre "1 grupos") y solo el badge "Sin valor asignado".

### 4. Funciones SQL relacionadas

- `refresh_all_computed_results` y `activate_pim_version` no calculan valores de dimensión. Solo validan existencia del atributo.

---

## Plan mínimo

### A. Migración SQL — nueva función + integración en refresh

Crear una función `get_dimension_unique_values(p_dimension_field text)` que ejecute:

```sql
SELECT DISTINCT trim(val) AS val
FROM (
  SELECT CASE p_dimension_field
    WHEN 'Estado (Global)' THEN estado_global
    WHEN 'Visibilidad Adobe B2B' THEN visibilidad_b2b
    -- ... fixed columns
    ELSE attributes->>p_dimension_field
  END AS val
  FROM pim_records
) sub
WHERE val IS NOT NULL AND trim(val) <> ''
ORDER BY val;
```

Retorna `json` array de strings.

Agregar al loop de `refresh_all_computed_results`:

```sql
FOR v_dim IN SELECT id::text, field FROM dimensions LOOP
  -- store as computed_results(result_type='dimension_values', entity_id=dim.id)
  SELECT to_jsonb(array_agg(v)) INTO v_result FROM get_dimension_unique_values(v_dim.field) v;
  INSERT INTO computed_results ... ON CONFLICT DO UPDATE ...
END LOOP;
```

También agregar el caso `'dimension_values'` en `refresh_computed_result`.

### B. Hook en usePimData.ts

Crear `useDimensionValues()` que lea de `computed_results` donde `result_type = 'dimension_values'` y retorne `Record<string, string[]>` (dimension id → array de valores).

### C. AdminPage.tsx

Reemplazar el objeto vacío `dimensionUniqueValues` con los datos del nuevo hook `useDimensionValues()`.

### Resultado

- Al activar la Base PIM, `refresh_all_computed_results` calculará automáticamente los valores únicos de cada dimensión.
- Admin → Dimensiones mostrará los valores reales.
- No se crean tablas nuevas — se reutiliza `computed_results`.
- Cambios: 1 migración SQL, 1 hook nuevo, 1 línea en AdminPage.

