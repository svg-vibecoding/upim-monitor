

## Inventario de acciones que modifican configuración vs. recálculo automático

### Acciones CON recálculo automático (ya implementadas)

| # | Acción | Archivo | Recálculo que dispara |
|---|--------|---------|----------------------|
| 1 | **Activar versión PIM** | AdminPage L763-765 | `refreshAll()` — recalcula todo |
| 2 | **Recalcular datos (manual)** | AdminPage L838-842 | `refreshAll()` — recalcula todo |
| 3 | **Editar operación existente** | AdminPage L183-184 | `refreshForOperation(opId, reports)` — recalcula conteo de esa operación + completitud de informes que la usan + KPIs |
| 4 | **Activar/desactivar operación** | AdminPage L198 | `refreshForOperation(opId, reports)` — igual que arriba |
| 5 | **Editar informe (diálogo rápido)** | AdminPage L362 | `refreshForReport(reportId)` — recalcula completitud de ese informe |

### Acciones SIN recálculo automático (dejan computed_results desactualizado)

| # | Acción | Archivo / Línea | Qué queda desactualizado | Recálculo necesario |
|---|--------|-----------------|--------------------------|---------------------|
| A | **Crear informe predefinido** | CreatePredefinedReportPage L192-210 | No existe entrada en `computed_results` para el nuevo informe. Dashboard muestra datos vacíos hasta recálculo manual. | `refreshForReport(newReportId)` después de crear |
| B | **Editar informe (página completa)** | CreatePredefinedReportPage L196-207 (modo edit) | Si cambian atributos u operación, la completitud cacheada queda obsoleta. | `refreshForReport(reportId)` después de guardar cambios |
| C | **Crear operación nueva** | AdminPage L176-179 | No se ejecuta `refreshForOperation` porque `editingOpId` es null (L183: `if (editingOpId)`). La nueva operación no tiene conteo cacheado. | `refreshForOperation(newOpId, reports)` usando el ID retornado del insert |
| D | **Eliminar operación** | AdminPage L204-213 | El conteo cacheado de la operación eliminada queda huérfano. Los informes que la usaban podrían mostrar datos obsoletos. | `refreshOne("dashboard_kpis")` + invalidar cache de informes afectados |
| E | **Crear dimensión** | AdminPage L434-438 | No se computan valores únicos para la nueva dimensión. | `refreshOne("dimension_values", newDimId)` |
| F | **Editar dimensión** | AdminPage L427-432 | Si cambia el campo, los valores únicos cacheados quedan obsoletos. | `refreshOne("dimension_values", dimId)` |
| G | **Eliminar dimensión** | AdminPage L449-457 | Entrada huérfana en `computed_results`. No afecta funcionalidad pero es basura. | Limpiar entrada de `computed_results` (opcional) |
| H | **Guardar config de cards del dashboard** | DashboardCardsConfigSection | No afecta `computed_results` directamente — solo cambia qué datos se muestran, no los datos en sí. | No requiere recálculo |

### Plan de corrección

Agregar las llamadas de recálculo faltantes usando las funciones existentes de `useRefreshComputed`, sin crear lógica nueva:

**1. CreatePredefinedReportPage** — importar y usar `useRefreshComputed`:
- Al crear: después de `createReport.mutateAsync(...)`, llamar `refreshForReport(newReportId)` con el ID retornado
- Al editar: después de guardar cambios, llamar `refreshForReport(reportId)`
- Si se creó una operación inline nueva: llamar también `refreshForOperation(newOpId, reports)`

**2. AdminPage — Crear operación** (L171-185):
- Capturar el ID retornado del insert (`select("id").single()`) 
- Llamar `refreshForOperation(newOpId, dbReports)` para el nuevo ID

**3. AdminPage — Eliminar operación** (L204-213):
- Después de eliminar, llamar `refreshOne("dashboard_kpis")` para actualizar KPIs

**4. AdminPage — Crear/editar dimensión** (L419-446):
- Después de guardar, llamar `refreshOne("dimension_values", dimId)` usando el ID existente o el retornado del insert

**Archivos a modificar:**
- `src/pages/CreatePredefinedReportPage.tsx`
- `src/pages/AdminPage.tsx`

