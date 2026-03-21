

## Plan: Ajustar encabezado del Card 3 según modo

### Cambio único en `src/pages/DashboardPage.tsx`

**Líneas 415-418** — Reemplazar el encabezado estático `{card3Cfg.label}` por lógica condicional:

- **Modo dinámico**: Mostrar `"MOSTRANDO: {completenessReportName}"` (nombre del informe activo en Focos de atención)
- **Modo estático**: Mostrar `{card3Cfg.label}` (el label guardado en `dashboard_cards_config`, default "Completitud Promedio")

Además, **línea 126** — cambiar el default del label de `"Completitud General"` a `"Completitud Promedio"`.

**Línea 427** — En modo dinámico, la línea "Mostrando: {nombre}" ya queda redundante con el encabezado. Ocultarla en modo dinámico para no duplicar información.

### Archivos
- `src/pages/DashboardPage.tsx` (3 ediciones puntuales)

