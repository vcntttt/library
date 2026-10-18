# Plan 019: Tests de los handlers de rutas de servidor (autorización e idempotencia)

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza
> tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- src/routes/api src/routes/internal src/lib/server/reading-sync.ts`
> Mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001, plans/009 (formas de respuesta uniformes ya aplicadas)
- **Category**: tests / security
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

Los límites de autorización de todo el sistema —secreto del job de lectura, secreto de Alfred, propietario de la integración— viven en handlers sin ninguna prueba. El design doc lo pedía ("Tests del endpoint para autorización, idempotencia y fallos parciales"). Hoy un refactor que rompa un check de secreto dejaría `bun run test` en verde.

## Current state

- Handlers a cubrir:
  - `src/routes/api/internal/reading/sync.ts` — POST; valida 3 env vars (tras plan 009: 503 uniforme "Servicio no disponible."), luego `x-reading-sync-secret` o Bearer con `sameSecret` (401), luego `runReadingSync(client, rootPath, "automatic")`.
  - `src/routes/internal/alfred/notifications/pull.ts` (+ `ack.ts`, `mark-read.ts`) — POST; `assertAlfredSecret(request)` (401 uniforme tras plan 009), body JSON opcional, delega en Convex vía `createConvexServerClient()`.
  - `src/routes/api/reading/**` y `api/ideas/**` — sesión via auth token; cubre `requireIntegrationOwner` server-side.
- `src/lib/server/reading-sync.ts` (86 líneas) — orquestador SIN tests, aunque sus dependencias sí los tienen.
- Estrategia probada para testear rutas TanStack Start en Vitest: NO importar el módulo de ruta (depende del runtime del framework). Extraer el cuerpo del handler a una función pura-ish en `src/lib/server/*` que reciba `(request, deps)` y dejar el handler como wrapper de 3 líneas.
- Mocking: Vitest `vi.mock()` estándar; sin librerías extra.

## Commands you will need

| Purpose          | Command                                           | Expected    |
| ---------------- | ------------------------------------------------- | ----------- |
| Tests            | `bun run test`                                    | todas pasan |
| Test puntual     | `bun run test -- src/lib/server/handlers.test.ts` | pasa        |
| Typecheck / Lint | `bun run typecheck && bun run check`              | exit 0      |

## Scope

**In scope**:

- `src/lib/server/alfred-handlers.ts` (crear) + `.test.ts`
- `src/lib/server/reading-sync-route.ts` (crear) + test (o ampliar `reading-sync.test.ts`)
- Los archivos de ruta correspondientes (solo para convertir handlers en wrappers)

**Out of scope**:

- Cambiar comportamiento de autorización (eso fue plan 009).
- Rutas con sesión de usuario (`/api/metadata/**`) — requieren token Convex real; fuera de alcance.

## Git workflow

- Branch: `codex/019-tests-handlers`
- Commit: `test(server): cubre autorización e idempotencia de handlers internos`

## Steps

### Step 1: Extraer lógica de sync route

Crea `src/lib/server/reading-sync-route.ts`:

```ts
export async function handleReadingSyncPost(
  request: Request,
  deps: {
    env: Record<string, string | undefined>;
    runReadingSync: typeof runReadingSync;
  },
): Promise<Response> {
  /* cuerpo actual del POST, leyendo env desde deps.env */
}
```

El handler de la ruta queda:

```ts
POST: async ({ request }) => handleReadingSyncPost(request, {
	env: process.env,
	runReadingSync,
}),
```

### Step 2: Extraer lógica Alfred

Igual con `src/lib/server/alfred-handlers.ts`: `handleAlfredPull(request, deps)` donde `deps = { env, convexMutation }`. Las tres rutas usan su wrapper. Mantén mensajes/status EXACTOS del plan 009.

**Verify** tras Steps 1-2: `bun run typecheck && bun run test && bun run check` → verde (comportamiento intacto).

### Step 3: Tests

`src/lib/server/alfred-handlers.test.ts` (y equivalente para sync):

1. Sin header de secreto → 401, cuerpo `{ error: "No autorizado." }`.
2. Secreto incorrecto → 401 idéntico al anterior (misma respuesta byte a byte).
3. Env incompleto (sin `ALFRED_NOTIFY_SECRET`) → 401 uniforme y `console.error` llamado (espiar con `vi.spyOn`).
4. Happy path → llama `convexMutation` con args correctos y devuelve 200 con el payload mockeado.
5. Sync route: env faltante → 503 `"Servicio no disponible."`; secreto malo → 401; secreto por Bearer → happy path con `runReadingSync` mockeado devolviendo resumen parcial (`errors` incluidos).

Modelo estructural: cualquier `*.test.ts` de `src/lib/server/`.

**Verify**: `bun run test -- src/lib/server` → ≥8 tests nuevos pasan.

## Test plan

- Los casos 1-5 arriba son la entrega.

## Done criteria

- [ ] Toda la lógica de autorización de endpoints internos vive en funciones testeadas
- [ ] ≥8 tests nuevos verdes; suite completa verde
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- La extracción requiere cambiar firmas públicas que otros módulos consuman (no debería: solo handlers).

## Maintenance notes

- Todo endpoint interno nuevo nace con su handler extraído + test de 401/503/happy.
