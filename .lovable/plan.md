

## Diagnóstico

En `DashboardPage.tsx` línea 184, el sort de focos de atención usa el valor redondeado:

```ts
.sort((a, b) => a.completeness - b.completeness);
```

Esto tiene el mismo problema que tenían las tablas de informes: atributos con el mismo porcentaje mostrado quedan en orden arbitrario.

## Solución

Cambiar la línea 184 para usar `rawCompleteness` con fallback:

```ts
.sort((a, b) => (a.rawCompleteness ?? a.completeness) - (b.rawCompleteness ?? b.completeness));
```

### Archivo a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/DashboardPage.tsx` | Línea 184: usar `rawCompleteness ?? completeness` en el sort de `focusItems` |

No se modifica ningún otro archivo. Los datos ya vienen enriquecidos con `rawCompleteness` desde `useReportCompleteness` gracias al fix anterior.

