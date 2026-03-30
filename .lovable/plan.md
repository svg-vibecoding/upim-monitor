

## Diagnóstico: Bug de reordenamiento en primer/último informe

### Causa raíz

En `handleMoveReport` (AdminPage.tsx, línea 123-125), el swap usa los valores de `displayOrder` de cada informe:

```ts
const updates = [
  { id: sorted[idx].id, display_order: sorted[swapIdx].displayOrder },
  { id: sorted[swapIdx].id, display_order: sorted[idx].displayOrder },
];
```

Si varios informes tienen `display_order = null` en la base de datos, todos reciben `displayOrder: 99` (el fallback en `usePimData.ts` línea 539). Al hacer swap entre dos informes con el mismo valor 99, se escribe `display_order: 99` a ambos — **nada cambia realmente**.

Esto afecta especialmente al primer y último informe cuando comparten `displayOrder` con su vecino.

### Solución

Cambiar `handleMoveReport` para usar el **índice del array** como orden efectivo en lugar de los valores `displayOrder`:

```ts
const handleMoveReport = useCallback((reportId: string, direction: "up" | "down") => {
  const sorted = sortReportsByDisplayOrder(dbReports);
  const idx = sorted.findIndex((r) => r.id === reportId);
  if (idx < 0) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sorted.length) return;
  const updates = [
    { id: sorted[idx].id, display_order: swapIdx },      // ← índice, no displayOrder
    { id: sorted[swapIdx].id, display_order: idx },       // ← índice, no displayOrder
  ];
  reorderReports.mutate(updates);
}, [dbReports, reorderReports]);
```

Así, aunque todos los informes empiecen con `displayOrder: 99`, al mover el primero hacia abajo se asignan valores distintos (0 y 1), y el cambio persiste correctamente.

### Archivo a modificar

- `src/pages/AdminPage.tsx` — solo las líneas 123-126 (el array `updates` dentro de `handleMoveReport`)

