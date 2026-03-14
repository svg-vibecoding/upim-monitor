

## Plan: Corregir cierre de sesión durante carga pesada

### Problema

En `onAuthStateChange`, cuando ocurre un `TOKEN_REFRESHED`, el código recarga el perfil con timeout de 8s. Si la DB está ocupada (carga PIM), el timeout falla y `setUser(null)` expulsa al usuario.

### Solución

**`src/contexts/AuthContext.tsx`** — Dos cambios:

1. **No borrar el usuario existente si falla la recarga de perfil durante TOKEN_REFRESHED.** Si ya hay un `user` en estado (`prev !== null`), mantenerlo. Solo hacer signOut si es un evento `SIGNED_IN` inicial y el perfil no carga (usuario inactivo real).

2. **Aumentar el timeout a 15 segundos** para la recarga de perfil en `onAuthStateChange` (no el login, que puede quedarse en 8s).

Cambio específico en el `catch` y en el bloque `if (!appUser)`:

```typescript
// Líneas 100-112 actuales:
if (appUser) {
  setUser(...);
} else {
  setUser(null);          // ← Problema: borra usuario existente
  await supabase.auth.signOut();
}

// Nuevo comportamiento:
if (appUser) {
  setUser(...);
} else if (event === "SIGNED_IN") {
  // Solo cerrar sesión si es un login nuevo fallido (cuenta inactiva)
  setUser(null);
  await supabase.auth.signOut();
}
// Si es TOKEN_REFRESHED y falla, mantener el user actual

// En el catch (timeout):
} catch {
  console.warn("[Auth] session profile load timed out");
  // NO hacer setUser(null) — mantener sesión existente
}
```

### Archivo afectado

| Archivo | Cambio |
|---------|--------|
| `src/contexts/AuthContext.tsx` | Preservar sesión existente en TOKEN_REFRESHED + timeout; aumentar timeout de recarga a 15s |

