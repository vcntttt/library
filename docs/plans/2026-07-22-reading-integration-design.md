# Integración de Library con KOReader

Actualizado: 2026-08-08

## Objetivo

Convertir la lectura en KOReader en un flujo cotidiano dentro de Library:

1. importar automáticamente documentos, progreso y highlights;
2. reflejar el progreso fiable en la Obra vinculada;
3. curar highlights sin modificar su fuente original;
4. pedir una reseña cuando una Obra se termina.

Esta especificación cubre LIB-7 y sus cortes funcionales LIB-2, LIB-6 y LIB-4.

## Resultado esperado

Después de leer en KOReader, el propietario abre Library y encuentra:

- el progreso actualizado de la Obra vinculada;
- los highlights nuevos en una bandeja;
- contexto del EPUB para corregir selecciones incompletas o excesivas;
- una versión curada editable separada del dato original;
- una reseña pendiente si KOReader marcó la Obra como terminada.

El flujo funciona sin escribir archivos de KOReader y sin perder datos cuando una
fuente desaparece o un sidecar falla.

## Límites y fuentes de verdad

- La integración pertenece únicamente al usuario configurado mediante
  `READING_INTEGRATION_OWNER_ID`.
- La fuente inicial es `READING_BOOKS_PATH`, una carpeta `Books` sincronizada por
  Syncthing y montada en el servidor.
- Se soportan los sidecars nativos `metadata.<ext>.lua` de KOReader.
- KOReader es la fuente de verdad del progreso, estado de lectura y highlight
  original.
- Library es la fuente de verdad del vínculo con la Obra, la versión curada del
  highlight, los comentarios y el estado de reseña pendiente.
- Los datos de otros usuarios permanecen aislados y no se les muestran controles
  de esta integración.

## Arquitectura objetivo

```text
Books + sidecars KOReader, sincronizados por Syncthing
                    ↓
Job programado en el host/Dokploy cada 5 minutos
                    ↓
Endpoint interno autenticado con secreto
                    ↓
Scanner incremental y tolerante a fallos por archivo
                    ↓
Documentos, fuentes, progreso y highlights originales en Convex
                    ↓
Vínculo confirmado con una Obra
              ↙                 ↘
   Progreso de lectura     Bandeja de highlights
              ↓                    ↓
Estado de la Obra          Versión curada + comentario
              ↓
Reseña pendiente al terminar
```

El botón **Sincronizar ahora** permanece como recuperación manual y devuelve el
mismo resumen que el job automático.

## Identidad y reconciliación

### Documentos y fuentes

- El contenido del ebook identifica el documento lógico mediante un hash.
- Una ruta observada es una fuente del documento, no su identidad definitiva.
- Mover o renombrar un archivo conserva el documento y su vínculo con la Obra.
- Dos copias idénticas se agrupan bajo el mismo documento y mantienen sus fuentes
  y progresos por separado.
- El vínculo automático solo se sugiere usando título, autor y metadatos. El
  propietario debe confirmarlo una vez.
- Un libro o fuente ausente se marca como tal; nunca se elimina automáticamente.

### Highlights

- La identidad preferida combina posiciones nativas y fecha de creación.
- El orden nativo de KOReader se conserva.
- El índice de la tabla Lua es únicamente el último fallback de identidad.
- Una coincidencia exacta se actualiza de forma idempotente.
- Textos parecidos se muestran como posibles duplicados y solo se fusionan con
  confirmación.
- Un highlight ausente se archiva como fuente ausente; su versión curada se
  conserva.

## Sincronización

### Disparadores

- Job externo cada cinco minutos.
- Acción manual desde Library.
- El runtime web no usa `setInterval`: el job debe sobrevivir reinicios y evitar
  ejecuciones duplicadas entre réplicas.

### Seguridad

- El flujo manual mantiene sesión autenticada y validación de propietario.
- El job usa un endpoint interno separado, autenticado mediante un secreto de
  servicio y limitado al propietario configurado.
- Ningún endpoint nuevo escribe datos de usuario sin comprobar su propietario.

### Lectura estable e incremental

- Antes de importar un sidecar, tamaño y fecha de modificación deben permanecer
  estables durante una ventana corta para evitar leer mientras Syncthing escribe.
- Se procesan solo archivos nuevos o modificados.
- Cada archivo se procesa de manera aislada.
- Un archivo corrupto conserva su última versión válida y no detiene los demás.
- El resultado informa documentos procesados, cambios aplicados, archivos
  omitidos y errores por ruta.
- Una ejecución repetida sin cambios no crea documentos ni highlights nuevos.

## Progreso y estado de la Obra

### Representación

- El porcentaje de KOReader es la medida canónica del progreso integrado.
- Los números de página calculados por KOReader son informativos porque dependen
  del layout del lector.
- Library no convierte el porcentaje a páginas editoriales aproximadas.
- Se conserva por fuente la posición actual, el máximo alcanzado, el locator y la
  fecha/revisión de origen.
- La interfaz principal muestra el máximo alcanzado; el detalle puede mostrar la
  posición actual y cada fuente.

### Proyección atómica

- Una mutation dedicada proyecta el progreso importado sobre la Obra vinculada.
- La mutation compara timestamp/revisión de origen y registra la procedencia.
- El progreso manual queda deshabilitado mientras la integración del documento
  esté activa; desvincularla devuelve el control manual.
- Un draft manual antiguo no puede sobrescribir un progreso importado más nuevo.

### Transiciones

- El primer progreso mayor que cero cambia la Obra a `in-progress` y asigna
  `startedAt` si falta.
- Solo el estado explícito `summary.status = "complete"` de KOReader cambia la
  Obra a `finished`.
- Llegar a 100 % sin ese estado explícito conserva `in-progress`.
- La finalización asigna `finishedAt` usando la fecha fiable de la fuente o, como
  fallback, la fecha de sincronización.
- Retroceder páginas actualiza la posición actual, pero no reduce el máximo ni
  reabre una Obra terminada.
- Una caída importante de progreso después de terminar crea una sugerencia de
  posible relectura. Reabrir la Obra requiere confirmación y queda fuera de una
  mutación automática.
- La sincronización no modifica reseña, etiquetas ni otros campos personales.

Cuando varias fuentes difieren, la fuente válida modificada más recientemente
gobierna la posición actual. El máximo global y el detalle de las demás fuentes
se conservan.

## Reseña de finalización

El estado de consumo y la tarea editorial son ejes separados:

- La Obra permanece `finished` y cuenta como terminada.
- Un ciclo separado de reseña usa `pending`, `completed` o `skipped`, con sus
  timestamps.
- Guardar una reseña no vacía marca el ciclo como `completed` y asigna
  `reviewedAt`.
- **Más tarde** mantiene `pending`.
- **No escribir reseña** cambia a `skipped`.
- `finishedAt` representa cuándo terminó la obra y nunca se reemplaza con la fecha
  de la reseña.

El pendiente se crea en todas las finalizaciones nuevas:

- finalización detectada por KOReader;
- cambio manual a `finished`;
- creación de una Obra ya terminada;
- finalización automática existente para otros tipos de Obra.

Una acción manual abre inmediatamente el diálogo de reseña. Una finalización en
segundo plano aparece de forma no bloqueante en Inicio y en el detalle de la
Obra. Las obras históricas sin reseña no se migran automáticamente; una acción
separada podrá incorporarlas después.

## Curación de highlights

Cada highlight distingue:

1. original inmutable importado desde KOReader;
2. texto curado editable en Library;
3. comentario personal editable;
4. contexto extraído, que es ayuda de edición y no reemplaza al original.

La copia curada se crea al conservar o editar el highlight. Una sincronización
posterior puede actualizar el original con una versión de fuente más nueva sin
sobrescribir la curación.

### Contexto EPUB

- El primer corte contextual soporta EPUB.
- El servidor abre el EPUB, resuelve manifest y spine, extrae el capítulo y busca
  una versión normalizada del texto del highlight.
- El editor muestra el párrafo anterior, el pasaje y el párrafo siguiente.
- El usuario puede seleccionar el pasaje correcto y ajustar el resultado en un
  textarea.
- Si existen varias coincidencias, se muestran como candidatas y el usuario elige.
- Si no existe una coincidencia segura, la edición continúa sin contexto.
- PDF, AZW3 y MOBI permiten editar la copia curada, pero el contexto avanzado queda
  fuera de este corte.

## Superficies de interfaz

- **Inicio:** progreso reciente, errores de sincronización y reseñas pendientes.
- **Lectura:** estado del último sync, acción manual y resumen de fuentes.
- **Documentos:** coincidencias sugeridas, confirmación de vínculo y fuentes
  ausentes.
- **Inbox:** highlights nuevos y posibles duplicados, más acciones conservar e
  ignorar.
- **Galería:** original, versión curada, comentario, búsqueda y agrupación.
- **Detalle de Obra:** porcentaje integrado, posición por fuente, estado del
  vínculo y reseña pendiente.

## Fases de implementación

1. **Fundación de sincronización:** identidad por contenido y fuente, escaneo
   incremental, estabilidad de sidecars, endpoint interno, job programado y
   resultados parciales.
2. **Progreso:** parser del estado `complete`, selección de fuente, mutation
   atómica, vínculo sugerido/confirmado y UI de porcentaje.
3. **Reseñas:** ciclo persistente, finalización manual/automática, creación ya
   terminada, Inicio y diálogo con posponer/descartar.
4. **Curación:** separación original/curado, campos nativos faltantes, identidad y
   orden estables, duplicados y conservación ante desapariciones.
5. **Contexto EPUB:** lectura de ZIP/OPF/spine, búsqueda normalizada, selección de
   candidato y editor contextual.
6. **Cierre operativo:** migraciones compatibles, telemetría de errores, E2E y
   documentación de despliegue del volumen y job.

Cada fase debe dejar las tablas existentes legibles y las rutas actuales
operativas. Los campos nuevos del schema son opcionales hasta que el backfill o
una importación los complete.

## Criterios de aceptación

- Una sincronización automática importa únicamente cambios y puede repetirse sin
  duplicar registros.
- Un sidecar inválido no impide procesar los demás y queda visible como error.
- Renombrar un EPUB no pierde vínculo, progreso ni curaciones.
- Vincular un documento requiere confirmación y luego proyecta el porcentaje en
  su Obra.
- Una Obra solo termina con `summary.status = "complete"` y genera una reseña
  pendiente sin alterar su fecha de término.
- Crear manualmente una Obra terminada abre la solicitud de reseña.
- Posponer conserva el pendiente y descartarlo deja de recordarlo.
- Editar un highlight nunca modifica ni es sobrescrito por el original.
- Un EPUB muestra contexto o una ambigüedad explícita; los otros formatos degradan
  a edición sin contexto.
- Desapariciones de fuentes nunca borran automáticamente datos del usuario.
- Todas las lecturas y escrituras permanecen aisladas por usuario.

## Verificación requerida

- Tests unitarios del parser Lua, estado `complete`, fingerprints, reconciliación
  y extracción EPUB.
- Tests de mutations para aislamiento, concurrencia de progreso, ciclo de reseña
  y conservación de curaciones.
- Tests del endpoint para autorización, idempotencia y fallos parciales.
- E2E con usuario dedicado y datos `[E2E ...]` para vínculo, progreso, reseña y
  curación; limpiar los registros creados desde la UI.
- Ejecutar `bun run check`, `bun run test` y `bun run test:e2e`.

## Fuera de alcance

- Escribir progreso o highlights de vuelta a KOReader.
- Syncery legado.
- API OPDS o integración directa con la API de Calibre.
- Obsidian, ideas revisables y FSRS.
- Contexto avanzado para PDF, AZW3 o MOBI.
- Pareado automático sin confirmación.
- Historial completo de ciclos y estadísticas de relectura.
