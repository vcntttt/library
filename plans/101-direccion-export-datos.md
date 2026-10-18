# Plan 101 (Dirección): Diseñar el export de datos estructurados

> Plan de DIRECCIÓN: su entregable es un documento de diseño, no código de
> producción. Actualiza tu fila en `plans/README.md` al terminar.

## Status

- **Priority**: P3 (pero es la promesa fundacional incumplida más visible)
- **Effort**: M (spike + diseño)
- **Risk**: LOW
- **Depends on**: ninguno técnico; leer planes 012/013 ayuda
- **Category**: direction
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

README promete tres veces "datos exportables, respaldables y legibles por humanos (sin lock-in)" y no existe una sola línea de export. Para una instancia self-hosted multiusuario esto es respaldo real y salida sin lock-in — reduce también el miedo a migraciones futuras del schema.

## Grounding

- `README.md:58` "Pensado para exportar/importar facilmente"; `:229` filosofía de datos; `:258` roadmap.
- `CONTEXT.md:27-29`: Convex guarda índice/estructura, el pensamiento vive en Markdown — el export debe respetar esa separación.
- Infraestructura lista: patrón de server route con service client (`src/lib/server/convex.ts`, usado en `api/internal/reading/sync.ts`) y scoping por usuario en todas las funciones.

## Deliverable

`docs/plans/2026-MM-DD-export-design.md` respondiendo:

1. Formato: JSON completo vs Markdown+frontmatter por obra vs ambos (recomendación inicial: JSON canónico + opción Markdown para notas/reseñas).
2. Granularidad: todo-el-usuario vs por tipo; incluir ideas/documentos/anotaciones o solo obras+citas.
3. Superficie: botón en UI con descarga streaming vs ruta `/api/export` autenticada; límites de tamaño.
4. Procedencia: qué campos son internos (`userId`, IDs) y se omiten o anonimizan.
5. Import: explícitamente fuera de alcance fase 1; esquema de re-import a futuro (los IDs estables que conviene emitir ya en export).

## Steps

### Step 1: Inventario de datos por usuario

Lee `convex/schema.ts` y enumera tablas/campos por usuario (obras, obraQuotes, ideas, readingDocuments/Sources/Progress/Annotations). Marca qué es estructura vs texto libre.

**Verify**: tabla de inventario incluida en el doc.

### Step 2: Prototipo desechable (opcional pero recomendado)

Rama `codex/101-export-spike`: ruta `/api/export?scope=obras` que serialice obras+citas del usuario autenticado a JSON. NO mergear: sirve solo para medir tamaño/tiempo con datos reales del E2E.

### Step 3: Documento de decisión

Escribe el diseño con recomendación única por pregunta y trade-offs. Círralo con el dueño antes de crear tickets de implementación.

## Done criteria

- [ ] Doc en `docs/plans/` con inventario + decisiones + plan de fases
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Ninguno relevante (es un spike).
