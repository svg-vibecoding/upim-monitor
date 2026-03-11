

## Plan: Filtro semáforo en la tabla de atributos del detalle de informe

### Qué se hará
Agregar los mismos botones de filtro por severidad (semáforo) que existen en "Focos de atención" a la sección "Detalle por atributo" en `ReportDetailPage.tsx`. Los botones irán alineados a la derecha del título "Detalle por atributo".

### Cambios en `src/pages/ReportDetailPage.tsx`

1. **Copiar las funciones de severidad** (`getSeverity`, `severityLabel`, `severityDot`) desde `DashboardPage.tsx` (o extraerlas a un helper compartido — por simplicidad, se copian inline).

2. **Agregar estado** `severityFilter` con `useState<SeverityLevel | null>(null)`.

3. **Modificar la cabecera** de la card "Detalle por atributo" (línea 87): convertirla en un `flex justify-between` con el título a la izquierda y los botones semáforo a la derecha, usando el mismo patrón visual del dashboard (dots + counts + Filter icon).

4. **Filtrar `attrResults`** antes de renderizar la tabla, según el nivel de severidad seleccionado.

### Resultado visual
```text
┌─────────────────────────────────────────────────┐
│ Detalle por atributo          🔽 ● ● ● ●       │
│─────────────────────────────────────────────────│
│ Atributo   SKUs   Poblados   Completitud        │
│ ...        ...    ...        ████░░░░           │
└─────────────────────────────────────────────────┘
```

