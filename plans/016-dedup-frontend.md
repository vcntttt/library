# Plan 016: Consolidar lógica duplicada del frontend (URLs y opciones de filtro)

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza
> tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- src/lib src/components/biblioteca-table.tsx src/components/explorar-grid.tsx src/components/obra-card.tsx src/components/add-obra/obra-form.tsx "src/routes/obra/\$obraId.tsx"`
> Mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW-MED (unificar semántica puede alterar detalles visuales mínimos)
- **Depends on**: plans/001, plans/008 (el filtro manhwa ya existe en explorar)
- **Category**: tech-debt
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

`normalizeReadingUrl` está copiada en 5 archivos con semánticas que ya divergieron (algunas devuelven `""`, otras `undefined`; una antepone `https://` a dominios desnudos). Los mapas de `typeOptions/statusOptions/sortOptions` están duplicados entre Biblioteca y Explorar, y `obra-form` redefine labels de estado sin el género gramatical que `src/lib/status.ts` ya resuelve con `getStatusLabel`. Cada cambio de regla hoy exige tocar varios archivos.

## Current state

Copias de `normalizeReadingUrl` (todas verificadas):

| Archivo                               | Línea | Retorno vacío |
| ------------------------------------- | ----- | ------------- |
| `src/routes/obra/$obraId.tsx`         | 98    | `""`          |
| `src/components/obra-edit-sheet.tsx`  | 86    | `""`          |
| `src/lib/metadata/providers.ts`       | 1600  | `undefined`   |
| `src/components/biblioteca-table.tsx` | 177   | `undefined`   |
| `src/components/obra-card.tsx`        | 20    | `undefined`   |

Lee cada copia completa antes de unificar y anota sus diferencias reales (¿anteponen scheme? ¿trim?).

Opciones duplicadas:

- `explorar-grid.tsx:51-79` — `typeOptions` (5+1 tipos tras plan 008), `statusOptions`.
- `biblioteca-table.tsx:74-81+` — equivalentes propios.
- `add-obra/obra-form.tsx:30` — mapa propio `backlog: "Pendiente"...` en vez de `getStatusLabel(status, type)` (`src/lib/status.ts:36-42`).

Convenciones: helpers compartidos en `src/lib/*` con tests al lado; alias `@/`; type-only imports cuando aplique.

## Commands you will need

| Purpose          | Command                               | Expected    |
| ---------------- | ------------------------------------- | ----------- |
| Typecheck / Lint | `bun run typecheck && bun run check`  | exit 0      |
| Tests            | `bun run test`                        | todas pasan |
| Test nuevo       | `bun run test -- src/lib/url.test.ts` | pasa        |
| E2E smoke        | `bun run test:e2e`                    | pasa        |

## Scope

**In scope**:

- `src/lib/url.ts` + `src/lib/url.test.ts` (crear)
- `src/lib/filters.ts` + `src/lib/filters.test.ts` (crear)
- Los 5 consumidores de normalizeReadingUrl
- `add-obra/obra-form.tsx` (labels)

**Out of scope**:

- Unificar los dos enfoques de formulario (alta vs edición) — decisión de producto aparte.
- `providers.ts` más allá de consumir el helper nuevo.

## Git workflow

- Branch: `codex/016-dedup-frontend`
- Commit: `refactor(ui): consolida normalización de URLs y opciones de filtro`

## Steps

### Step 1: `src/lib/url.ts`

```ts
// Semántica única: undefined para valores vacíos/inválidos; string normalizado si sirve como URL.
export function normalizeReadingUrl(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
```

Ajusta la rama final al comportamiento real mayoritario de las 5 copias (léelas primero; si alguna NO anteponía scheme, decide cuál es correcta y documéntalo en el PR). Testea: vacía→undefined, espacios→undefined, http(s) intacto, dominio desnudo→https.

Consumidores:

- `$obraId.tsx` y `obra-edit-sheet.tsx` usaban `""` para inputs: mapea en el punto de uso `(normalizeReadingUrl(v) ?? "")`.
- `biblioteca-table.tsx`, `obra-card.tsx`: directo.
- `providers.ts`: importa `@/lib/url` (server-side OK, sin deps).

**Verify**: `rg -n "function normalizeReadingUrl|const normalizeReadingUrl" src` → solo `src/lib/url.ts`.

### Step 2: `src/lib/filters.ts`

Mueve ahí `typeOptions`, `statusOptions` y (si difieren solo en orden) `sortOptions` tipadas:

```ts
import type { ObraStatus, ObraType } from "./types";
export interface FilterOption<T extends string> {
  value: T;
  label: string;
}
export const typeOptions: FilterOption<ObraType>[] = [
  /* incluye manhwa */
];
export const statusOptions: FilterOption<ObraStatus>[] = [
  /* ... */
];
```

Actualiza ambos componentes a importarlas. Si Biblioteca y Explorar necesitaban sets distintos legítimamente (verifica), exporta dos variantes nombradas y documenta por qué.

### Step 3: Labels de estado en obra-form

Reemplaza el mapa local por `getStatusLabel(status, type)` de `@/lib/status` donde se rendericen labels (el form conoce el tipo activo).

**Verify**: visual rápida del selector de tipo en alta: labels idénticos ("Pendiente", etc.).

### Step 4: Tests

`filters.test.ts`: manhwa presente, labels no vacíos, valores únicos.

**Verify**: suite verde completa + E2E smoke (la tabla y explorar renderizan filtros).

## Test plan

- Unitarios url/filters como arriba.

## Done criteria

- [ ] Una sola definición de normalizeReadingUrl y de opciones
- [ ] Tests nuevos verdes; gates verdes
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Las opciones de ambas vistas difieren en contenido (no solo orden): reporta las diferencias antes de forzar una sola fuente.

## Maintenance notes

- Nuevo tipo de obra ⇒ tocar SOLO `src/lib/filters.ts` (+ types).
- Revisa el PR comparando capturas antes/después de los dropdowns de filtros.
