# Plan 003: Hacer la cola de notificaciones a prueba de filas venenosas, con GC y sin re-escaneo

> **Instrucciones para el executor**: sigue los pasos, verifica cada uno. Ante
> STOP conditions, detente y reporta. Actualiza tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- convex/notifications.ts convex/crons.ts convex/lib/notifications.ts convex/schema.ts`
> Mismatch con "Current state" = STOP.

## Status

- **Priority**: P1 (fiabilidad de datos en tránsito)
- **Effort**: M
- **Risk**: LOW-MED (toca la cola que entrega notificaciones de Alfred)
- **Depends on**: plans/001-linea-base-verificacion.md (no tocar el mismo archivo en paralelo con el plan 004; ejecutar antes o después, no simultáneo)
- **Category**: bug / perf
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

Tres defectos encadenados en `convex/notifications.ts`:

1. **Fila venenosa**: `pull` marca cada candidato como `processing` y luego llama `toPayload(row)` sin try/catch; `toPayload` lanza ante eventos legacy malformados (`convex/notifications.ts:709-710` y `726-727`: `"Evento de episodio inválido."` / `"Evento de manga inválido."`). Al lanzar, la mutación aborta a mitad del loop y la fila vuelve a cabeza de cola para siempre → las notificaciones de Alfred se bloquean permanentemente.
2. **Reintentos sin tope**: `ack` con estado `failed` devuelve la fila a `pending` sin límite de intentos (`convex/notifications.ts:290-298`).
3. **Sin GC + re-escaneo**: no existe ningún `delete` de `notificationEvents` en el repo (los eventos entregados se acumulan forever), y `backfillLegacyEventOwners` —que corre dentro de cada `pull` (`notifications.ts:223`)— guarda cursor `undefined` al terminar (`:826`), así que cada poll re-pagina la tabla completa.

## Current state

- `convex/notifications.ts:214-271` — `pull`: recupera candidatos `pending` ordenados `asc`, por cada uno hace `patch(status:"processing", attempts+1, lease...)` y luego `events.push({ ..., payload: toPayload(row) })` (líneas 252-266). Sin try/catch.
- `convex/notifications.ts:700-735` — `toPayload` lanza si falta `anilistId`/`chapter`/`externalId`/`episode` o si un evento manga tiene `source === "tmdb"`. Los datos legacy existen: `backfillLegacyEventOwners` (`:805-828`) existe justamente para parchear eventos viejos sin `userId`.
- `convex/notifications.ts:273-298` — `ack`: `status==="failed"` → patch a `pending`, `lastError`, sin tope de intentos.
- Constantes del módulo (líneas 27-33): `DEFAULT_POLL_LIMIT=10`, `MAX_POLL_LIMIT=50`, `EVENT_LEASE_MS`, `LEGACY_BACKFILL_BATCH_SIZE=50`.
- `convex/crons.ts` completo hoy:

```ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "check manga releases",
  { hours: 2 },
  internal.notifications.checkForNewChapters,
  {},
);
crons.interval(
  "check episodic releases",
  { hours: 2 },
  internal.notifications.checkForNewEpisodes,
  {},
);

export default crons;
```

- Índices relevantes en `convex/schema.ts:130-133`: `by_eventId ["eventId"]`, `by_status_createdAt ["status","createdAt"]`, `by_user_status_createdAt ["userId","status","createdAt"]`.
- Convención del repo: helpers puros van en `convex/lib/*.ts` con tests al lado (`convex/lib/obras.test.ts` es el patrón); mensajes de error user-facing en español; timestamps con `Date.now()`.

## Commands you will need

| Purpose                                    | Command                                            | Expected                                                 |
| ------------------------------------------ | -------------------------------------------------- | -------------------------------------------------------- |
| Typecheck                                  | `bun run typecheck`                                | exit 0                                                   |
| Tests                                      | `bun run test`                                     | todas pasan incl. las nuevas                             |
| Test puntual                               | `bun run test -- convex/lib/notifications.test.ts` | pasa                                                     |
| Lint                                       | `bun run check`                                    | exit 0                                                   |
| Push schema (solo si Step 5 cambia schema) | `bun run convex:push`                              | push OK — **coordinar: dev y prod comparten deployment** |

## Scope

**In scope**:

- `convex/notifications.ts`
- `convex/crons.ts`
- `convex/lib/notifications.ts` (helpers puros existentes; añadir los nuevos aquí)
- `convex/lib/notifications.test.ts`
- `convex/schema.ts` (solo si eliges la variante con literal `"discarded"`; ver Step 1)

**Out of scope**:

- Rutas HTTP de Alfred (`src/routes/internal/alfred/**`) — las cubre el plan 009.
- `checkForNewChapters` / `checkForNewEpisodes` (lógica de detección).
- Cualquier cambio de formato del payload entregado a Alfred.

## Git workflow

- Branch: `codex/003-cola-notificaciones`
- Commits: `fix(notificaciones): descarta eventos venenosos y limita reintentos`, `perf(notificaciones): GC diario y backfill con marca de término`.

## Steps

### Step 1: Helper puro de decisión de reintento/descarte

En `convex/lib/notifications.ts` añade:

```ts
export const MAX_EVENT_ATTEMPTS = 10;

// Devuelve "discard" cuando la fila debe salir definitivamente de la cola.
export function shouldDiscardEvent(attempts: number) {
  return attempts >= MAX_EVENT_ATTEMPTS;
}
```

Tests en `convex/lib/notifications.test.ts` (patrón del archivo existente): límite exacto, límite-1, 0.

**Verify**: `bun run test -- convex/lib/notifications.test.ts` → pasa.

### Step 2: Blindar el loop de `pull`

En `pull` (líneas 250-267), envuelve la construcción del payload:

```ts
for (const row of candidates) {
  const attempts = row.attempts + 1;
  try {
    const payload = toPayload(row);
    await ctx.db.patch(row._id, {
      status: "processing",
      attempts,
      lastAttemptAt: now,
      leaseExpiresAt: now + EVENT_LEASE_MS,
      updatedAt: now,
    });
    events.push({
      eventId: row.eventId,
      attempts,
      lastAttemptAt: now,
      payload,
    });
  } catch (error) {
    await ctx.db.patch(row._id, {
      status: "delivered",
      attempts,
      lastAttemptAt: now,
      deliveredAt: now,
      lastError: `evento-invalido: ${error instanceof Error ? error.message : "desconocido"}`,
      leaseExpiresAt: undefined,
      updatedAt: now,
    });
  }
}
```

Decisión de diseño: `delivered` + `lastError` con prefijo `evento-invalido:` significa **descartado** (sale de la cola, queda auditorable). No cambies el validador del schema.

**Verify**: `bun run typecheck && bun run check` → exit 0.

### Step 3: Topar reintentos en `ack`

En `ack` (líneas 289-298), rama `failed`:

```ts
if (status === "failed") {
  if (shouldDiscardEvent(event.attempts)) {
    await ctx.db.patch(event._id, {
      status: "delivered",
      leaseExpiresAt: undefined,
      deliveredAt: now,
      lastError: error?.trim() || "error-desconocido",
      updatedAt: now,
    });
  } else {
    await ctx.db.patch(event._id, {
      status: "pending",
      leaseExpiresAt: undefined,
      lastError: error?.trim() || "error-desconocido",
      updatedAt: now,
    });
  }
  return {
    ok: true,
    status: shouldDiscardEvent(event.attempts)
      ? ("delivered" as const)
      : ("pending" as const),
  };
}
```

**Verify**: `bun run typecheck` → exit 0.

### Step 4: Marca de término para el backfill legacy

En `backfillLegacyEventOwners` (líneas 805-828):

1. Antes de paginar, salta si ya terminó:

```ts
const state = await findWorkerState(ctx, userId, "legacy-events");
if (state?.cursor === LEGACY_BACKFILL_DONE) return;
```

2. Define arriba del archivo: `const LEGACY_BACKFILL_DONE = "__done__";`
3. Cambia el guardado final:

```ts
await saveWorkerCursor(
  ctx,
  userId,
  "legacy-events",
  result.isDone ? LEGACY_BACKFILL_DONE : result.continueCursor,
);
```

**Verify**: `rg -n "isDone \\? undefined" convex/notifications.ts` → 0 resultados.

### Step 5: GC diario de eventos entregados

1. En `convex/notifications.ts` añade:

```ts
export const purgeDeliveredEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - EVENT_RETENTION_MS;
    let deleted = 0;
    for (;;) {
      const batch = await ctx.db
        .query("notificationEvents")
        .withIndex("by_status_createdAt", (q) =>
          q.eq("status", "delivered").lte("createdAt", cutoff),
        )
        .take(PURGE_BATCH_SIZE);
      if (batch.length === 0) break;
      for (const row of batch) await ctx.db.delete(row._id);
      deleted += batch.length;
      if (batch.length < PURGE_BATCH_SIZE) break;
    }
    return { deleted };
  },
});
```

Con constantes nuevas junto a las existentes: `const EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;` y `const PURGE_BATCH_SIZE = 500;`.

2. En `convex/crons.ts` registra:

```ts
crons.interval(
  "purge delivered notification events",
  { hours: 24 },
  internal.notifications.purgeDeliveredEvents,
  {},
);
```

Nota: el índice `by_status_createdAt` NO está scoping por usuario a propósito — solo borra eventos `delivered` vencidos, que son datos terminados de todos los usuarios.

**Verify**: `bun run typecheck && bun run check` → exit 0. `rg -n "purgeDeliveredEvents" convex/crons.ts` → 1 resultado.

### Step 6: Tests unitarios nuevos

En `convex/lib/notifications.test.ts` agrega casos para `shouldDiscardEvent`. Si extraes alguna otra decisión pura durante los pasos (p. ej. formateo del `lastError`), testeala aquí también.

**Verify**: `bun run test` → todas pasan, incluye ≥4 aserciones nuevas.

## Test plan

- Unitarios: `shouldDiscardEvent` (frontera 9/10/11).
- La mecánica de `pull`/`ack` depende de Convex runtime y no tiene harness de mutaciones aún (plan 012 lo construye); la verificación funcional de este plan es typecheck + suite + revisión del diff contra los extractos.

## Done criteria

- [ ] `bun run typecheck && bun run check && bun run test` exit 0
- [ ] `toPayload` nunca puede abortar `pull` (try/catch por fila)
- [ ] Ninguna fila puede quedar `pending` con `attempts >= 10`
- [ ] El backfill no re-pagina la tabla una vez marcado `__done__`
- [ ] Cron diario de purga registrado
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- El schema de `notificationEvents` cambió respecto al drift check (nuevos estados literales, etc.).
- Descubres que algún consumidor interpreta `delivered` como "entregado con éxito" y usaría `lastError` para lógica (revisa `markRead` y el cliente Alfred en `~/dev/alfred` antes de asumir).

## Maintenance notes

- La retención es de 30 días: si Alfred necesita histórico más largo, sube `EVENT_RETENTION_MS`.
- Cuando exista el harness de mutaciones (plan 012), caracterizar el loop completo de `pull` con una fila venenosa real.
- Reviewer: verificar que el patch de descarte conserva `eventId` original y que `events` nunca incluye la fila descartada.
