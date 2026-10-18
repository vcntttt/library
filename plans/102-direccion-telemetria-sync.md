# Plan 102 (Dirección): Cierre operativo del sync de lectura — telemetría y E2E

> Plan de DIRECCIÓN/diseño: define qué es "error visible" del sync y cómo se
> verifica. Actualiza tu fila en `plans/README.md`.

## Status

- **Priority**: P3
- **Effort**: M-L (estimación gruesa)
- **Risk**: LOW-MED
- **Depends on**: plans/020 (E2E smoke base), plans/019 (handlers testeados)
- **Category**: direction / tests
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

El sync corre cada 5 minutos por job externo. Si un sidecar empieza a fallar o el volumen se desmonta, el progreso deja de actualizarse silenciosamente: nadie se entera salvo notando a mano que algo falta. La fase 6 del design doc ("telemetría de errores, E2E") quedó sin entregar cuando se cerró #9.

## Grounding

- `docs/plans/2026-07-22-reading-integration-design.md:237` — fase 6 declarada y parcialmente abierta.
- Hoy los errores por archivo viven en `readingSyncRuns.errors` visibles solo en `/lectura`; la ruta interna hace `console.error` (`api/internal/reading/sync.ts`).
- Pipeline de entrega a Alfred ya existe (`ALFRED_NOTIFY_*`, cola en Convex) — reutilizable para alertar.

## Deliverable

`docs/plans/2026-MM-DD-sync-telemetria-design.md` + implementación en fases:

1. Definir umbrales de alerta: p. ej. "sync failed completo", "≥N archivos con error en M runs consecutivos", "volumen ausente" (`readingSources.status="missing"` masivo).
2. Superficie: tarjeta persistente en `/lectura` (ya existe parcialmente) vs notificación Alfred push vs ambas. Recomendación inicial: Alfred para fallos duros, UI para degradaciones.
3. Anti-ruido: deduplicación por firma de error y ventana mínima entre alertas.
4. E2E con fixtures: tmpdir con EPUB+sidecar válido y uno corrupto → sync manual desde UI → assert de resumen parcial y superficie de error.

## Steps

### Step 1: Auditoría de estados actuales

Inventaria qué información ya existe (`readingSyncRuns.status/errors`, `readingSources.status/lastError`) y qué falta para cada umbral propuesto.

### Step 2: Diseño y decisión

Documento con recomendación única por pregunta. Decidir con el dueño.

### Step 3: Implementación por fases

Ticket 1: detección de umbral en `finishSyncRun`. Ticket 2: enqueue de alerta Alfred. Ticket 3: E2E con fixtures.

## Done criteria

- [ ] Doc de diseño decidido
- [ ] (Fases posteriores) alerta real y E2E verdes
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- El bot Alfred no puede recibir un nuevo tipo de evento sin cambios en `~/dev/alfred`: coordinar antes de diseñar el payload.
