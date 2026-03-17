

## Análisis de causa raíz

**El problema**: Cada chunk envía 2.000 registros JSON al Edge Function. Con ~100+ columnas por registro, el payload de un chunk puede superar los **5-10 MB**. El Edge Function tiene un límite de ejecución de ~60 segundos y un límite de tamaño de request body. El error "connection closed before message completed" indica que la conexión HTTP se cierra por timeout antes de que la función termine de procesar y responder.

**Flujo actual**:
1. Cliente: lee Excel completo (~77.700 filas), divide en chunks de 2.000
2. Edge Function: recibe chunk de 2.000 filas → parsea headers → deduplica → hace upsert en sub-batches de 500

**Problema específico**: Un chunk de 2.000 filas con muchas columnas genera un JSON muy pesado. El upsert de 4 sub-batches de 500 registros con JSONB `attributes` grandes puede exceder el timeout del Edge Function (~60s). Además, el JSON body parsing de un payload tan grande consume tiempo significativo.

**¿Por qué antes funcionaba?** Probablemente el archivo tenía menos columnas o menos datos en el campo `attributes`. A medida que crece el catálogo, el payload crece proporcionalmente.

## Plan de corrección (menor riesgo)

### Cambio único en `src/pages/AdminPage.tsx`

Reducir `CHUNK_SIZE` de **2.000 a 500** registros por chunk.

```typescript
// Línea 496
const CHUNK_SIZE = 500;
```

**Justificación**:
- Reduce el payload ~4x, manteniéndolo dentro de los límites de timeout
- La función ya hace upserts internos de 500, así que con chunks de 500 solo hay 1 upsert por invocación — procesamiento más rápido y predecible
- Aumenta el número de chunks de ~39 a ~156, pero cada uno se procesa en segundos
- Cero cambios en la Edge Function ni en lógica de DB
- Es el cambio más conservador y reversible

### Sin cambios adicionales necesarios

La Edge Function ya tiene `BATCH_SIZE = 500` internamente (línea 170). Reducir el chunk del cliente a 500 alinea ambos valores, eliminando el loop interno y simplificando el flujo.

