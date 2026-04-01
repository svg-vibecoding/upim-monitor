

## Diagnóstico: Referencias huérfanas tras recarga de Base PIM

### Entidades afectadas

Cuando se carga un archivo con columnas renombradas o eliminadas, las siguientes entidades conservan referencias a atributos que ya no existen en `pim_records.attributes`:

| Entidad | Campo | Tipo de referencia |
|---|---|---|
| `predefined_reports` | `attributes text[]` | Lista de atributos evaluados por el informe |
| `pim_metadata` | `attribute_order text[]` | Se actualiza correctamente en `activate_pim_version` — **no queda huérfano** |
| `operations` | `conditions jsonb` | Cada condición con `sourceType=attribute` referencia un nombre de atributo en `attribute` |
| `dimensions` | `field text` | Nombre del atributo usado como eje de agrupación |
| `computed_results` | `result jsonb` | Datos cacheados con nombres de atributos anteriores — se resuelve con `refresh_all_computed_results` |

`pim_metadata.attribute_order` ya se sobrescribe en `activate_pim_version`, así que no es un problema.

### Impacto real

- **Informes**: muestran atributos con 0% de completitud permanente (el atributo existe en la config pero no en los datos)
- **Operaciones**: condiciones que evalúan atributos inexistentes siempre dan `no_value` o `false`, distorsionando filtros
- **Dimensiones**: si el campo referenciado no existe, la dimensión devuelve cero valores únicos

### Estrategia propuesta: limpieza post-activación

El momento natural es dentro de `activate_pim_version` (función SQL), justo después de copiar staging → producción y actualizar `pim_metadata`. Los nuevos atributos válidos ya están en `v_attr_order`.

#### Paso 1: Limpiar `predefined_reports.attributes`

```sql
UPDATE predefined_reports
SET attributes = (
  SELECT array_agg(a)
  FROM unnest(attributes) a
  WHERE a = ANY(v_attr_order)
)
WHERE attributes != '{}';
```

Elimina de cada informe los atributos que ya no existen en el nuevo archivo. Los informes conservan solo atributos válidos.

#### Paso 2: Desactivar operaciones con condiciones huérfanas

Para operaciones con `sourceType=attribute`: verificar si el atributo referenciado existe en `v_attr_order`. Si alguna condición referencia un atributo eliminado, marcar la operación como `active = false` y registrar el motivo. No borrar la operación ni sus condiciones para permitir revisión manual.

```sql
UPDATE operations SET active = false
WHERE active = true
AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(conditions) c
  WHERE COALESCE(c->>'sourceType','attribute') = 'attribute'
  AND NOT (c->>'attribute' = ANY(v_attr_order))
);
```

#### Paso 3: Desactivar dimensiones con campo huérfano

No hay campo `active` en `dimensions`, así que hay dos opciones:
- **Opción A**: Agregar columna `active boolean DEFAULT true` y filtrar en queries
- **Opción B**: Eliminar la dimensión directamente (más simple pero destructiva)

Recomendación: **Opción A** para consistencia con operaciones.

#### Paso 4: Refrescar `computed_results`

Ya se ejecuta `refresh_all_computed_results` tras la activación. Los resultados cacheados se regeneran con los atributos válidos.

### Informe de limpieza

Después de la limpieza, devolver al frontend un resumen de lo que se limpió:

```text
{
  reportsCleanedCount: 2,
  removedAttributes: ["Imagen antigua", "Color legacy"],
  operationsDeactivated: ["Filtro descontinuado"],
  dimensionsDeactivated: []
}
```

Esto se puede mostrar en la UI de activación como un aviso post-confirmación.

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| Migración SQL | Agregar `active` a `dimensions`; modificar `activate_pim_version` para incluir limpieza |
| `src/hooks/usePimData.ts` | Filtrar dimensiones inactivas en `useDimensions()` |
| `src/pages/AdminPage.tsx` | Mostrar resumen de limpieza tras activación (opcional) |
| Edge Function `activate-pim-version` | Sin cambios — ya llama a `activate_pim_version` RPC |

### Lo que NO cambia

- Lógica de carga/upload de archivos
- Módulo de descarga de informes
- Dashboard / focos de atención
- RLS policies

