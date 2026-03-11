

## Plan: Cambiar universo de SumaGO B2B y B2C a Base Digital

**Problema**: Los informes SumaGO B2B y B2C usan `visible_b2b` / `visible_b2c` como universo, pero deberían evaluar solo los SKUs de la **Base Digital** (registros con "Código SumaGo" poblado en attributes).

### Cambios

**1. Agregar `UniverseKey` "digital_base" al tipo** (`src/data/mockData.ts`)
- Agregar `"digital_base"` al tipo `UniverseKey`.

**2. Implementar filtro en `getRecordsForReport`** (`src/hooks/usePimData.ts`)
- Agregar case `"digital_base"` que filtre registros donde el atributo "Código SumaGo" (en el JSONB `attributes`) esté poblado.

**3. Migración: actualizar `universe_key` en la BD**
- UPDATE los reportes SumaGO B2B y SumaGO B2C para usar `universe_key = 'digital_base'`.
- Actualizar también la descripción del universo para que diga "SKUs en Base Digital" en lugar de "Visibilidad Adobe B2B/B2C = Visible".

**4. Actualizar `get_pim_kpis`** (si es necesario, sin cambio — ya calcula `digital_base` correctamente por separado).

**Resultado**: Ambos informes SumaGO evaluarán solo los ~X SKUs de la base digital, no los 22,065 visibles B2B.

