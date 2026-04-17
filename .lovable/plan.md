

## Análisis del estado actual

**ReportDetailPage** y **NewReportPage** comparten el mismo patrón de orden para la tabla de dimensiones:
- Estado: `dimSortField: "value" | "completeness"` + `dimSortDir: "asc" | "desc"`
- Handler: `handleDimSort(field)` con ciclo de 3 estados (asc → desc → reset)
- Reset → orden por `value` ascendente (A-Z)
- `"Sin valor asignado"` siempre al final, aplicado tras el sort

La columna `DimensionResult` ya expone `totalSKUs` y `populated`, así que no se requieren cambios en el cálculo de datos.

## Plan de implementación

### 1. Ampliar el tipo del campo de orden

En ambas páginas:
```ts
dimSortField: "value" | "completeness" | "skus" | "populated"
```

### 2. Extender `handleDimSort` 

Aceptar los 4 valores. Mantener el mismo ciclo de 3 estados. El reset sigue siendo orden por `value` ascendente.

### 3. Extender la lógica de `sortedDimensionResults`

Añadir dos ramas al comparador:
- `"skus"` → comparar por `totalSKUs` numérico
- `"populated"` → comparar por `populated` numérico
- Para `completeness` mantener uso de `rawCompleteness ?? completeness` (criterio ya establecido)
- `"Sin valor asignado"` se sigue separando antes del sort y se concatena al final

### 4. Hacer clickeables los headers "SKUs" y "Poblados"

En la tabla de dimensiones, envolver los `TableHead` de SKUs y Poblados con el mismo patrón de botón + ícono de chevron que ya usan "Valor" y "Completitud". Reutilizar el mismo componente/marcado existente.

### 5. Fuera de alcance

- No se toca la tabla de atributos (solo dimensiones)
- No se cambia el comportamiento de "Sin valor asignado"
- No se modifica `computeDimensionResults` ni hooks de datos
- No se aplica a otras páginas

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/ReportDetailPage.tsx` | Tipo `dimSortField`, comparador en `sortedDimensionResults`, headers clickeables SKUs/Poblados |
| `src/pages/NewReportPage.tsx` | Mismos cambios espejo |

## Verificación tras implementar

- Click en SKUs ordena asc/desc/reset correctamente
- Click en Poblados ordena asc/desc/reset correctamente
- "Sin valor asignado" permanece al final en los 4 criterios
- Orden por completitud sigue usando `rawCompleteness` (sin regresión)

