Diagnóstico

El problema ya no está en el timeout de 30s en sí. La causa raíz actual es más estructural:

1. La app considera “autenticado” solo cuando `user` existe (`isAuthenticated: !!user` en `AuthContext`).
2. Pero `user` no sale de la sesión persistida del navegador; sale de 2 queries adicionales a base de datos (`profiles` y `user_roles`) dentro de `onAuthStateChange`.
3. Mientras esas queries terminan, existe una sesión válida, pero `user` sigue en `null`.
4. En ese hueco:
  - `AppRoutes` ve `isLoading = false` + `isAuthenticated = false`
  - redirige a `/login`
  - luego el perfil termina de cargar
  - `user` aparece
  - la app vuelve a entrar

Eso explica exactamente el síntoma: loader gris → login → app.

Evidencia del código

- `src/contexts/AuthContext.tsx`
  - `isAuthenticated` depende de `!!user`, no de la sesión.
  - `onAuthStateChange` hace trabajo async pesado (`loadAppUser`) antes de consolidar el estado final.
  - `loadAppUser` hace 2 lecturas secuenciales: `profiles` y luego `user_roles`.
- `src/App.tsx`
  - el router decide entre app y login solo con `isLoading` + `isAuthenticated`.
- `src/components/AppLayout.tsx`
  - además vuelve a redirigir a login si `!isAuthenticated`.

Por qué el refresh se siente largo

No se está restaurando la app desde la sesión local de forma inmediata. Se está esperando a completar hidratación de perfil/rol para considerar al usuario “dentro”. Además:

- `loadAppUser` hoy es secuencial
- se ejecuta dentro del callback de auth
- el timeout de refresco de perfil es de 15s, demasiado alto para el camino crítico de recarga

Lo que propongo

1. Separar “sesión lista” de “perfil listo”
  - `AuthContext` debe manejar al menos dos estados distintos:
    - auth restaurada desde storage (`isAuthReady`)
    - perfil de app cargado (`user`)
  - La sesión (`session` / `supabaseUser`) debe ser la fuente para saber si el usuario está autenticado.
  - El perfil debe quedar como capa adicional para nombre, rol y permisos.
2. No bloquear `onAuthStateChange` con carga de perfil
  - En `onAuthStateChange`, hacer solo:
    - `setSession`
    - `setSupabaseUser`
    - marcar auth como lista
  - Mover la carga de perfil a un `useEffect` separado que observe `supabaseUser?.id`.
  - Así se evita el hueco de redirección y también la fragilidad de esperar lógica async dentro del callback de auth.
3. Cambiar el criterio de routing
  - `AppRoutes` no debe mandar a login cuando existe sesión pero el perfil aún está cargando.
  - Regla:
    - si `!isAuthReady` → spinner
    - si no hay sesión → login
    - si hay sesión pero el perfil sigue hidratando → spinner corto / shell loader
    - si hay sesión y perfil → app
  - `AppLayout` debe seguir la misma lógica y no hacer `Navigate` a login mientras exista sesión válida.
4. Reducir el tiempo de refresh percibido
  - Paralelizar `profiles` + `user_roles` con `Promise.all`.
  - Usar un timeout corto para la carga inicial de perfil (por ejemplo 4–6s), pero sin redirigir a login si hay sesión.
  - Si el perfil tarda más, mostrar loader de app o estado de recuperación, no login.

Implementación concreta

1. `src/contexts/AuthContext.tsx`
  - Introducir `isAuthReady` y opcionalmente `isProfileLoading`.
  - `isAuthenticated` debe basarse en `!!session` o `!!supabaseUser`, no en `!!user`.
  - `getSession()` al montar solo restaura sesión local y define el estado inicial.
  - `onAuthStateChange` actualiza sesión de forma síncrona.
  - Nuevo efecto separado para cargar `profile + role` cuando exista `supabaseUser`.
  - `loadAppUser` pasa a usar `Promise.all` para reducir latencia.
2. `src/App.tsx`
  - Ajustar `AppRoutes` para usar:
    - `isAuthReady`
    - `session` o `supabaseUser`
    - opcionalmente `isProfileLoading`
  - Evitar cualquier `<Navigate to="/login" />` mientras haya sesión activa pero perfil pendiente.
3. `src/components/AppLayout.tsx`
  - No redirigir a login si hay sesión activa y el perfil todavía no está disponible.
  - Mantener la validación de rol solo cuando `user` ya exista.

Resultado esperado

Flujo correcto tras el cambio:

- Con sesión activa: recarga → spinner corto → app
- Sin sesión: recarga → spinner muy breve → login
- Si el perfil tarda: recarga → spinner / shell loader → app
- Nunca: recarga → login → app

Mejora específica para que el refresh no sea tan largo

La mejora de mayor impacto no es bajar ciegamente un timeout, sino dejar de usar la carga de perfil como puerta de entrada a toda la app. Con eso:

- la autenticación se resuelve instantáneamente desde storage
- el login flash desaparece
- el tiempo percibido baja mucho
- el perfil/rol se hidrata en paralelo sin romper navegación

Archivos a tocar

- `src/contexts/AuthContext.tsx`
- `src/App.tsx`
- `src/components/AppLayout.tsx`

Alcance recomendado

No tocar hooks de negocio ni queries de datos. El fix debe ser exclusivamente de orquestación de sesión/hidratación, manteniendo intacta la lógica actual de perfiles, roles e inactividad.  
  
**Nota adicional:** En `AppLayout.tsx`, asegúrate de que la validación de rol (`user?.role !== "usuario_pro"`) solo se evalúe cuando `user` no sea null. Si `user` es null pero hay sesión activa, mostrar un spinner breve en vez de redirigir a home. Esto evita que un PIM Manager vea un flash del Dashboard mientras su perfil carga.