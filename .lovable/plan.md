

## Plan: Scroll interno en Focos de atención

**Cambio en `src/pages/DashboardPage.tsx`**:

El card de "Informes Predefinidos" tiene 4 items con `py-3` cada uno más padding del card — aproximadamente 240px de altura. El objetivo es que el card de Focos tenga la misma altura, con scroll interno solo en la lista de atributos.

1. **Fijar altura del card de Focos** para igualar al de Informes Predefinidos usando `h-full` en ambos cards y `flex flex-col` en el contenido del card de Focos.
2. **Hacer que la lista use `ScrollArea` con `flex-1 overflow-hidden`** en lugar de `max-h-[220px]`, para que el scroll ocupe exactamente el espacio disponible dentro del card.
3. Ambas columnas del grid usarán `flex flex-col` para que las alturas se alineen naturalmente vía el grid.

**Resultado**: Los tabs del informe quedan fijos arriba dentro del card, y la lista de atributos hace scroll internamente. Ambos cards quedan a la misma altura.

