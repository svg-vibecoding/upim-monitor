

## Diagnóstico

`ReportDetailPage` obtiene los datos de completitud desde `computed_results` en la base de datos (tabla precomputada). Esos registros JSON se guardaron **antes** de agregar `rawCompleteness`, por lo que el campo no existe en los datos cacheados. El sort hace fallback a `completeness` (redondeado) y el orden entre Imagen 4 (310 poblados, 1.15%) e Imagen 5 (143 poblados, 0.53%) queda arbitrario porque ambos muestran `1`.

## Solución: dos partes

### 1. Derivar `rawCompleteness` al leer los datos (client-side)

En `useReportCompleteness` (usePimData.ts, ~línea 229-263), después de obtener el array de `AttributeCompleteness[]` (ya sea de cache o live), recalcular `rawCompleteness` para cada item si no viene en el JSON:

```ts
function enrichRawCompleteness(items: AttributeCompleteness[]): AttributeCompleteness[] {
  return items.map(item => ({
    ...item,
    rawCompleteness: item.rawCompleteness ?? 
      (item.totalSKUs > 0 ? (item.populated / item.totalSKUs) * 100 : 0),
  }));
}
```

Aplicar esta función tanto al retorno de `cached.data.result` como al de `live.data`.

### 2. Refrescar los datos precomputados (opcional, una sola vez)

Ejecutar manualmente "Actualizar datos de la app" desde Admin regenerará los `computed_results` con el nuevo `rawCompleteness`. Pero el fix del punto 1 hace que funcione inmediatamente sin necesidad de refrescar.

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/hooks/usePimData.ts` | Agregar `enrichRawCompleteness` y aplicarla en los dos returns de `useReportCompleteness` |

No se modifica ningún otro archivo. El sort en `ReportDetailPage.tsx` ya usa `rawCompleteness ?? completeness`, así que con el enriquecimiento funcionará correctamente.

