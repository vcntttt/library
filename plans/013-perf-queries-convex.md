# Plan 013: Perf de queries Convex (proyección de ideas y N+1 en documentos de lectura)

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza
> tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- convex/ideas.ts convex/reading.ts`
> Mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (cambia shapes de respuesta que consume la UI)
- **Depends on**: plans/012 (tests de caracterización primero); plans/001
- **Category**: perf
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

1. `ideas.list` devuelve documentos completos incluyendo `reviewLogs` — el historial FSRS acotado a 500 entradas × 10 números por idea, en cada carga y cada re-sincronización reactiva de `/ideas` — y la UI nunca lo lee.
2. `reading.listDocuments` hace una query de `readingSources` POR documento (1+N) y además colecciona TODAS las obras del usuario para enriquecer filas.

## Current state

- `convex/ideas.ts:8-19`:

```ts
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("ideas")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return rows.map(({ userId: _userId, ...idea }) => idea);
  },
});
```

(`listDue`, líneas 21-35, misma proyección con `.take(...)`). El cap de reviewLogs está en la escritura (`convex/ideas.ts` ~112: `.slice(-500)`).

- `convex/reading.ts:40-70` — `listDocuments`: `take(normalizeLimit(limit))` documentos; luego `collect()` de TODAS las obras del usuario; luego `Promise.all(rows.map(async document => ... query("readingSources").withIndex("by_document_updatedAt")... .collect()))`.
- Índices útiles ya declarados: `readingSources.by_user_updatedAt ["userId","updatedAt"]`; `readingDocuments` NO tiene índice por obraId distinto a `by_user_obraId` (añadido por plan 004) — no es necesario aquí.
- Consumidor UI de listDocuments: `src/routes/lectura/documentos.tsx` vía `useQuery`. Consumidor de ideas.list: `src/routes/ideas.tsx`.

## Commands you will need

| Purpose   | Command             | Expected    |
| --------- | ------------------- | ----------- |
| Typecheck | `bun run typecheck` | exit 0      |
| Tests     | `bun run test`      | todas pasan |
| Lint      | `bun run check`     | exit 0      |
| E2E smoke | `bun run test:e2e`  | pasa        |

## Scope

**In scope**:

- `convex/ideas.ts` (solo proyección de `list` y `listDue`)
- `convex/reading.ts` (solo `listDocuments`)
- Helper puro nuevo + test si agrupas fuentes

**Out of scope**:

- Cambiar qué renderiza la UI ni añadir paginación nueva.
- `listSyncRuns` u otras queries.

## Git workflow

- Branch: `codex/013-perf-queries-convex`
- Commit: `perf(convex): omite reviewLogs y elimina N+1 en documentos`

## Steps

### Step 1: Proyectar sin reviewLogs

En ambos queries de ideas:

```ts
return rows.map(
  ({ userId: _userId, reviewLogs: _reviewLogs, ...idea }) => idea,
);
```

Antes de borrar, confirma que la UI no usa `reviewLogs`: `rg -n "reviewLogs" src/` → solo debe aparecer en convex o en nada.

**Verify**: `rg -n "reviewLogs" src/routes src/components` → 0 resultados; typecheck verde (si algún componente tipaba ese campo, aparecerá aquí).

### Step 2: Agrupar sources en una pasada

En `listDocuments`:

```ts
const rows = /* igual */;
const allSources = await ctx.db
	.query("readingSources")
	.withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
	.order("desc")
	.take(MAX_DOCUMENTS * 5); // tope generoso; ver nota
const sourcesByDocument = new Map<string, Doc<"readingSources">[]>();
for (const source of allSources) {
	const list = sourcesByDocument.get(source.documentId) ?? [];
	list.push(source);
	sourcesByDocument.set(source.documentId, list);
}
```

y en el map final: `toDocumentView(document, sourcesByDocument.get(document._id) ?? [], obras)`.

Define `MAX_DOCUMENTS` según `normalizeLimit(limit)` real (lee su valor). El orden `desc` por updatedAt conserva "primero las fuentes más recientes" como hoy.

### Step 3: Obras solo de los IDs referenciados

Reemplaza el collect completo por fetch puntual de referenciadas:

```ts
const obraIds = [
  ...new Set(
    rows.map((d) => d.obraId).filter((id): id is Id<"obras"> => Boolean(id)),
  ),
];
const obras = (await Promise.all(obraIds.map((id) => ctx.db.get(id)))).filter(
  (obra): obra is Doc<"obras"> => Boolean(obra) && obra!.userId === userId,
);
```

Ajusta el tipo para complacer a tsc sin `any` (usa narrowing, no casts).

**Verify**: `bun run typecheck && bun run test && bun run check` → verde.

### Step 4: Test del agrupador (opcional pero recomendado)

Extrae `groupSourcesByDocument(sources)` a un helper puro (en `convex/reading.ts` no puede haber export no-handler; ponlo en `src/lib/reading/reconciliation.ts` o crea `convex/lib/reading-view.ts`) y testealo: agrupa por documentId, preserva orden desc, lista vacía para ids ausentes.

**Verify**: `bun run test -- <archivo del helper>` → pasa.

## Test plan

- Unitario del agrupador (Step 4).
- Regresión funcional: `bun run test:e2e` (smoke) y carga manual de `/lectura/documentos` e `/ideas` comprobando que renderizan igual.

## Done criteria

- [ ] `ideas.list`/`listDue` no incluyen `reviewLogs`
- [ ] `listDocuments` ejecuta 3 queries totales (documentos, sources, obras-puntuales), no 1+N
- [ ] Gates verdes incl. E2E smoke
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- La UI sí consume `reviewLogs` (el grep del Step 1 encuentra usos): reporta dónde antes de decidir.
- El límite de documentos hace que el tope de sources pierda datos (documentos con muchas fuentes antiguas): reporta el caso.

## Maintenance notes

- Si se añade paginación real a ideas, mantener la proyección sin reviewLogs (o exponer get individual).
- Reviewer: verificar que el orden de fuentes dentro de cada documento queda idéntico al actual (los tests visuales de galería dependen de él).
