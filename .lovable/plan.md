

## Plan: Reorganizar pestaña "Informes" en Admin + Cards configurables

### Resumen

Dividir la pestaña "Informes" en dos secciones: (1) configuración de los 3 cards del dashboard, y (2) gestión de informes predefinidos (existente). Los cards del dashboard se alimentan dinámicamente desde una nueva tabla de configuración.

### 1. Nueva tabla: `dashboard_cards_config`

```sql
CREATE TABLE dashboard_cards_config (
  card_key text PRIMARY KEY,  -- 'card_1', 'card_2', 'card_3'
  label text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dashboard_cards_config ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer
CREATE POLICY "Authenticated read" ON dashboard_cards_config
  FOR SELECT TO authenticated USING (true);

-- Solo usuario_pro puede editar
CREATE POLICY "UsuarioPRO can manage" ON dashboard_cards_config
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'usuario_pro'));

-- Seed defaults
INSERT INTO dashboard_cards_config (card_key, label, config) VALUES
  ('card_1', 'Catálogo', '{"main_value":"total","secondary_1":null,"secondary_1_label":"Activos","secondary_2":null,"secondary_2_label":"Inactivos"}'::jsonb),
  ('card_2', 'Base Digital', '{"main_operation":null,"secondary_1":null,"secondary_1_label":"Visibles B2B","secondary_2":null,"secondary_2_label":"Visibles B2C"}'::jsonb),
  ('card_3', 'Completitud General', '{"report_id":null}'::jsonb);
```

Estructura del `config` JSONB por card:

```text
Card 1: { main_value: "total" | "<operation_id>",
           secondary_1: "<op_id>" | null,  secondary_1_label: string,
           secondary_2: "<op_id>" | null,  secondary_2_label: string }

Card 2: { main_operation: "<op_id>" | null,
           secondary_1: "<op_id>" | null,  secondary_1_label: string,
           secondary_2: "<op_id>" | null,  secondary_2_label: string }

Card 3: { report_id: "<report_id>" | null }
```

Cuando `main_value` es `"total"`, Card 1 muestra `kpis.total`. Si es un operation_id, muestra el count de esa operación. Cuando `secondary_1/2` es null, se usan los KPIs por defecto (activos/inactivos para Card 1, visibleB2B/B2C para Card 2).

### 2. Hook: `useDashboardCardsConfig`

**`src/hooks/usePimData.ts`** — Nuevo hook con React Query que lee `dashboard_cards_config` y expone la config tipada. También un mutation hook `useUpdateDashboardCard` para guardar cambios.

### 3. AdminPage — Pestaña "Informes" reorganizada

**`src/pages/AdminPage.tsx`** — La tab `reports` se divide visualmente en:

**Sección 1: "Cards del Dashboard"** — Tres cards de configuración colapsables (accordion o cards simples):

- **Card 1 "Total del PIM"**: Input para label, Select para dato principal ("Total" o una operación), 2x Select para datos secundarios (operaciones) + inputs para sus labels.
- **Card 2 "Universo configurable"**: Input para label, Select para operación principal, 2x Select para sub-datos (operaciones) + inputs para sus labels.
- **Card 3 "Progreso"**: Input para label, Select para elegir informe predefinido.

Cada card tiene botón "Guardar" independiente que hace `upsert` a `dashboard_cards_config`.

**Sección 2: "Informes predefinidos"** — El contenido actual (tabla + botón "Nuevo informe") se mantiene idéntico, solo con un separador y título de sección.

### 4. DashboardPage — Lectura dinámica

**`src/pages/DashboardPage.tsx`** — Reemplazar los valores hardcodeados:

- Leer config con `useDashboardCardsConfig()`
- Card 1: label dinámico, dato principal configurable (total o operation count), secundarios configurables
- Card 2: label dinámico, operación principal configurable, secundarios configurables  
- Card 3: label dinámico, report_id configurable (fallback a "PIM General" si null)
- Usar `useOperationCount` para cada operation_id configurado
- Los labels de los cards se leen de la config

**Fallback**: si no hay config o config está en null, se muestran los valores actuales (compatibilidad total).

### Archivos afectados

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Nueva tabla `dashboard_cards_config` con seed |
| `src/hooks/usePimData.ts` | Hooks `useDashboardCardsConfig` + `useUpdateDashboardCard` |
| `src/pages/AdminPage.tsx` | Tab "Informes" → 2 secciones: config cards + informes predefinidos |
| `src/pages/DashboardPage.tsx` | Leer config y renderizar cards dinámicamente |

