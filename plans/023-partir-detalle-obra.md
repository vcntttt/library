# Plan 023: Partir la ruta de detalle de obra en componentes

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- "src/routes/obra/\$obraId.tsx" src/components/obra`
> Mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (movimientos puros, pero en el archivo más churneado del repo)
- **Depends on**: plans/001, plans/006 (toca handlers del mismo archivo — ejecutar después), plans/012 recomendado
- **Category**: tech-debt
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

`src/routes/obra/$obraId.tsx` (~940 líneas) es a la vez el archivo más grande y el más editado (25+ commits recientes): define ~10 componentes inline. Cada cambio de producto toca el monolito entero, con máximo riesgo de conflicto y revisión difícil.

## Current state

Inventario verificado de componentes definidos en el archivo:

```text
110  function ObraPage()
141  function ObraPageSkeleton()
190  function ObraActionBar({...})
268  function ObraBackButton()
294  function ObraDetailView({...})
342  function ObraCoverPanel({...})
443  function ObraHeroInfo({...})
498  function TechnicalInfoSection({...})
541  function PersonalNotesSection({ obra }: { obra: Obra })
671  function ObraAuthed(...)
```

(Los rangos pueden haberse desplazado tras planes 005-008; re-inventaria con `rg -n "^function " "src/routes/obra/$obraId.tsx"` antes de mover.)

Convenciones de componentes del repo: archivos kebab-case bajo `src/components/<dominio>/`, exports nombrados PascalCase, imports con alias `@/`.

## Commands you will need

| Purpose      | Command                         | Expected                  |
| ------------ | ------------------------------- | ------------------------- |
| Typecheck    | `bun run typecheck`             | exit 0                    |
| Tests / Lint | `bun run test && bun run check` | verde                     |
| E2E smoke    | `bun run test:e2e`              | pasa (cubre alta→detalle) |

## Scope

**In scope**:

- `src/routes/obra/$obraId.tsx` (queda solo route wiring + ObraPage raíz)
- `src/components/obra/*.tsx` (crear: un archivo por componente)

**Out of scope**:

- Cambiar props, estado o comportamiento (movimiento 1:1).
- Extraer hooks o lógica nueva.
- Otros archivos de rutas.

## Git workflow

- Branch: `codex/023-partir-detalle-obra`
- Commits: uno por componente movido (`refactor(obra): extrae ObraCoverPanel`, ...) — facilita revisión y revert.

## Steps

### Step 1: Re-inventariar y planificar archivos

`rg -n "^function " "src/routes/obra/$obraId.tsx"` → lista actual. Mapa propuesto:

```text
src/components/obra/obra-page-skeleton.tsx
src/components/obra/obra-action-bar.tsx
src/components/obra/obra-back-button.tsx
src/components/obra/obra-detail-view.tsx
src/components/obra/obra-cover-panel.tsx
src/components/obra/obra-hero-info.tsx
src/components/obra/technical-info-section.tsx
src/components/obra/personal-notes-section.tsx
src/components/obra/obra-authed.tsx
```

### Step 2: Mover de adentro hacia afuera

Empieza por las hojas (skeleton, back-button, cover-panel...) y termina por las que más dependen. Cada movimiento:

1. Corta la función tal cual → nuevo archivo con export nombrado.
2. Añade imports necesarios (type-only cuando sea import de tipo).
3. En la ruta, reemplaza por import.
4. `bun run typecheck && bun run check` verde ANTES del siguiente movimiento.

### Step 3: Estado final

La ruta conserva: `createFileRoute`, loader/query wiring y `ObraPage` (que compone). Nada de lógica duplicada.

**Verify**: `wc -l "src/routes/obra/$obraId.tsx"` → <200; suite completa verde incl. E2E smoke (el flujo crear obra → abrir detalle lo ejercita).

## Test plan

- E2E smoke existente como red; verificación manual del detalle (portada, progreso, notas, acciones).

## Done criteria

- [ ] Ruta <200 líneas, solo wiring
- [ ] Cero cambios semánticos (diff por commits de movimiento)
- [ ] Gates + E2E verdes; fila actualizada en `plans/README.md`

## STOP conditions

- Dos componentes comparten closures/estado no prop-able (acoplamiento oculto): reporta el par en vez de forzar props nuevos.

## Maintenance notes

- Futuras features del detalle tocan archivos pequeños con dueño claro.
- Reviewer: comparar cada commit contra su original (`git diff` debe ser puro movimiento).
