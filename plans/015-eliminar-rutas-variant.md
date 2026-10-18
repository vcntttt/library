# Plan 015: Eliminar las rutas experimento `/variant-a|b|c`

> **Instrucciones**: pasos + verificación. Actualiza tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- src/routes/variant-a.tsx src/routes/variant-b.tsx src/routes/variant-c.tsx src/routeTree.gen.ts`
> Mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001 (build/typecheck para regenerar routeTree)
- **Category**: tech-debt
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

Tres rutas de ~1650 líneas totales con datos mock hardcodeados, nacidas como comparación de estilos y jamás enlazadas desde la UI. Siguen entrando al bundle, son alcanzables por URL, y han costado mantenimiento fantasma (cambios de dominio como el tipo manhwa se replicaron a mano ×3).

## Current state

- Archivos: `src/routes/variant-a.tsx` (547 líneas), `variant-b.tsx` (557), `variant-c.tsx` (577). Cada uno define `export const Route = createFileRoute("/variant-X")({...})` con mocks (`mockObras`) y sin llamadas a Convex.
- Únicas referencias fuera de sí mismos: `src/routeTree.gen.ts` (generado). Verifícalo: `rg -n "variant-" src --glob '!routeTree.gen.ts'` → solo los 3 archivos.
- El routeTree lo regenera el plugin de TanStack Router al correr dev/build.

## Commands you will need

| Purpose               | Command                                                                             | Expected                 |
| --------------------- | ----------------------------------------------------------------------------------- | ------------------------ |
| Borrar                | `git rm src/routes/variant-a.tsx src/routes/variant-b.tsx src/routes/variant-c.tsx` | hecho                    |
| Regenerar + verificar | `bun run build`                                                                     | exit 0 sin rutas variant |
| Gates                 | `bun run typecheck && bun run test && bun run check`                                | verde                    |

## Scope

**In scope**: los tres archivos + `src/routeTree.gen.ts` (regenerado automáticamente).

**Out of scope**: cualquier cambio de estilos; rescatar paletas a código vivo NO (si algo valiera la pena ya estaría aplicado; queda en historia de git).

## Git workflow

- Branch: `codex/015-eliminar-variants`
- Commit: `chore(ui): elimina rutas experimento variant-a/b/c`

## Steps

### Step 1: Confirmar inaccesibilidad

`rg -n '"/variant' src --glob '!routeTree.gen.ts'` → solo definiciones. Y `rg -n "to=\"/variant|href=\"/variant" src e2e` → 0.

### Step 2: Borrar y regenerar

`git rm` de los tres archivos; `bun run build`.

**Verify**: `rg -n "variant" src/routeTree.gen.ts` → 0 resultados tras el build.

## Test plan

- Build + suite + smoke E2E si hay credenciales.

## Done criteria

- [ ] Los tres archivos no existen
- [ ] routeTree sin variant
- [ ] Gates verdes
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Alguna navegación programática o test apunta a /variant-\*.

## Maintenance notes

- Nada; borrado puro.
