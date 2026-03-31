

# Persistir universo por lista de códigos en informes predefinidos

## Problema

Cuando el usuario selecciona "Cargar archivo Excel" como fuente del universo en `CreatePredefinedReportPage`, los códigos se leen correctamente en el cliente (`csvCodes`), pero:
- `resolveOperationId()` retorna `null` para `source === "file"`
- Los códigos no se guardan en ningún campo de `predefined_reports`
- Al recargar, el informe se interpreta como universo general

## Estrategia propuesta: columna `csv_codes` en `predefined_reports`

Crear una columna `csv_codes text[]` en la tabla `predefined_reports` para almacenar directamente la lista de códigos. Esta estrategia es preferible a crear una operación derivada porque:
- Las operaciones usan condiciones por atributo (equals, contains, etc.) — no están diseñadas para listas de miles de códigos
- Una columna `csv_codes` permite un filtro SQL simple y eficiente: `WHERE codigo_jaivana = ANY(csv_codes)`
- Es explícita, auditable y no contamina el módulo de operaciones con datos que no son reglas funcionales

## Cambios necesarios

### 1. Migración: agregar columna `csv_codes`

```sql
ALTER TABLE predefined_reports 
ADD COLUMN csv_codes text[] NOT NULL DEFAULT '{}';
```

### 2. Actualizar `get_report_completeness` (función SQL)

Agregar un bloque que, cuando `csv_codes` no está vacío y no hay `operation_id`, use:
```sql
v_where := 'codigo_jaivana = ANY(' || quote_literal(v_csv_codes::text) || '::text[])';
```

Prioridad: `operation_id` > `csv_codes` > `universe_key` > `all`.

### 3. `CreatePredefinedReportPage.tsx` — guardar `csv_codes`

En `handleSave`, cuando `source === "file"`, pasar `csv_codes` al insert/update del informe:
- **Crear**: incluir `csv_codes: csvCodes` en el payload de `createReport.mutateAsync`
- **Editar**: incluir `csv_codes: csvCodes` en el update

Cuando `source !== "file"`, guardar `csv_codes: []` para limpiar códigos previos si se cambia la fuente.

### 4. `useCreatePredefinedReport` / `usePredefinedReports` (usePimData.ts)

- Agregar `csvCodes` al tipo `PredefinedReport` y al mapeo de la query
- Incluir `csv_codes` en el mutation de creación

### 5. `getRecordsForReport` (usePimData.ts) — filtro client-side

Agregar un bloque antes del fallback a `universe_key`:
```ts
if (report.csvCodes && report.csvCodes.length > 0) {
  const codeSet = new Set(report.csvCodes);
  return allRecords.filter(r => codeSet.has(r.codigoJaivana));
}
```

### 6. `CreatePredefinedReportPage.tsx` — repoblar en edición

En el `useEffect` de edición, si `report.csvCodes?.length > 0`, setear `source = "file"` y poblar `csvCodes`, `uploadedFileName` (como "Archivo cargado previamente"), `uploadedFileReady = true`.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| Nueva migración SQL | `ALTER TABLE predefined_reports ADD COLUMN csv_codes text[]` |
| Función SQL `get_report_completeness` | Agregar rama de filtrado por `csv_codes` |
| `src/hooks/usePimData.ts` | `PredefinedReport.csvCodes`, `getRecordsForReport`, mutation de creación |
| `src/data/mockData.ts` | Agregar `csvCodes` a la interfaz `PredefinedReport` |
| `src/pages/CreatePredefinedReportPage.tsx` | Guardar `csv_codes` al crear/editar, repoblar en edición |

## Lo que NO cambia

- Lógica de operaciones
- Módulo de dimensiones
- Descarga de informes
- Dashboard / focos de atención
- RLS policies (la columna hereda las policies existentes de `predefined_reports`)

