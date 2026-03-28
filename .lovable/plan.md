# Notas de ajuste al plan de descarga — leer antes de implementar

Tu plan es correcto en estructura. Aplica estos ajustes:

## Ajuste 1: NO cargar 77K registros siempre

No cambies `needsRecords = !!selectedDimension` para cargar records siempre. En su lugar, carga los registros bajo demanda solo cuando el usuario haga click en "Informe y Productos":

- Usar `queryClient.fetchQuery` o un estado booleano que active la carga
- Mientras los registros cargan, mostrar un estado de loading en el item del dropdown (texto "Preparando descarga..." o un spinner)
- Si los registros ya están en cache de React Query (porque el usuario seleccionó una dimensión antes), la descarga será instantánea

Esto mantiene el rendimiento actual para los usuarios que solo quieren ver el informe sin descargar.

## Ajuste 2: Columnas de "Productos" — reglas de orden

La pestaña "Productos" debe tener este orden de columnas:

1. **Primera columna siempre:** `Código Jaivaná` (como texto, preservando ceros a la izquierda). Aparece aunque NO esté en los atributos del informe.
2. **Columnas intermedias:** los atributos que el informe evalúa (`report.attributes` en predefinidos, `selectedAttrs` en ad-hoc), en el orden definido por `attributeOrder` (pim_metadata). Si `Estado (Global)` está en los atributos del informe, NO ponerlo aquí — va al final.
3. **Última columna siempre:** `Estado (Global)`. Aparece aunque NO esté en los atributos del informe.

Ejemplo: si el informe evalúa ["Visibilidad Adobe B2B", "Marca", "Peso"], la pestaña "Productos" tendría las columnas: `Código Jaivaná | Visibilidad Adobe B2B | Marca | Peso | Estado (Global)`

NO incluir los 74 atributos del PIM — solo los del informe + las dos columnas fijas obligatorias.

## Ajuste 3: Forzar código como texto con cell.t = "s"

Para asegurar que el Código Jaivaná se exporte como texto (preservando ceros a la izquierda):

```typescript
// Después de crear la hoja con aoa_to_sheet:
const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
for (let row = range.s.r + 1; row <= range.e.r; row++) {
  const cell = sheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
  if (cell) {
    cell.t = "s"; // Force string type
    cell.v = String(cell.v); // Ensure value is string
  }
}

```

Usar `cell.t = "s"` (tipo string) en vez de `cell.z = "@"` (formato display). El primero le dice a Excel que el dato ES texto. El segundo solo cambia cómo se muestra pero Excel puede seguir tratándolo como número.

## Todo lo demás del plan está correcto

Procede con la implementación aplicando estos 3 ajustes.

## Plan: Dropdown de descarga con dos opciones (.xlsx)

### Resumen

Reemplazar el botón "Descargar resumen" por un `DropdownMenu` con dos opciones:

1. **Informe de completitud** — pestaña única "Resumen" con la tabla de completitud por atributo (lo que hoy exporta como CSV, ahora en .xlsx)
2. **Informe y Productos** — .xlsx con dos pestañas: "Resumen" (completitud) + "Productos" (todos los registros del universo con los atributos como columnas)

### Archivos a modificar


| Archivo                          | Cambio                                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/exportReport.ts`        | **Nuevo** — función utilitaria compartida para generar ambos .xlsx                                                          |
| `src/pages/ReportDetailPage.tsx` | Reemplazar botón por dropdown; usar nueva función; asegurar que `records` se carguen siempre (no solo cuando hay dimensión) |
| `src/pages/NewReportPage.tsx`    | Reemplazar botón por dropdown; usar nueva función                                                                           |


### Detalle técnico

#### 1. `src/lib/exportReport.ts` (nuevo)

Dos funciones exportadas usando la librería `xlsx` (ya instalada):

```text
exportCompletenessXlsx(filename, attrResults, dimensionResults?, dimensionName?)
  → Genera .xlsx con pestaña "Resumen"
  → Mismas columnas que el CSV actual + sección dimensión si aplica

exportFullReportXlsx(filename, attrResults, records, reportAttributes, attributeOrder, dimensionResults?, dimensionName?)
  → Genera .xlsx con dos pestañas:
  → Pestaña "Resumen": igual que arriba
  → Pestaña "Productos": una fila por producto del universo
```

**Pestaña "Productos"** — construcción:

- Columna A: `Código Jaivaná` (siempre texto, forzado con `z: "@"` en la celda o `t: "s"`)
- Columnas siguientes: los atributos del informe, en el orden de `attributeOrder` (pim_metadata)
- Para cada registro `PIMRecord`, se mapean los campos fijos (`estadoGlobal`, `visibilidadB2B`, etc.) y los atributos dinámicos del JSONB
- Se usa `XLSX.utils.json_to_sheet` o `aoa_to_sheet` y se fuerza el formato texto en la columna de código

#### 2. `src/pages/ReportDetailPage.tsx`

- Importar `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` y las nuevas funciones de export
- Cambiar la carga de records: actualmente solo carga si hay dimensión seleccionada (`needsRecords = !!selectedDimension`). Para "Informe y Productos" se necesitan siempre. Cambiar a cargar records siempre (ya se usa `usePimRecords()` que trae todos)
- Derivar `reportRecords` con `getRecordsForReport(allRecords, report, operations)` sin condicional de dimensión
- Reemplazar el `<Button>` por:

```text
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" className="gap-2">
      <Download /> Descargar informe <ChevronDown />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={handleDownloadCompleteness}>
      Informe de completitud
    </DropdownMenuItem>
    <DropdownMenuItem onClick={handleDownloadFull}>
      Informe y Productos
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

- `handleDownloadCompleteness` llama a `exportCompletenessXlsx`
- `handleDownloadFull` llama a `exportFullReportXlsx` pasando `reportRecords`, `report.attributes` y `pimOrderList`
- Ambos trackean `report_downloaded` con un campo extra `download_type`

#### 3. `src/pages/NewReportPage.tsx`

- Mismo patrón de dropdown
- `records` ya está disponible en el estado de resultados
- `selectedAttrs` son los atributos del informe
- Misma lógica: dos handlers que llaman a las funciones de export

### Mapeo de atributos a valores del PIMRecord

La función de export necesita mapear nombre de atributo → valor del registro. Los campos fijos se mapean así:

```text
"Estado (Global)" → record.estadoGlobal
"Visibilidad Adobe B2B" → record.visibilidadB2B
"Visibilidad Adobe B2C" → record.visibilidadB2C
"Categoría N1 Comercial" → record.categoriaN1Comercial
"Clasificación del Producto" → record.clasificacionProducto
Cualquier otro → record[attrName] (del JSONB plano)
```

### Código como texto

Para forzar `Código Jaivaná` como texto en el .xlsx, se recorrerán las celdas de la columna A después de crear la hoja y se asignará `cell.z = "@"` (formato texto), o se construirá con `aoa_to_sheet` donde el valor ya es string y se aplicará formato de columna.

### Lo que NO cambia

- Lógica de negocio, hooks, queries
- Estructura de la tabla de completitud en pantalla
- DimensionSummaryCards
- Tracking de eventos (solo se agrega campo `download_type`)