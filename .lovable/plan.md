

## Ajuste: texto descriptivo para "Informe predefinido"

El texto de Excel dice: *"El archivo debe tener una columna con Código Jaivaná. Se aceptan archivos .xlsx y .xls."* — es instruccional y orienta al usuario sobre qué esperar.

Para "Informe predefinido", propongo un texto equivalente en tono y función:

> **"Utiliza el universo de productos definido en un informe existente como base para el análisis."**

Es coherente porque:
- Explica qué hace la opción (usa un universo ya definido)
- Aclara que es una base, no una restricción
- Mismo tono neutro e instruccional

### Cambio técnico

**Archivo:** `src/pages/NewReportPage.tsx`

Dentro del bloque condicional `{source === "report" && (...)}`, agregar un `<p>` con clase `text-xs text-muted-foreground` antes del `Select`, igual que el texto del bloque de Excel.

