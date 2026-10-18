# Plan 103 (Dirección): Panel de health unificado (metadatos + último sync de lectura)

> Plan de DIRECCIÓN corto: spike pequeño con posible implementación directa.
> Actualiza tu fila en `plans/README.md`.

## Status

- **Priority**: P3
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: plans/001
- **Category**: direction
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

"¿Está sana mi biblioteca?" exige visitar dos lugares: `/health` (metadatos faltantes) y `/lectura` (errores y estado del último sync KOReader). El panel de health nació precisamente para el chequeo post-sync; unificar da un único punto de verificación, barato porque ambos lados ya existen.

## Grounding

- `src/routes/health.tsx` — panel que solo consulta `obras.list`.
- `convex/reading.ts:180` — `listSyncRuns` ya expone runs con errores; `readingSources.status` marca missing/error.
- Gating owner-only ya resuelto: patrón `requiresReadingAccess` en Header + `requireIntegrationOwner` server-side.

## Deliverable

Tarjeta "Último sync de lectura" en `/health`, visible SOLO para el dueño:

1. Estado del último run (`completed|partial|failed|running`), hace cuánto, contadores (procesados/cambiados/omitidos).
2. Si hay errores: top 3 rutas con error + enlace a `/lectura`.
3. Si no es dueño: la tarjeta no se renderiza (sin hueco).

## Steps

### Step 1: Query de agregación

Si `listSyncRuns` devuelve más de lo necesario, crea `reading.latestSyncRun` (owner-gated) devolviendo solo el último run + conteo de fuentes con problema (`by_user_status_updatedAt` con status missing/error).

### Step 2: Tarjeta UI

Componente `src/components/health/reading-sync-card.tsx` consumiendo la query; estados loading/empty/error consistentes con el resto del panel.

**Verify**: como owner, `/health` muestra la tarjeta con datos reales del último run; como usuario normal, no aparece.

## Done criteria

- [ ] Tarjeta visible solo para owner con datos correctos
- [ ] Gates verdes; fila actualizada en `plans/README.md`

## STOP conditions

- `listSyncRuns` resulta costoso de reutilizar y la query nueva duplica lógica frágil: reporta antes.
