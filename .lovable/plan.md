

## Plan: Botón "Recalcular datos de la app"

Agregar un botón independiente en la sección Base PIM que solo recalcula los resultados precalculados (`computed_results`), sin modificar `pim_metadata.updated_at` ni la fecha de última actualización de la Base PIM.

### Cambio

**`src/pages/AdminPage.tsx`** — Agregar una card separada debajo de la zona de carga/activación con:
- Botón **"Recalcular datos de la app"** con ícono `RefreshCw`
- Texto explicativo: *"Recalcula KPIs, completitud de informes y conteos de operaciones sin modificar la Base PIM."*
- Estado de carga (spinner + texto "Recalculando...")
- Toast de éxito/error al terminar
- Invalida queries de `computed-result` y `pim-kpis` tras completar

El botón llama a `refreshAll()` (que ya existe y solo ejecuta `refresh_all_computed_results()` — esta función NO toca `pim_metadata`).

No se requiere migración SQL ni cambios en hooks — `refresh_all_computed_results()` ya existe y no modifica `pim_metadata.updated_at`.

### Archivo afectado

| Archivo | Cambio |
|---------|--------|
| `src/pages/AdminPage.tsx` | Nueva card con botón de recálculo en la tab "Base PIM" |

