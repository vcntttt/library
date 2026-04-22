# Project Context

## Library

Library es una app privada de media library personal.

### Alcance actual

- Un modelo unificado de `Obra` para libros, películas, series, anime y manga.
- Prioridad actual: dejar `manga` listo para uso diario.
- Stack principal:
  - React + TanStack Router
  - TanStack Start
  - PostgreSQL + Drizzle
  - Better Auth
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

