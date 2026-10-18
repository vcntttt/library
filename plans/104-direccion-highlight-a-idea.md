# Plan 104 (Dirección): Del highlight curado a la idea revisable

> Plan de DIRECCIÓN: design spike. Toca el modelo de ideas y la frontera con
> Obsidian — requiere decisión documentada propia, NO colarse en el spec de
> lectura actual (que lo dejó explícitamente fuera de alcance).

## Status

- **Priority**: P3
- **Effort**: M-L (estimación gruesa; el spike es M)
- **Risk**: MED (modelo de datos nuevo + contrato con el vault)
- **Depends on**: ninguno técnico fuerte
- **Category**: direction
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

La tesis del producto (`CONTEXT.md:3`) es "organiza obras culturales privadas Y EL CONOCIMIENTO que se construye a partir de su lectura". El vocabulario define `Cita` (pasaje conservado) e `Idea revisable` "apoyada por cero, una o varias citas" — pero no existe camino alguno del highlight curado a la idea: hoy requiere copiado manual entre inbox/galería y el vault. Cerrar ese ciclo es la promesa editorial central hecha flujo.

## Grounding

- `CONTEXT.md:19-31`: definiciones de Cita, Idea revisable y Nota de idea ("lienzo libre... Library lo lee y escribe; Convex conserva su identidad, un índice y el estado de revisiones").
- Pipeline existente: curación produce `curatedText`+`comment` (`convex/reading.ts:264-320`); ideas nacen del vault (`src/lib/server/idea-files.ts`, `convex/ideas.ts:53`). No hay campo de procedencia en `ideas` (`convex/schema.ts:263`).
- Contradicción a respetar: `docs/plans/2026-07-22-reading-integration-design.md:278` dejó ideas/FSRS fuera DEL CORTE DE LECTURA — eso no rechaza esta conexión, pero exige su propio corte documentado.

## Deliverable

`docs/plans/2026-MM-DD-cita-a-idea-design.md` respondiendo:

1. **Modelo mínimo de procedencia**: ¿`idea.quoteIds: v.array(v.id("obraQuotes"))`? ¿tabla puente? ¿o anotación curada → nueva entidad `cita` desacoplada de readingAnnotations? Recomendación inicial: campo array en `ideas` apuntando a anotaciones curadas (sin duplicar texto).
2. **Flujo propuesto**: acción "Convertir en idea" desde inbox/galería → prefill de nota nueva en el vault con frontmatter mínimo + cita embebida como blockquote, título sugerido editable.
3. **Contrato con Obsidian**: qué escribe Library EXACTAMENTE en el Markdown inicial y qué nunca toca después (la nota es lienzo libre del dueño); cómo sobrevive a renombres (identity por path ya existe).
4. **FSRS**: la idea nueva entra al ciclo de revisión normal (`reviewCard` inicial) — sin lógica nueva.
5. **Fuera de alcance**: edición bidireccional, sincronización de citas editadas después, estadísticas.

## Steps

### Step 1: Spike de escritura al vault

Rama desechable: función que crea una nota `.md` de prueba en un vault temporal con frontmatter+cita, usando los helpers existentes de `idea-files.ts`. Verifica round-trip con `scanIdeas`.

### Step 2: Documento de diseño

Decisiones únicas con trade-offs por pregunta; validar con el dueño ANTES de tickets.

### Step 3 (post-decisión): Tickets de implementación

Schema (campo procedencia) → mutation "convertir en idea" → acciones UI inbox/galería → tests.

## Done criteria

- [ ] Doc decidido + spike validado
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- El dueño decide que las ideas NUNCA deben escribirse desde Library: entonces este corte muere y se documenta esa decisión en su lugar.
