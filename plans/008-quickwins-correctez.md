# Plan 008: Quick wins de correctez (casts `as any` y filtro Manhwa)

> **Instrucciones**: pasos + verificación. Actualiza tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- convex/obras.ts src/components/explorar-grid.tsx`
> Mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: XS
- **Risk**: LOW
- **Depends on**: plans/001-linea-base-verificacion.md
- **Category**: bug
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

1. `convex/obras.ts` usa casts `(q as any)` en la query más transitada de la app: el compilador deja de validar que los campos coincidan con el índice declarado; un renombre compilaría igual y explotaría en runtime.
2. La vista Explorar no ofrece el filtro "Manhwa" pese a que `manhwa` es un tipo válido del dominio (`src/lib/types.ts:9`) y Biblioteca sí lo filtra.

## Current state

- `convex/obras.ts:46-61`:

```ts
if (input.status) {
	rows = await ctx.db
		.query("obras")
		.withIndex("by_user_status_updatedAt", (q) =>
			(q as any).eq("userId", userId).eq("status", input.status),
		)
		.order("desc")
		.take(limit);
} else if (input.type) {
	rows = await ctx.db
		.query("obras")
		.withIndex("by_user_type_updatedAt", (q) =>
			(q as any).eq("userId", userId).eq("type", input.type),
		)
```

El resto del archivo usa el builder tipado sin cast (p. ej. línea 65: `withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))`). Los índices existen en `convex/schema.ts:82-83`.

- `src/components/explorar-grid.tsx:51-57`:

```ts
const typeOptions: FilterOption<ObraType>[] = [
  { value: "book", label: "Libro" },
  { value: "movie", label: "Película" },
  { value: "series", label: "Serie" },
  { value: "anime", label: "Anime" },
  { value: "manga", label: "Manga" },
];
```

En `biblioteca-table.tsx` el equivalente incluye `{ value: "manhwa", label: "Manhwa" }`.

## Commands you will need

| Purpose   | Command             | Expected    |
| --------- | ------------------- | ----------- |
| Typecheck | `bun run typecheck` | exit 0      |
| Tests     | `bun run test`      | todas pasan |
| Lint      | `bun run check`     | exit 0      |

## Scope

**In scope**:

- `convex/obras.ts` (solo los dos casts)
- `src/components/explorar-grid.tsx` (solo `typeOptions`)

**Out of scope**:

- Consolidar opciones compartidas entre vistas (plan 016).
- Cualquier otro query o filtro.

## Git workflow

- Branch: `codex/008-quickwins-correctez`
- Commit: `fix(obras): quita casts as any y añade filtro manhwa en explorar`

## Steps

### Step 1: Quitar los casts

Reemplaza `(q as any).eq(...)` por `q.eq(...)` en ambas ramas. Si tsc se queja, es señal de que el índice no declara esos campos — STOP en ese caso (sería un bug de schema).

**Verify**: `bun run typecheck && rg -n "as any" convex/obras.ts` → exit 0 y 0 resultados.

### Step 2: Añadir Manhwa a Explorar

Añade `{ value: "manhwa", label: "Manhwa" }` después de manga en `typeOptions`.

**Verify**: `bun run typecheck` → exit 0 (`FilterOption<ObraType>` acepta manhwa).

## Test plan

- Cubierto por suite existente y typecheck. Verificación visual opcional: `/explorar` muestra el chip Manhwa.

## Done criteria

- [ ] `rg -n "as any" convex/obras.ts` → 0
- [ ] Chip Manhwa visible en `/explorar`
- [ ] Gates verdes
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Al quitar el cast, tsc reporta desalineación campo/índice (no improvises cambios de schema aquí).

## Maintenance notes

- Regla del repo: prohibido `as any` en builders de query Convex; si el builder no tipa, el índice está mal declarado.
