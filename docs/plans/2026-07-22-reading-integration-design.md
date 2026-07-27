# Integración de lectura, KOReader y Obsidian

## Objetivo

Conectar la biblioteca de Calibre, los EPUB y sidecars sincronizados de KOReader, Library/Convex y el vault de Obsidian para convertir lecturas en conocimiento revisable sin imponer una estructura rígida a las notas.

## Decisiones

- La integración real pertenece únicamente al usuario propietario de la fuente de lectura.
- La carpeta de `Books` sincronizada es una fuente externa; el worker se configura mediante variables de entorno.
- Las rutas que tocan `Books` o el vault requieren `READING_INTEGRATION_OWNER_ID`; si
  falta esa variable, la integración queda deshabilitada.
- Un `Documento de lectura` es independiente de una `Obra`. Puede vincularse después, pero el importador no debe crear pareados dudosos.
- Una `Anotación de lectura` conserva el pasaje capturado, la nota opcional de KOReader, el dispositivo, la ubicación y las fechas.
- Una `Cita` es una selección curada; no todo highlight se convierte en cita.
- Una `Idea revisable` es un archivo Markdown libre en `100 - Knowledge/Ideas`. No tiene activador, respuesta ni secciones obligatorias.
- La nota Markdown es la fuente canónica del contenido de la idea. Library y Obsidian editan el mismo archivo.
- Convex conserva identidad, índice, relaciones, hash de contenido y estado/historial FSRS; no mantiene una segunda versión silenciosa del Markdown.
- La procedencia detallada vive en Library. La nota Markdown solo necesita mencionar el libro cuando corresponda.
- La revisión inicial se aplica al archivo completo. El título sirve como entrada y el contenido se revela después de intentar recordar.
- Los conflictos entre ediciones se detectan mediante hash y se resuelven explícitamente.

## Flujo objetivo

```text
Calibre/Books + sidecars KOReader
        ↓
Worker de sincronización en el servidor
        ↓
Documentos y anotaciones en Convex
        ↓
Bandeja de anotaciones en Library
        ↓
Cita, idea revisable, descarte o vínculo
        ↓
Nota Markdown en Obsidian + calendario FSRS en Convex
```

## Primer corte vertical

1. Parser puro y testeado para progreso y anotaciones de Syncery/KOReader.
2. Tablas Convex aisladas por usuario para documentos y anotaciones.
3. Endpoint/worker idempotente con rutas configurables.
4. Bandeja autenticada de documentos y anotaciones importadas.
5. Enlace manual opcional entre documento y obra existente.
6. Editor/vista previa Markdown sobre `100 - Knowledge/Ideas`.
7. Agenda FSRS para revisar el archivo completo como una unidad.

Este corte no exige procesar las capturas mientras el usuario sigue leyendo: la
sincronización es manual y la bandeja queda disponible para decidir después.

## Fuera de este corte

- Sincronización con la API OPDS de Calibre.
- Pareado automático agresivo entre documentos y obras.
- Daily notes, journaling y diario financiero.
- Worker periódico/automatizado; por ahora el disparador es explícito desde
  Library para evitar importar continuamente mientras Syncthing todavía está
  escribiendo sidecars.
