
Objetivo: destrabar el login (spinner “Ingresando…” infinito) sin tocar el resto de flujos.

Diagnóstico ya confirmado
- En `src/contexts/AuthContext.tsx` (función `login`), hay un bloqueo lógico:
  - Se crea un `setInterval` que, si `isLoading` ya es `false` (caso normal al estar en `/login`), limpia el `timeout`.
  - Pero nunca hace `resolve(...)`.
  - Resultado: `await login(...)` en `LoginPage` no termina y el botón queda cargando para siempre.
- Esto explica exactamente lo que ves en sesión replay: el botón cambia a “Ingresando…” y no vuelve.
- Adicionalmente, si el backend está lento/no responde, hoy no hay timeout claro para el usuario (se mezcla con “cuenta inactiva”).

Plan de implementación
1) Corregir el flujo de `login` para que siempre resuelva
- Archivo: `src/contexts/AuthContext.tsx`
- Reemplazar la espera por `interval + timeout` por un flujo determinístico:
  - `signInWithPassword`
  - si falla: devolver error de credenciales
  - si éxito: cargar perfil/rol con un timeout controlado (Promise.race)
  - si perfil válido: `resolve({ success: true })`
  - si inactivo/sin perfil: cerrar sesión y devolver mensaje de cuenta inactiva
  - si timeout/red: devolver mensaje de problema de conexión
- Eliminar la lógica que limpia timers sin resolver.

2) Blindar la UI de login para que nunca se quede pegada por excepción
- Archivo: `src/pages/LoginPage.tsx`
- En `handleSubmit`, envolver en `try/catch/finally` y mover `setLoading(false)` al `finally`.
- Mantener el comportamiento actual de mensajes de error.

3) Evitar bloqueos de carga global en sesión existente
- Archivo: `src/contexts/AuthContext.tsx`
- En `onAuthStateChange`, envolver `loadAppUser` con timeout y asegurar `setIsLoading(false)` en `finally`.
- Así evitamos pantallas de carga eternas al abrir la app con sesión guardada y backend lento.

4) (Opcional recomendado) mejorar diagnóstico sin afectar UX
- Registrar en `console.warn` (solo dev) la causa: `invalid_credentials`, `inactive_user`, `profile_timeout`, `profile_query_error`.
- Esto acelera futuras depuraciones sin ensuciar UI.

Validación (E2E) después del fix
- Caso 1: credenciales correctas → entra al dashboard.
- Caso 2: credenciales incorrectas → muestra “Credenciales inválidas” y el botón vuelve a estado normal.
- Caso 3: cuenta inactiva → muestra “Cuenta inactiva…” y no queda sesión abierta.
- Caso 4: backend lento/no disponible → muestra error de conexión (no queda en “Ingresando…” infinito).

Impacto esperado
- Soluciona el bloqueo principal de ingreso que reportas.
- Mantiene intactos los cambios recientes de UI en informes.
