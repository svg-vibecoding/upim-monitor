

# Plan Final: Reemplazo Completo Base PIM V1

## Aclaraciones sobre los 2 puntos

### 1. `verify_jwt = false` en config.toml

Esto es correcto y consistente con todas las Edge Functions del proyecto (`create-user`, `update-user`, `toggle-user-active`). La configuración `verify_jwt = false` no significa "sin protección" — significa que la validación del JWT se hace **en el código** de la función usando `getClaims()` + `has_role('usuario_pro')`, que es el patrón estándar del proyecto. La protección real queda en el código de la función, no en la configuración.

### 2. Regla operativa explícita: una sola carga pendiente

**Regla**: cuando se sube un nuevo archivo, cualquier carga pendiente anterior se descarta automáticamente. La Edge Function `upload-pim-csv` se encarga de esto: en `isFirstChunk`, marca todos los registros con `status = 'pending'` como `discarded` antes de registrar la nueva carga. El usuario no necesita descartar manualmente.

---

## Implementación (5 pasos)

### Paso 1: Migración DB
- Crear tabla `pim_records_staging` (misma estructura que `pim_records`).
- Agregar columnas `status` (text, default `'pending'`) y `attribute_order` (text[]) a `pim_upload_history`.
- Migrar datos existentes: `is_active = true` → `status = 'active'`, resto → `'discarded'`.
- Eliminar columna `is_active` y el trigger/función `set_single_active_upload`.
- Crear función PL/pgSQL `activate_pim_version(p_upload_id)` que en una transacción: valida atributos obligatorios, DELETE + INSERT atómico, actualiza metadata e historial, limpia staging.
- RLS en staging: SELECT para authenticated, escritura solo vía service role.
- Agregar políticas UPDATE en `pim_upload_history` para que el service role pueda cambiar status.

### Paso 2: Modificar Edge Function `upload-pim-csv`
- Escribir a `pim_records_staging` en vez de `pim_records`.
- En `isFirstChunk`: DELETE staging + marcar pendientes previas como `discarded`.
- Registrar en `pim_upload_history` con `status: 'pending'` y `attribute_order` desde la función (no desde frontend).
- Retornar `upload_id` y `attribute_order` en respuesta.
- NO actualizar `pim_metadata`.

### Paso 3: Nueva Edge Function `activate-pim-version`
- `verify_jwt = false` en config.toml (validación en código).
- Validar JWT con `getClaims()` + verificar `has_role(caller, 'usuario_pro')`.
- Recibir `{ upload_id }`, llamar `supabase.rpc('activate_pim_version', { p_upload_id })`.
- Retornar éxito o error de validación.

### Paso 4: Actualizar `AdminPage.tsx`
- Guardar `uploadId` en estado local tras carga.
- Validación visual: verificar que `attribute_order` contenga los 4 nombres canónicos obligatorios + filas > 0.
- "Actualizar datos de la app" → invocar `activate-pim-version` con `upload_id`.
- "Descartar" → marcar como `discarded` + limpiar panel.
- Historial: badges Activa (verde), Pendiente (amarillo), Descartada (gris) usando `status`.
- Registrar historial ya no se hace desde frontend (lo hace la Edge Function).

### Paso 5: Actualizar `usePimData.ts`
- Query de historial: usar `status` en vez de `is_active`.

