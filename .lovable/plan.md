

## Diagnóstico de los 3 bugs en el reporte de control de carga PIM

---

### Bug 1 — "Atributos protegidos: 0 de 18" siempre muestra 0

**Causa raíz: closure de React state.**

En `handleCsvUpload`, línea 633 llama `setPendingAttributeOrder(firstResult.attributeOrder)` pero línea 690 lee `pendingAttributeOrder` del mismo ciclo de render — que sigue siendo `[]` porque `setState` es asíncrono. Resultado: `csvResult.attributeOrder` siempre es `undefined`.

Sin `attributeOrder`, el `uploadedSet` (línea 811-814) solo contiene `columnsDetected.fixed`, que son nombres de columna DB (`estado_global`, `visibilidad_b2b`...). Los atributos protegidos usan nombres display (`Estado (Global)`, `Visibilidad Adobe B2B`...). Nunca coinciden → 0 matches.

**Corrección**: En línea 690, usar directamente `firstResult.attributeOrder` guardado en una variable local (no el state), o guardar el attributeOrder en una `ref`/variable local al scope de la función:

```typescript
// Guardar en variable local cuando se recibe del primer chunk:
let localAttributeOrder: string[] = [];
// ... en el bloque del primer chunk:
localAttributeOrder = firstResult.attributeOrder || [];
// ... al construir csvResult:
const attrOrder = localAttributeOrder.length > 0 ? localAttributeOrder : undefined;
```

---

### Bug 2 — UUID aparece como atributo protegido faltante

**Causa raíz**: `getOperationAttributes` (línea 312-324 de `usePimData.ts`) itera las condiciones de operaciones activas, pero solo filtra por `source === "attribute"`. Cuando una condición tiene `sourceType === "operation"`, el campo `c.attribute` contiene el UUID de la operación referenciada — y ese UUID se ignora correctamente por el filtro `source === "attribute"`.

Sin embargo, el problema es que **no resuelve recursivamente** los atributos de la operación referenciada. Cuando una operación A referencia otra operación B como condición, los atributos de B no se agregan al conjunto. Esto significa que `getProtectedAttributes` no ve esos atributos como protegidos.

Pero espera — el UUID sí aparece en la lista de faltantes, lo que indica que SÍ se está agregando como atributo. Revisando `getProtectedAttributes` (líneas 385-396): itera directamente `op.conditions` y agrega `c.attribute` cuando `source === "attribute"`. Pero si hay una condición con `sourceType === "operation"`, el `sourceType` podría ser undefined (fallback a `"attribute"` en línea 389), y `c.attribute` contiene el UUID de la operación.

**El bug está en la línea 389**: `const source = c.sourceType || "attribute"` — si `sourceType` no se guardó correctamente en la DB (es undefined/null), el fallback hace que se trate como `"attribute"` y se agrega el UUID como si fuera un nombre de atributo.

**Corrección en `getOperationAttributes`**: 
1. Filtrar condiciones donde `sourceType === "operation"` para no agregar sus UUIDs
2. Resolver recursivamente: cuando `sourceType === "operation"`, buscar la operación por ID y recoger sus atributos reales
3. Usar un Set `visited` para evitar ciclos

```typescript
function getOperationAttributes(operations: Operation[]): Set<string> {
  const attrs = new Set<string>();
  const visited = new Set<string>();
  const opMap = new Map(operations.map(op => [op.id, op]));
  
  function collect(opId: string) {
    if (visited.has(opId)) return;
    visited.add(opId);
    const op = opMap.get(opId);
    if (!op || !op.active) return;
    for (const c of op.conditions) {
      if ((c.sourceType || "attribute") === "attribute" && c.attribute) {
        attrs.add(c.attribute);
      } else if (c.sourceType === "operation" && c.attribute) {
        collect(c.attribute); // c.attribute es el ID de la operación referenciada
      }
    }
  }
  
  for (const op of operations) {
    if (op.active) collect(op.id);
  }
  return attrs;
}
```

Aplicar la misma lógica recursiva en `getProtectedAttributes` para que el `reason` refleje la cadena de operaciones.

---

### Bug 3 — Lógica universe_key → atributo redundante

**Estado actual**: En `getProtectedAttributes` ya fue eliminada (comentario en línea 381-382). Sin embargo, **`getAttributeClassification`** (líneas 339-344) todavía contiene la lógica que clasifica atributos como "funcional" si un informe los usa vía `universe_key`. Esta lógica es redundante porque los universos de informes ahora se definen por operaciones, cuyos atributos ya se capturan.

**Corrección**: Eliminar el bloque de líneas 339-345 en `getAttributeClassification` que verifica `UNIVERSE_KEY_ATTRIBUTE_MAP`.

---

### Resumen de archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/AdminPage.tsx` | Bug 1: usar variable local en vez de state para `attributeOrder` |
| `src/hooks/usePimData.ts` | Bug 2: resolver operaciones recursivamente en `getOperationAttributes` y `getProtectedAttributes` con protección anti-ciclos |
| `src/hooks/usePimData.ts` | Bug 3: eliminar bloque universe_key en `getAttributeClassification` (líneas 339-345) |

