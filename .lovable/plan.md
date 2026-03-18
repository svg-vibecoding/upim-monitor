

## Plan de corrección — Carga PIM (3 cambios)

### Corrección 1: TRUNCATE vía RPC en vez de DELETE masivo

**Migración SQL** — crear función `truncate_pim_staging()`:
```sql
CREATE OR REPLACE FUNCTION public.truncate_pim_staging()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN TRUNCATE pim_records_staging; END; $$;
```

**Edge Function** `supabase/functions/upload-pim-csv/index.ts` (línea ~136 del bloque `isFirstChunk`):
- Reemplazar `await supabase.from("pim_records_staging").delete().neq("codigo_jaivana", "")` por `await supabase.rpc("truncate_pim_staging")`

### Corrección 2: Verificación HTTP antes de parsear JSON

**`src/pages/AdminPage.tsx`** (~líneas 551-561): después del `fetch`, agregar guard `if (!res.ok)` que captura el texto del error, lo registra en `allErrorDetails`, y hace `continue`.

### Corrección 3: AbortController con timeout de 55s por chunk

**`src/pages/AdminPage.tsx`** (~líneas 547-580): envolver el `fetch` en un `AbortController` con `setTimeout` de 55s. En el `catch`, distinguir `AbortError` (timeout) de otros errores, registrar en `allErrorDetails`, y hacer `continue`.

### Archivos modificados
1. Nueva migración SQL (1 función)
2. `supabase/functions/upload-pim-csv/index.ts` (1 línea)
3. `src/pages/AdminPage.tsx` (refactor del loop de chunks, ~20 líneas)

