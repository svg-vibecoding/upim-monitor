

## Plan: Optimización server-side + precomputación controlada

### Fase A — SQL dinámico para desbloquear

**Migración SQL:**

1. **`build_operation_where(p_operation_id uuid, p_depth int DEFAULT 0) RETURNS text`** — traduce condiciones JSONB de una operación a un fragmento SQL WHERE nativo. Mapea atributos fijos a columnas (`estado_global`, etc.) y dinámicos a `attributes->>`. Soporta recursión para operaciones anidadas (máx profundidad 10). Modos `all` → AND, `any` → OR.

2. **Reescribir `get_report_completeness`** — cuando `v_operation_id IS NOT NULL`, reemplaza `evaluate_record_against_operation(r, v_operation_id)` por `EXECUTE 'SELECT ... FROM pim_records WHERE ' || build_operation_where(v_operation_id)`. Resultado: 1 query SQL en vez de ~77k llamadas PL/pgSQL.

3. **`get_operation_count(p_operation_id uuid) RETURNS integer`** — usa `build_operation_where` + `EXECUTE` para retornar conteo de registros que cumplen una operación.

### Fase B — Precomputación controlada

**Migración SQL:**

4. **Tabla `computed_results`:**
```text
result_type   text     NOT NULL   -- 'dashboard_kpis' | 'report_completeness' | 'operation_count'
entity_id     text     NULL       -- report_id u operation_id (NULL para dashboard_kpis)
result        jsonb    NOT NULL
computed_at   timestamptz DEFAULT now()
PRIMARY KEY (result_type, COALESCE(entity_id, '__global__'))
```

5. **`refresh_computed_result(p_type text, p_entity_id text DEFAULT NULL)`** — función que recalcula solo un resultado específico:
   - `'dashboard_kpis'` + NULL → ejecuta `get_pim_kpis()` y guarda
   - `'report_completeness'` + report_id → ejecuta `get_report_completeness(id)` y guarda
   - `'operation_count'` + operation_id → ejecuta `get_operation_count(id)` y guarda

6. **`refresh_all_computed_results()`** — recalcula todo (solo se invoca al activar nueva Base PIM).

7. **Sin triggers automáticos.** La invalidación se controla desde el frontend:
   - Al activar Base PIM: llamar `refresh_all_computed_results()` (ya ocurre en un flujo controlado)
   - Al guardar/editar operación: llamar `refresh_computed_result('operation_count', op_id)` + `refresh_computed_result('report_completeness', report_id)` para cada informe que use esa operación
   - Al editar informe: llamar `refresh_computed_result('report_completeness', report_id)` solo para ese informe

### Fase C — Frontend

**`src/hooks/usePimData.ts`:**

8. **`useComputedResult(type, entityId)`** — lee de `computed_results` por clave. Es la ruta principal.

9. **`useOperationCount(operationId)`** — wrapper que lee de `computed_results` con type `'operation_count'`. Si no existe el resultado, dispara `refresh_computed_result` una sola vez (recálculo puntual, no general).

10. **Ajustar `useReportCompleteness`** — leer primero de `computed_results`. Si no existe, disparar recálculo puntual de ese informe.

11. **`useRefreshComputed()`** — hook que expone funciones para invalidar resultados específicos, usado en mutations de operaciones e informes.

**`src/pages/DashboardPage.tsx`:**

12. **Eliminar `usePimRecords`** y toda la lógica de `evaluateOperation` client-side. Reemplazar KPIs de operaciones vinculadas por `useOperationCount` para cada linked_kpi.

**`src/pages/AdminPage.tsx`:**

13. **Eliminar `usePimRecords`** (línea 106 — carga 77k registros innecesariamente).

14. Tras `saveOperation` / `toggleOpActive` / `deleteOperation`: llamar refresh puntual de la operación afectada y sus informes vinculados.

15. Tras activar Base PIM: llamar `refresh_all_computed_results()`.

**`src/hooks/usePimData.ts` — mutations existentes:**

16. En `useUpdateReportOperation` y `useUpdateReportAttributes`: tras éxito, llamar refresh puntual del informe afectado.

### Archivos afectados

| Archivo | Cambio |
|---------|--------|
| Migración SQL | `build_operation_where`, reescritura `get_report_completeness`, `get_operation_count`, tabla `computed_results`, funciones de refresh |
| `src/hooks/usePimData.ts` | `useComputedResult`, `useOperationCount`, `useRefreshComputed`, ajuste a `useReportCompleteness`, agregar invalidación puntual en mutations |
| `src/pages/DashboardPage.tsx` | Eliminar `usePimRecords` + `evaluateOperation`, usar `useOperationCount` |
| `src/pages/AdminPage.tsx` | Eliminar `usePimRecords`, agregar refresh puntual en flujos de operaciones y activación PIM |

