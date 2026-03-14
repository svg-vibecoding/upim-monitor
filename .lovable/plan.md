

## Plan: Módulo Operaciones con vinculación a KPIs del Dashboard

### 1. Vinculación operación → KPI/card

Se agrega una columna `linked_kpi` (text, nullable) a la tabla `operations`. Valores posibles en V1: `'digital_base'`, `'visible_b2b'`, `'visible_b2c'`, o `null` (sin vincular). Restricción: solo una operación activa puede estar vinculada a cada KPI a la vez (validado en código al guardar).

Esto es simple, no requiere tabla intermedia ni framework de dependencias. Una operación sabe si gobierna un KPI y cuál.

### 2. KPIs configurables en V1

Los tres sub-KPIs del card "Base Digital" del dashboard:

| KPI | `linked_kpi` | Lógica actual hardcodeada |
|---|---|---|
| Base Digital | `digital_base` | `Código SumaGo` tiene valor |
| Visibles B2B | `visible_b2b` | `Visibilidad Adobe B2B` = Visible |
| Visibles B2C | `visible_b2c` | `Visibilidad Adobe B2C` = Visible |

El card "Catálogo" (total/activos/inactivos) y "Completitud General" quedan sin cambios — son métricas estructurales que no tiene sentido parametrizar.

**Evaluación**: cuando una operación está vinculada a un KPI, el conteo del dashboard se calcula evaluando esa operación contra los registros PIM (client-side con `evaluateOperation`), reemplazando el valor hardcodeado de `get_pim_kpis`. Si no hay operación vinculada, se usa el fallback actual del SQL.

### 3. Interfaz de asignación

**En el dialog de crear/editar operación**: se agrega un campo opcional al final, antes de guardar:

- Label: "Vincular a indicador del dashboard"
- Select con opciones: (ninguno), Base Digital, Visibles B2B, Visibles B2C
- Si el KPI ya está asignado a otra operación, se muestra junto a la opción: "(actualmente: nombre operación)" y al seleccionarlo se advierte que reemplazará la asignación anterior

**En la lista de operaciones**: badge sutil junto al nombre mostrando el KPI vinculado (ej: "Base Digital") cuando aplique.

No se crea una pantalla separada de configuración de KPIs. La asignación vive dentro de la operación misma.

### 4. Preparación para reutilización en informes

La tabla `operations` queda lista para que en una iteración futura se agregue `operation_id` a `predefined_reports` como alternativa a `universe_key`. La función `evaluateOperation()` ya sirve para filtrar registros tanto para KPIs como para universos de informes. No se implementa esa vinculación en esta V1.

### 5. Modelo de datos

```sql
CREATE TABLE operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  logic_mode text NOT NULL DEFAULT 'all',
  conditions jsonb NOT NULL DEFAULT '[]',
  linked_kpi text DEFAULT NULL,  -- 'digital_base' | 'visible_b2b' | 'visible_b2c' | null
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: read authenticated, manage usuario_pro
-- Trigger: update_updated_at
```

### 6. Archivos a modificar

| Archivo | Cambio |
|---|---|
| Migración SQL | Tabla `operations` con RLS y trigger |
| `src/hooks/usePimData.ts` | Types (`Operation`, `Condition`, `OperatorType`), `useOperations()`, `evaluateOperation()`, `matchCondition()` |
| `src/pages/AdminPage.tsx` | Tab "Operaciones" con lista + dialog CRUD + select de linked_kpi + AlertDialog eliminación |
| `src/pages/DashboardPage.tsx` | Consumir operaciones vinculadas para sobreescribir conteos de Base Digital / B2B / B2C cuando existan |

### 7. Fuera de alcance V1

- Vincular operaciones a informes predefinidos
- KPIs de Catálogo o Completitud configurables
- Evaluación server-side (SQL dinámico)
- Grupos anidados, operadores numéricos
- Historial de cambios, duplicar operaciones

