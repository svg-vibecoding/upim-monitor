

## Plan: Ajuste a Paso 1 y Paso 2 de Nuevo Informe

### 1. Experiencia final del Paso 1 — "Seleccionar universo"

- Titulo cambia de "1. Seleccionar fuente" a **"1. Seleccionar universo"**.
- Debajo del titulo, texto secundario: *"Selecciona el universo de productos sobre el cual se construirá el informe."*
- El `RadioGroup` actual pasa de 2 a 3 opciones:
  - **Base general del PIM** (igual que hoy)
  - **Cargar archivo Excel** (igual que hoy, con su zona de upload condicional)
  - **Informe predefinido** (nueva opcion)
- Al seleccionar "Informe predefinido", aparece un `Select` dropdown debajo (igual que aparece la zona de upload para "archivo Excel") con los informes predefinidos disponibles (PIM General, SumaGO B2B, etc.). El usuario escoge uno y el universo de ese informe se usa para filtrar los registros via `getRecordsForReport`.
- Sin bloques nuevos, sin cards extra. Solo un radio mas y un select condicional.

### 2. Experiencia final del Paso 2 — "Seleccionar atributos"

- Se agrega, entre el titulo y el buscador, un `Select` compacto con label inline: **"Cargar plantilla de:"** + dropdown con "Ninguna" y los informes predefinidos.
- Al seleccionar un informe, se hace `setSelectedAttrs(report.attributes)` — reemplaza la seleccion actual con los atributos del informe.
- Despues el usuario puede agregar/quitar atributos libremente.
- Este select es completamente independiente del paso 1. No hay dependencia automatica.

### 3. Decision de UI para mantener la interfaz liviana

- Ambos ajustes reutilizan componentes existentes: `RadioGroupItem` y `Select`.
- No se agregan cards, dialogs ni pasos nuevos.
- Los selects condicionales solo aparecen cuando se activa la opcion correspondiente (paso 1) o siempre visible pero discreto (paso 2).
- Misma densidad visual que la actual.

### 4. Sin dependencia automatica entre pasos

- La seleccion de universo en paso 1 no afecta el paso 2 en absoluto.
- La seleccion de plantilla en paso 2 no afecta el paso 1.
- Son decisiones independientes que el usuario toma por separado.

### Cambios tecnicos

**Archivo:** `src/pages/NewReportPage.tsx`

- Importar `usePredefinedReports`, `sortReportsByDisplayOrder`, `getRecordsForReport`.
- Ampliar el tipo de `source` a `"general" | "file" | "report"`.
- Nuevo estado `selectedReportId` para el informe predefinido elegido en paso 1.
- En el `records` memo: si `source === "report"` y hay un informe seleccionado, filtrar via `getRecordsForReport`.
- Paso 1: renombrar, agregar descripcion, agregar tercer radio + select condicional.
- Paso 2: agregar select de plantilla antes del buscador.
- Reset: limpiar `selectedReportId`.

