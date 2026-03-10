

## Plan: De versión de prueba a versión real

Actualmente toda la app funciona con datos mock en memoria (archivo `mockData.ts`) y autenticación simulada. Para pasar a una versión real se necesitan **3 bloques de trabajo**, que se pueden implementar de forma incremental:

---

### Bloque 1: Base de datos para los registros del PIM

Crear una tabla `pim_records` en Lovable Cloud que almacene los SKUs con sus atributos. El esquema usará una columna JSONB para los atributos (flexible ante los 100+ campos variables):

```text
pim_records
├── id (uuid, PK)
├── codigo_jaivana (text, unique, not null)
├── estado_global (text: 'Activo'/'Inactivo')
├── codigo_sumago (text, nullable)
├── visibilidad_b2b (text)
├── visibilidad_b2c (text)
├── categoria_n1_comercial (text)
├── clasificacion_producto (text)
├── attributes (jsonb) ← todos los atributos evaluables
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

Tablas adicionales: `predefined_reports`, `dimensions`, `profiles` (con referencia a auth.users para nombre, rol, estado).

Se usará una tabla separada `user_roles` siguiendo las directrices de seguridad para almacenar roles.

---

### Bloque 2: Carga masiva de CSV desde Administración

En la pestaña de Administración (solo UsuarioPRO), agregar una sección **"Actualizar base PIM"** con:

1. Un botón para subir un archivo CSV
2. Un Edge Function que reciba el CSV, lo parsee y haga un upsert masivo en `pim_records` (usando `codigo_jaivana` como clave)
3. Feedback visual de progreso y resultado (registros procesados, errores)

El CSV esperado tendrá como columnas: Código Jaivaná, Estado Global, Código SumaGo, Visibilidad B2B, Visibilidad B2C, Categoría N1, Clasificación, y todas las columnas de atributos.

---

### Bloque 3: Autenticación real y gestión de usuarios

Reemplazar la autenticación mock por la autenticación integrada de Lovable Cloud:

- Login real con correo y contraseña
- Tabla `profiles` para nombre y estado activo/inactivo
- Tabla `user_roles` para roles (`pim_manager`, `usuario_pro`)
- El UsuarioPRO crea usuarios desde Administración (invocando un Edge Function con service role)
- RLS en todas las tablas para proteger los datos

---

### Bloque 4: Conectar las vistas a datos reales

Reemplazar las importaciones de `mockData.ts` en cada vista por queries reales a la base de datos:

- **Dashboard**: query agregada sobre `pim_records` para KPIs
- **Informes predefinidos**: leer de tabla `predefined_reports`, computar completitud desde `pim_records`
- **Crear nuevo informe**: misma lógica pero sobre datos reales
- **Administración**: CRUD real sobre `profiles`, `predefined_reports`, `dimensions`

---

### Orden recomendado de implementación

1. **Primero**: Crear las tablas en la base de datos (esquema + RLS)
2. **Segundo**: Implementar autenticación real y gestión de usuarios
3. **Tercero**: Carga masiva de CSV con Edge Function
4. **Cuarto**: Conectar cada vista a los datos reales

Cada bloque se puede implementar y probar por separado. El primero que te recomiendo es crear las tablas en la base de datos. Dime si quieres que arranquemos con eso.

