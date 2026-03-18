

## Diagnóstico

**Causa raíz: desajuste en la cache key de React Query.**

El flujo actual:

1. `saveDimension` llama `refreshOne("dimension_values", dimId)` — esto ejecuta correctamente el RPC en la base de datos.
2. `refreshOne` luego invalida la query key: `["computed-result", "dimension_values", dimId]` (línea 164).
3. **Pero** `useDimensionValues()` usa la query key `["computed-result", "dimension_values"]` (línea 109) — sin el tercer segmento del ID.

Por lo tanto, la invalidación nunca coincide con la query que realmente alimenta la UI. Los datos se recalculan en la BD pero la UI no se entera porque su cache no se refresca.

Cuando el usuario hace "Recalcular datos" funciona porque `refreshAll` invalida `["computed-result"]` (sin más segmentos), lo cual sí matchea por prefijo con `["computed-result", "dimension_values"]`.

## Plan de corrección

**Un solo cambio en `saveDimension` de `AdminPage.tsx`:**

Después de llamar `refreshOne(...)`, agregar una invalidación explícita de la query key que usa `useDimensionValues`:

```typescript
queryClient.invalidateQueries({ queryKey: ["computed-result", "dimension_values"] });
```

Esto se añade tanto en el bloque de crear como en el de editar, justo después de la llamada a `refreshOne`. Sin tocar ninguna otra lógica.

