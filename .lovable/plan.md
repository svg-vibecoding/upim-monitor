

## Cambio

Agregar texto descriptivo del universo para la opción "Base general del PIM", igual que ya existe para informes predefinidos.

### Detalle

En `src/pages/NewReportPage.tsx`, después del `RadioGroup` (línea 187) y antes del bloque `source === "file"`, agregar un bloque condicional:

```tsx
{source === "general" && (
  <p className="text-xs text-muted-foreground">SKUs totales (activos e inactivos)</p>
)}
```

Esto sigue el mismo patrón visual que la línea 247 donde se muestra `selectedReport.universe` para informes predefinidos.

Un solo archivo modificado, una sola línea agregada.

