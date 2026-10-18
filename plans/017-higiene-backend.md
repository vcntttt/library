# Plan 017: Higiene del backend (import cruzado src→convex e índices muertos)

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza
> tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- convex/ideas.ts convex/schema.ts src/lib/reading/integration-owner.ts`
> Mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW-MED (push de schema; coordinar por deployment compartido)
- **Depends on**: plans/001; NO en paralelo con 003/004/013 (schema y convex/)
- **Category**: tech-debt
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

1. `convex/ideas.ts` importa desde el árbol del frontend (`../src/lib/reading/integration-owner`): rompimiento de capa que hace ambiguo dónde vive el código compartido.
2. Dos índices definidos y jamás consultados (`obras.by_manga_tracking`, `readingSyncRuns.by_user_status_startedAt`) generan write amplification perpetua sin ningún beneficio.

## Current state

- `convex/ideas.ts:4`: `import { requireIntegrationOwner } from "../src/lib/reading/integration-owner";`
- Contenido de `src/lib/reading/integration-owner.ts`: helper que resuelve el usuario dueño desde `READING_INTEGRATION_OWNER_ID`. Verifica todos sus consumidores: `rg -n "integration-owner" src convex --glob '!routeTree.gen.ts'`.
- Índices sin usos (verificado con rg): `convex/schema.ts:89` `.index("by_manga_tracking", ["type","status","externalSource"])` y `convex/schema.ts:262` `.index("by_user_status_startedAt", [...])`.
- Convención de schema: todo índice debe respaldar un patrón de query real.

## Commands you will need

| Purpose     | Command               | Expected |
| ----------- | --------------------- | -------- |
| Typecheck   | `bun run typecheck`   | exit 0   |
| Tests       | `bun run test`        | pasan    |
| Push schema | `bun run convex:push` | éxito    |

## Scope

**In scope**:

- `src/lib/reading/integration-owner.ts` → mover a `convex/lib/integration-owner.ts`
- Importadores de ese módulo
- `convex/schema.ts` (quitar los dos índices)

**Out of scope**:

- Cualquier otro helper compartido o refactor de access control.

## Git workflow

- Branch: `codex/017-higiene-backend`
- Commits: `refactor(convex): mueve integration-owner a convex/lib`, `chore(schema): elimina índices sin uso`

## Steps

### Step 1: Mover integration-owner

1. `git mv src/lib/reading/integration-owner.ts convex/lib/integration-owner.ts`.
2. Ajusta imports internos del archivo si usaba rutas relativas a src/.
3. Actualiza TODOS los importadores encontrados en el drift check (convex usa `./lib/integration-owner`; el frontend puede usar alias `@convex/lib/integration-owner`, ya configurado en tsconfig).

**Verify**: `rg -n "reading/integration-owner" src convex` → 0. `bun run typecheck && bun run test` → verde.

### Step 2: Quitar índices muertos

Borra las dos líneas `.index(...)` señaladas. Re-verifica con grep ANTES:

```bash
rg -n "by_manga_tracking" convex --glob '!_generated'   # solo schema.ts
rg -n "by_user_status_startedAt" convex --glob '!_generated'
```

Luego `bun run convex:push`.

**Verify**: push exitoso; typecheck verde (una query referenciando un índice inexistente fallaría al compilar — no habrá).

## Test plan

- Suite existente; verificación manual de `/lectura` e `/ideas` tras el push.

## Done criteria

- [ ] Ningún archivo de `convex/` importa desde `src/` (`rg -n 'from "\.\./src/' convex`)
- [ ] Los dos índices no existen y el push fue exitoso
- [ ] Gates verdes; fila actualizada en `plans/README.md`

## STOP conditions

- El push de schema pide acción destructiva.
- Algún importador del helper tiene restricciones de bundling que impidan la nueva ubicación.

## Maintenance notes

- Regla: código compartido real vive en `convex/lib/` (el frontend puede importarlo vía `@convex/*`); `src/` nunca es dependencia del backend.
