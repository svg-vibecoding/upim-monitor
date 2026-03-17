

## Diagnóstico

El error "Failed to fetch" ocurre porque la llamada `fetch` al endpoint de la función backend **no incluye los headers de autenticación necesarios** (`Authorization` y `apikey`). Sin estos headers, la solicitud es rechazada por la infraestructura antes de llegar a la función, y el navegador reporta un error de red genérico.

**Evidencia**: Los logs de la función solo muestran "shutdown" — nunca recibió la solicitud. El código en `AdminPage.tsx` línea 538-542 solo envía `Content-Type`.

## Plan de corrección

### Archivo: `src/pages/AdminPage.tsx` (líneas 538-542)

Agregar los headers `Authorization` y `apikey` a la llamada `fetch`, usando la sesión activa del usuario y la clave pública:

```typescript
const { data: { session } } = await supabase.auth.getSession();

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${session?.access_token}`,
    "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  },
  body: JSON.stringify({ rows: chunk, isFirstChunk: i === 0, fileName: file.name }),
});
```

La obtención de sesión se hace **una sola vez** antes del loop de chunks, no dentro del loop.

Cambio mínimo: solo se agregan 2 headers y 1 línea para obtener la sesión. No se toca ninguna otra lógica.

