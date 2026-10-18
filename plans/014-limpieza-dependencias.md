# Plan 014: Limpiar dependencias y fijar `nitro`

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza
> tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- package.json bun.lock vite.config.ts`
> Mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (ninguna dependencia a remover se importa)
- **Depends on**: plans/001
- **Category**: deps
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

Seis paquetes instalados con cero imports (`@faker-js/faker`, `zustand`, `@vercel/analytics`, `@tanstack/react-table`, `@tanstack/match-sorter-utils` en dependencies; `web-vitals` en devDependencies), la CLI `shadcn` en runtime, y el servidor de producción flotando con `"nitro": "latest"` que resuelve a un alpha (`3.0.1-alpha.2`). Cada uno es superficie de supply-chain o riesgo de build gratis.

## Current state

- `package.json` — dependencias a tratar:
  - Remover: `@faker-js/faker`, `zustand`, `@vercel/analytics`, `@tanstack/react-table`, `@tanstack/match-sorter-utils` (dependencies) y `web-vitals` (devDependencies).
  - **CORRECCIÓN del reviewer (2026-08-23)**: NO mover `shadcn` a devDependencies — `src/styles.css:5` hace `@import "shadcn/tailwind.css"` (input real del build; la verificación original con `rg -F '"shadcn"'` no capturaba specs con subpath). Permanece en dependencies mientras exista ese import.
  - Pinear: `"nitro": "latest"` → versión exacta resuelta hoy.
- Verifica tú mismo antes de borrar: `for p in @faker-js/faker zustand "@vercel/analytics" "@tanstack/react-table" "@tanstack/match-sorter-utils" web-vitals; do rg -n "$p" src convex scripts e2e || true; done` → 0 resultados cada uno.
- Resolución actual de nitro: busca en `bun.lock` (`rg -n '"nitro@' bun.lock | head`) — anota la versión EXACTA (audit reportó `3.0.1-alpha.2`; confirma).

## Commands you will need

| Purpose   | Command             | Expected                 |
| --------- | ------------------- | ------------------------ |
| Remover   | `bun remove <pkgs>` | exit 0, lock actualizado |
| Instalar  | `bun install`       | exit 0                   |
| Build     | `bun run build`     | exit 0                   |
| Typecheck | `bun run typecheck` | exit 0                   |
| Tests     | `bun run test`      | todas pasan              |
| Lint      | `bun run check`     | exit 0                   |

## Scope

**In scope**:

- `package.json`
- `bun.lock`

**Out of scope**:

- Cualquier subida de versión mayor de lo que ya está.
- Cambiar imports existentes.

## Git workflow

- Branch: `codex/014-limpieza-dependencias`
- Commit: `chore(deps): remueve dependencias muertas y pinea nitro`

## Steps

### Step 1: Anotar versión resuelta de nitro

`rg -n '"nitro@' bun.lock | head -3` → anota (ej. `3.0.1-alpha.2`).

### Step 2: Remover muertas y mover shadcn

```bash
bun remove @faker-js/faker zustand "@vercel/analytics" "@tanstack/react-table" "@tanstack/match-sorter-utils" web-vitals
bun remove shadcn && bun add -d shadcn@<misma-versión-de-lock>
```

**Verify**: `rg -n 'zustand|"nitro": "latest"' package.json` → nitro aún en latest, zustand fuera.

### Step 3: Pinear nitro

En `package.json`: `"nitro": "<versión-anotada>"`. Luego `bun install`.

**Verify**: `bun run build` → exit 0. Si el build falla por el pin, STOP.

### Step 4: Suite completa

`bun run typecheck && bun run test && bun run check` → verde. Opcional si hay credenciales E2E: `bun run test:e2e`.

## Test plan

- Cubierto por suite + build (nada se importaba; el riesgo real era el pin de nitro).

## Done criteria

- [ ] Los 6 paquetes muertos removidos; shadcn permanece en dependencies (corrección reviewer)
- [ ] `package.json` no contiene `"latest"`
- [ ] `bun run build && bun run typecheck && bun run test && bun run check` exit 0
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- El pin de nitro rompe el build (significa drift lock/manifest): reporta versiones.
- Aparece un import oculto de algún paquete a remover (dinámico): reporta dónde.

## Maintenance notes

- Regla nueva sugerida: dependencias solo entran al manifest con un import real.
- Al actualizar nitro deliberadamente, hacerlo en PR propio con build+E2E.
