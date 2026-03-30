

## Diagnóstico

En `computeAttributeResults` (usePimData.ts línea 602), el valor `completeness` se guarda ya redondeado con `Math.round()`:

```ts
completeness: total > 0 ? Math.round((populated / total) * 100) : 0
```

Cuando dos atributos tienen, por ejemplo, 0.8% y 1.4%, ambos se redondean a 1% y el sort en `ReportDetailPage.tsx` / `NewReportPage.tsx` compara `1 - 1 = 0`, dejando el orden arbitrario.

## Solución

Guardar la precisión real en un campo adicional y usar ese campo para ordenar, sin cambiar lo que se muestra en la UI.

### 1. Agregar `rawCompleteness` al tipo `AttributeResult`

En `src/data/mockData.ts` (donde se define la interfaz) y en `src/hooks/usePimData.ts`:

```ts
export interface AttributeResult {
  name: string;
  totalSKUs: number;
  populated: number;
  completeness: number;      // redondeado, para display
  rawCompleteness: number;   // precisión real, para sort
}
```

### 2. Calcular `rawCompleteness` en `computeAttributeResults`

En `src/hooks/usePimData.ts` línea 602 y en `src/data/mockData.ts` (la función equivalente):

```ts
const raw = total > 0 ? (populated / total) * 100 : 0;
return {
  name: attr, totalSKUs: total, populated,
  completeness: Math.round(raw),
  rawCompleteness: raw,
};
```

### 3. Usar `rawCompleteness` en el sort

En `ReportDetailPage.tsx` (línea ~91) y `NewReportPage.tsx` (línea ~194), cambiar:

```ts
// Antes
cmp = a.completeness - b.completeness;

// Después
cmp = a.rawCompleteness - b.rawCompleteness;
```

Hacer lo mismo en `computeDimensionResults` y en los sorts de dimensión si aplica.

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/data/mockData.ts` | Agregar `rawCompleteness` a la interfaz y a la función `computeAttributeResults` |
| `src/hooks/usePimData.ts` | Agregar `rawCompleteness` a `computeAttributeResults` y `computeDimensionResults` |
| `src/pages/ReportDetailPage.tsx` | Usar `rawCompleteness` en los sorts de atributos y dimensiones |
| `src/pages/NewReportPage.tsx` | Usar `rawCompleteness` en los sorts de atributos y dimensiones |

No se modifica la UI mostrada — `completeness` (redondeado) sigue siendo el valor que se renderiza en `CompletenessBar` y en las tablas.

