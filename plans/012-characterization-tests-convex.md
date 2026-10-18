# Plan 012: Characterization tests de las decisiones de progreso y reseña (Convex)

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza
> tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- convex/reading.ts convex/obras.ts convex/lib`
> Mismatch = STOP.

## Status

- **Priority**: P2 (prerrequisito de refactor 013 y de los splits 023/024)
- **Effort**: M
- **Risk**: LOW (solo tests + extracción pura)
- **Depends on**: plans/001
- **Category**: tests
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

La capa de mutaciones Convex —sync KOReader, proyección de progreso sobre obras, ciclo de reseñas— es el código más crítico y con más churn del repo, y tiene cero cobertura: una regresión corrompería datos multiusuario sin que nada la detecte. El design doc activo lo pedía explícitamente ("Tests de mutations para aislamiento, concurrencia de progreso, ciclo de reseña"). La vía pragmática del repo ya probada es extraer decisiones puras a `convex/lib/*` con tests al lado (`convex/lib/obras.test.ts`, `convex/lib/fsrs.test.ts`): este plan caracteriza la lógica de decisión así, dejando el harness completo de `ctx.db` para después.

Decisión de dominio que estos tests fijan (de `docs/plans/2026-07-22-reading-integration-design.md`, líneas 140-153): solo `completionStatus === "complete"` termina la obra; 100% sin ese estado sigue `in-progress`; retroceder no reduce el máximo ni reabre; caída grande tras terminar sugiere relectura; la sync no toca reseña/etiquetas.

## Current state

- `convex/reading.ts:729-775` — `projectProgressForDocument(ctx, document, now)` (privada): lee progresos por documento (`by_document_device`), llama `selectCanonicalProgress(progressRows)`, calcula `fellAfterFinish` (caída > 20% tras `finished`), arma un patch parcial `Doc<"obras">` con transiciones:
  - `backlog` + currentPercent > 0 → `status: "in-progress"`, `startedAt ??= now`;
  - `complete` + status ≠ finished → `status: "finished"`, `finishedAt = sourceTimestamp ?? now`, `reviewStatus: "pending"` solo si `!obra.reviewStatus && !obra.review`;
  - (leer el resto del handler hasta el final antes de tocar nada — hay lógica de sugerencia de relectura).
- `selectCanonicalProgress` vive en `src/lib/reading/reconciliation.ts` (con tests propios) — NO duplicarla.
- Helpers puros ya testados en `convex/lib/obras.test.ts`: `shouldReopenFinishedProgress`, `syncMangaProgressTotal`, `sanitizeProgress`...
- Patrón de test del repo: `describe/it/expect` de vitest, casos con nombres descriptivos en español o inglés corto, sin mocks pesados.

## Commands you will need

| Purpose          | Command                                                 | Expected                 |
| ---------------- | ------------------------------------------------------- | ------------------------ |
| Tests            | `bun run test`                                          | todas pasan incl. nuevas |
| Test puntual     | `bun run test -- convex/lib/reading-projection.test.ts` | pasa                     |
| Typecheck / Lint | `bun run typecheck && bun run check`                    | exit 0                   |

## Scope

**In scope**:

- `convex/lib/reading-projection.ts` (crear)
- `convex/lib/reading-projection.test.ts` (crear)
- `convex/reading.ts` (SOLO para importar el helper nuevo desde `projectProgressForDocument`; la decisión sale del handler, el I/O queda)

**Out of scope**:

- Cambiar cualquier transición existente (esto es characterization: si encuentras un bug, repórtalo, no lo arregles aquí).
- Harness genérico de `ctx.db`.

## Git workflow

- Branch: `codex/012-characterization-proyeccion`
- Commit: `test(reading): caracteriza decisiones de proyección de progreso`

## Steps

### Step 1: Extraer la función de decisión

Crea `convex/lib/reading-projection.ts` moviendo el cálculo puro desde `projectProgressForDocument`:

```ts
import type { Doc } from "../_generated/dataModel";

export interface ProjectionInput {
  obra: Pick<
    Doc<"obras">,
    | "status"
    | "startedAt"
    | "finishedAt"
    | "reviewStatus"
    | "review"
    | "readingCurrentPercent"
    | "readingProgressPercent"
    | "readingDocumentId"
    | "readingRereadSuggestedAt"
  >;
  currentPercent?: number;
  maxPercent?: number;
  completionStatus?: "complete" | "in-progress";
  sourceTimestamp?: number;
  now: number;
}

// Devuelve el patch a aplicar sobre la obra (sin incluir campos de identidad).
export function decideObraProgressPatch(
  input: ProjectionInput,
): Partial<Doc<"obras">> {
  // cuerpo copiado 1:1 desde projectProgressForDocument,
  // reemplazando selection.X por input.X
}
```

Regla de oro: **cero cambios de comportamiento**. Si al mover encuentras algo que parece bug, cópialo igual y anótalo en el resumen.

En `projectProgressForDocument`, reemplaza el bloque del patch por:

```ts
const patch = decideObraProgressPatch({
  obra,
  currentPercent: selection.currentPercent,
  maxPercent: selection.maxPercent,
  completionStatus: selection.completionStatus,
  sourceTimestamp: selection.selected?.sourceTimestamp,
  now,
});
```

manteniendo el early-return cuando no hay datos.

**Verify**: `bun run typecheck && bun run test` → todo verde (comportamiento idéntico).

### Step 2: Tests de caracterización

`convex/lib/reading-projection.test.ts` — casos mínimos (uno por regla del design doc):

1. backlog + currentPercent=5 → patch.status="in-progress", startedAt=input.now.
2. backlog + currentPercent=0 → sin cambio de status.
3. in-progress + completionStatus="complete" → status="finished", finishedAt=sourceTimestamp, reviewStatus="pending".
4. complete sin sourceTimestamp → finishedAt=now.
5. 100% (maxPercent=100, completionStatus="in-progress") → NO finished.
6. finished previo + complete → no re-abre; finishedAt original conservado (el patch no debe pisar finishedAt si ya existe — verifica qué hace hoy el código y fija ESO).
7. review ya escrita (obra.review presente) + completa → reviewStatus NO se setea.
8. finished + currentPercent cae >20 puntos bajo readingCurrentPercent → aparece la marca de relectura (copia exactamente el campo que hoy escribe el código, p. ej. `readingRereadSuggestedAt`).
9. Caída ≤20 puntos → sin marca.
10. Sin ningún dato (undefined todo) → patch vacío/sin status.

Si el código actual contradice alguno de estos enunciados, el test documenta el comportamiento REAL (caracterización), y la divergencia va al resumen del PR como hallazgo.

**Verify**: `bun run test -- convex/lib/reading-projection.test.ts` → 10 pasan.

### Step 3: Asegurar que la mutation usa el helper

Confirma con lectura que `projectProgressForDocument` ya no contiene la lógica duplicada y que ningún otro call site repite esas reglas (`rg -n "fellAfterFinish|in-progress.*backlog" convex/`).

**Verify**: `rg -n "decideObraProgressPatch" convex` → definición + ≥1 uso.

## Test plan

- Los 10 casos del Step 2 son la entrega principal.

## Done criteria

- [ ] Helper extraído y consumido; lógica no duplicada
- [ ] 10+ tests de caracterización verdes
- [ ] Cero cambios de comportamiento (diff revisable línea a línea)
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Al extraer descubres que la lógica depende de efectos secundarios entrelazados (p. ej. escribe otra tabla dentro de la decisión): reporta la estructura real en lugar de forzar la extracción.

## Maintenance notes

- Estos tests son el filete de seguridad del plan 013 (perf queries) y de futuros cambios en `convex/reading.ts`.
- Cuando exista harness de ctx.db, añadir la prueba end-to-end de la mutation completa (aislamiento por usuario incluido).
