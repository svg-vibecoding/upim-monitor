

## Inventario completo de `linked_kpi`

### 1. Base de datos

| Ubicación | Detalle |
|---|---|
| **Columna `operations.linked_kpi`** | `text`, nullable, default `NULL` |
| **Migración original** (`20260314183934_...sql`, línea 10) | Crea la columna |
| **Migración antigua** (`20260314225809_...sql`, línea 273) | `refresh_all_computed_results` filtraba por `WHERE linked_kpi IS NOT NULL` (ya corregida en migración posterior) |
| **Función SQL `activate_pim_version`** | Referencia indirecta a `refresh_all_computed_results` — ya no filtra por `linked_kpi` tras la corrección |

No hay otras funciones SQL que referencien `linked_kpi` directamente.

---

### 2. TypeScript — `src/hooks/usePimData.ts`

| Línea(s) | Elemento |
|---|---|
| 728 | `export type LinkedKpi = "digital_base" \| "visible_b2b" \| "visible_b2c"` |
| 730-733 | `export const LINKED_KPI_LABELS: Record<LinkedKpi, string>` |
| 750 | Campo `linkedKpi` en `export type Operation` |
| ~762 | Mapeo `linkedKpi: row.linked_kpi` en la función de transformación de `useOperations` |

---

### 3. TypeScript — `src/pages/AdminPage.tsx`

| Línea(s) | Elemento |
|---|---|
| 43 | Import de `LINKED_KPI_LABELS` |
| 51 | Import de tipo `LinkedKpi` |
| 138 | Estado `opLinkedKpi` |
| 149, 156 | Set/reset de `opLinkedKpi` al abrir/cerrar diálogo |
| 166-174 | Validación de unicidad de `linked_kpi` y desvinculación de conflictos |
| 184 | Inclusión de `linked_kpi` en el payload de insert/update |
| 261-267 | `kpiAssignments` useMemo que mapea operaciones con KPI vinculado |
| 1318-1320 | Badge en tabla de operaciones que muestra el KPI vinculado |
| 1373-1393 | **Select "Vincular a indicador del dashboard"** en el diálogo de operación |

---

### 4. TypeScript — `src/pages/NewReportPage.tsx`

| Línea | Elemento |
|---|---|
| 156 | `linkedKpi: null` en la creación de operación inline |

---

### 5. TypeScript — `src/integrations/supabase/types.ts`

| Línea(s) | Elemento |
|---|---|
| 87, 98, 109 | `linked_kpi` en Row, Insert y Update de `operations` |

(Este archivo se auto-genera — se actualizará solo al eliminar la columna.)

---

### Plan de eliminación (pendiente de aprobación)

1. **Migración SQL**: `ALTER TABLE operations DROP COLUMN linked_kpi;`
2. **`usePimData.ts`**: Eliminar tipo `LinkedKpi`, constante `LINKED_KPI_LABELS`, y campo `linkedKpi` del tipo `Operation` y su mapeo.
3. **`AdminPage.tsx`**: Eliminar estado `opLinkedKpi`, lógica de unicidad, campo `linked_kpi` del payload, `kpiAssignments`, badge en tabla, y el bloque completo del Select "Vincular a indicador".
4. **`NewReportPage.tsx`**: Eliminar `linkedKpi: null` de la operación inline.
5. **`types.ts`**: Se actualiza automáticamente tras la migración.

No se tocan cards, informes, ni ninguna otra lógica.

