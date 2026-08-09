# Project Context

## Library

Library es una app privada de media library personal.

### Alcance actual

- Un modelo unificado de `Obra` para libros, películas, series, anime y manga.
- Prioridad actual: dejar `manga` listo para uso diario.
- Stack principal:
  - React + TanStack Router
  - TanStack Start
  - Convex self-hosted
  - Convex Auth
  - Tailwind v4 + shadcn/ui
  - Vitest + Biome
  - Bun

### Manga como foco

El proyecto ya incluye soporte funcional para manga en:

- alta de obras con metadata desde AniList
- vista de detalle con progreso por capítulos
- metadatos de capítulos y volúmenes
- worker de capítulos nuevos
- notificaciones vía Alfred

La dirección actual es consolidar ese flujo para que sea el primer tipo realmente pulido en el uso diario.

### Principios de producto

- Privado por defecto
- Sin feeds ni componentes sociales
- Texto libre y notas como parte central del valor
- Modelo unificado, sin separar la app por tipo de obra
- En la UI, el idioma es español

### Notas de implementación

- `manga` usa capítulos como unidad de progreso.
- `latestChapter` es la referencia operativa para seguimiento.
- `chapters` sigue siendo fallback o dato de catálogo.
- No ampliar el alcance a series/películas/libros salvo cambios compartidos necesarios para no romper manga.

### Nueva dirección: integración de lectura

La prioridad funcional es terminar la integración owner-only entre KOReader y
Library/Convex.

- KOReader conserva los datos originales; Library mantiene progreso proyectado y
  curaciones separadas.
- Los documentos de lectura y las anotaciones son entidades distintas de las obras.
- La sincronización automática, el editor contextual EPUB y las reseñas pendientes
  forman el corte activo.
- Obsidian, ideas revisables y FSRS permanecen fuera de este corte.
- La especificación activa está en `docs/plans/2026-07-22-reading-integration-design.md`.
