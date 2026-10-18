# Plan 020: E2E smoke del área de lectura

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza
> tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- e2e src/routes/lectura.tsx src/routes/lectura`
> Mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (tests nuevos; no tocan producción)
- **Depends on**: plans/001; requiere que `E2E_TEST_EMAIL` SEA el `READING_INTEGRATION_OWNER_ID` para ver el área — si no lo es, los tests se saltan solos (ver Step 1)
- **Category**: tests
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

Las features más nuevas y de mayor churn —la integración KOReader completa (#9): `/lectura`, documentos, inbox, galería— no tienen ninguna prueba de navegador; solo se verifican a mano. El design doc pedía E2E de vínculo/progreso/reseña/curación. Este plan entrega la red mínima: navegación, gating owner-only y render de las cuatro superficies, sin tocar datos reales ni ejecutar syncs contra el filesystem.

## Current state

- `e2e/library-smoke.spec.ts` — patrón a seguir: `login(page)` helper (`e2e/helpers/auth.ts`), prefijo `[E2E ...]` para datos (`e2e/env.ts` exporta `TEST_RUN_PREFIX`), limpieza por UI con `deleteObraByTitle`.
- `playwright.config.ts` — `testDir: ./e2e`, baseURL `http://localhost:3100`, levanta dev server solo si no hay `E2E_BASE_URL`; carga `.env.local`.
- Rutas existentes: `/lectura` (layout), `/lectura/documentos`, `/lectura/inbox` (+ galería accesible desde ahí según navegación actual).
- Gating real ya cubierto por un test existente ("usuario sin acceso a lectura no ve sus enlaces").

## Commands you will need

| Purpose      | Command                              | Expected    |
| ------------ | ------------------------------------ | ----------- |
| E2E          | `bun run test:e2e`                   | specs pasan |
| Solo lectura | `bunx playwright test lectura-smoke` | pasa        |

## Scope

**In scope**:

- `e2e/lectura-smoke.spec.ts` (crear)
- `e2e/helpers/lectura.ts` (crear, si hace falta selector compartido)

**Out of scope**:

- Ejecutar "Sincronizar ahora" contra `READING_BOOKS_PATH` real (mutaría datos del propietario).
- Flujos de curación con fixtures EPUB (requiere cuenta owner + volumen dedicado; queda como follow-up).

## Git workflow

- Branch: `codex/020-e2e-lectura`
- Commit: `test(e2e): smoke del área de lectura`

## Steps

### Step 1: Skip condicionado

Al inicio del spec:

```ts
const readingEnabled = Boolean(process.env.E2E_READING_OWNER === "1");
test.skip(
  !readingEnabled,
  "Requiere cuenta E2E = READING_INTEGRATION_OWNER_ID",
);
```

Define en `.env.local` (documentar en el spec) `E2E_READING_OWNER=1` SOLO cuando la cuenta E2E sea la dueña. Nunca actives esto apuntando al deployment real con tu usuario personal.

### Step 2: Spec

Casos (todos post-`login(page)`):

1. `/lectura` renderiza su encabezado y navegación interna (usa roles/nombres reales de la UI, mismo estilo que library-smoke).
2. Navegar a Documentos → carga sin error visible (assert sobre heading o estado vacío).
3. Navegar a Inbox → idem.
4. Si existe enlace/botón a Galería → navegar y verificar render básico.
5. Sin acceso (nueva context sin login) → `/lectura` muestra el gate privado (complementa el test existente a nivel ruta directa).

Usa `getByRole` con nombres exactos en español tal como aparecen; NO inventes data-testid.

**Verify**: `bunx playwright test lectura-smoke` → pasa (o se salta limpio si no está habilitado).

### Step 3: Integración a la suite

Nada que registrar: Playwright corre todo `./e2e`. Confirma que `bun run test:e2e` completo sigue verde.

## Test plan

- Es el test plan.

## Done criteria

- [ ] Spec nuevo pasa (o skip documentado cuando no aplica)
- [ ] Suite E2E completa verde
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- La estructura de navegación de `/lectura` difiere tanto que los selectores no son estables: reporta la estructura real.

## Maintenance notes

- Follow-up natural: fixtures de EPUB/sidecar en tmpdir + owner E2E para probar inbox/curación de verdad.
