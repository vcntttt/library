# Plan 005: Autosave con patches de un solo campo

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza
> tu fila en `plans/README.md` al terminar.
>
> **Drift check (primero)**:
> `git diff --stat 3fec177..HEAD -- src/components/obra-edit-sheet.tsx convex/obras.ts`
> Mismatch = STOP.

## Status

- **Priority**: P1 (pérdida silenciosa de datos)
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001, plans/004 (re-basado sobre su commit `3fec177`)
- **Category**: bug
- **Planned at**: commit `3fec177`, 2026-08-22

## Why this matters

El sheet de edición guarda con debounce, pero cada timer envía un patch construido desde el snapshot COMPLETO de valores al momento de tipear. Si editas "Reseña" (timer de 700 ms) y dentro de esa ventana cambias "Fecha de inicio" (timer de 300 ms), la fecha se guarda primero y ~400 ms después llega el patch de reseña con la fecha VIEJA: sobrescribe en la base el valor recién guardado. La UI no se re-sincroniza (hay un gate de sesión), así que el usuario ve su fecha nueva mientras la DB tiene la antigua.

## Current state

- `src/components/obra-edit-sheet.tsx:120-155` — builders que devuelven TODOS los campos del grupo: `buildCustomPatch(values)` → `{ customTitle, customCreator, customYear, customCoverUrl }`; `buildFormatPatch(values)` → `{ format }` (ya de un campo); `buildPersonalPatch(values, obra)` → `{ readingUrl, sourceUrl, recommendedBy, startedAt, finishedAt, review }`.
- `src/components/obra-edit-sheet.tsx:293-318` — `savePatch(patch, { debounceKey, delayMs })`: cada `debounceKey` tiene su propio timer y su propio snapshot completo en `pendingSavePatches`.
- `src/components/obra-edit-sheet.tsx:335-343` — wrapper usado por los 12 call sites:

```ts
const updateValues = (
	nextValues: EditValues,
	patch: Record<string, unknown> | null,
	debounceKey: string,
	delayMs?: number,
) => {
	setValues(nextValues);
	savePatch(patch, { debounceKey, delayMs });
};
```

- Call sites (`rg -n "updateValues\\(" src/components/obra-edit-sheet.tsx`): cada campo usa SU clave como debounceKey — `customTitle`, `customCreator`, `customYear`, `customCoverUrl`, `readingUrl`, `sourceUrl`, `recommendedBy`, `startedAt`, `movieDate`, `finishedAt`, `review`. OJO:
  - `"movieDate"` (solo tipo película) alimenta DOS campos del builder (`startedAt` y `finishedAt` vía `movieWatchedAt`): su patch de un control debe incluir ambas claves.
  - `format` va debounced con `delayMs: 200` y builder propio de un campo — no tocar.
  - Grupos `"progress"` (600 ms) y `"quotes"` son multi-campo semánticamente acoplados (un mismo dominio de valor): quedan igual, fuera de este fix.
- `convex/obras.ts` — `update` filtra claves con `hasOwn(patch, ...)` (líneas ~189-396, helper ~661-665): claves ausentes NO se tocan. Verificado en `3fec177`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun run test` | todas pasan |
| Test nuevo | `bun run test -- src/components/obra-edit-sheet.test.ts` | pasa |
| Lint | `bun run check` | exit 0 |

## Scope

**In scope**:
- `src/components/obra-edit-sheet.tsx`
- `src/components/obra-edit-sheet.test.ts` o `src/lib/obra-edit-values.ts` + `.test.ts` (ver Step 1)

**Out of scope**:
- `convex/obras.ts` (el backend ya es correcto).
- `obra-status-picker.tsx`, `add-obra/**` (planes 006/007).
- Delays de debounce, grupos `progress`/`quotes`, UX.

## Git workflow

- Branch: `codex/005-autosave-por-campo`
- Commit: `fix(obras): autosave envía solo el campo editado`

## Steps

### Step 1: Builders con filtro de claves

Si mover los builders a un módulo sin React resulta necesario para testearlos (los archivos .tsx importan componentes), extráelos a `src/lib/obra-edit-values.ts` junto al tipo `EditValues` si convive ahí; importa desde el sheet. Es movimiento puro.

Modifica los dos builders problemáticos para aceptar claves a incluir:

```ts
function pickKeys<T extends object>(patch: T, keys: ReadonlyArray<keyof T>) {
	const out: Partial<T> = {};
	for (const key of keys) out[key] = patch[key];
	return out;
}

function buildCustomPatch(
	values: EditValues,
	only?: ReadonlyArray<"customTitle" | "customCreator" | "customYear" | "customCoverUrl">,
) {
	const full = { /* cuerpo actual sin cambios */ };
	return only ? pickKeys(full, only) : full;
}

function buildPersonalPatch(
	values: EditValues,
	obra: Obra,
	only?: ReadonlyArray<"readingUrl" | "sourceUrl" | "recommendedBy" | "startedAt" | "finishedAt" | "review">,
) {
	const full = { /* cuerpo actual sin cambios */ };
	return only ? pickKeys(full, only) : full;
}
```

### Step 2: Call sites de una clave por debounceKey

En cada call site debounced de campos custom/personales, pasa `only` según el debounceKey:

```ts
// antes
updateValues(nextValues, buildCustomPatch(nextValues), "customTitle");
// después
updateValues(nextValues, buildCustomPatch(nextValues, ["customTitle"]), "customTitle");
```

Mapa completo a aplicar (uno a uno, verifícalo leyendo cada sitio):

| debounceKey | only |
|---|---|
| customTitle / customCreator / customYear / customCoverUrl | [esa misma clave] |
| readingUrl / sourceUrl / recommendedBy / review | [esa misma clave] |
| startedAt (no-movie) | ["startedAt"] |
| movieDate (película) | ["startedAt", "finishedAt"] |
| finishedAt (no-movie) | ["finishedAt"] |

`format`, `progress`, `quotes` y los saves inmediatos SIN debounce quedan como están.

### Step 3: Tests de builders

Casos mínimos:

1. `buildPersonalPatch(v, obra, ["startedAt"])` devuelve objeto con SOLO `startedAt`.
2. Con `only` indefinido devuelve las 6 claves.
3. `buildCustomPatch(v, ["customYear"])` devuelve SOLO `customYear`.
4. `buildPersonalPatch(v, obra, ["startedAt", "finishedAt"])` devuelve exactamente esas dos.

**Verify**: `bun run test -- src/components/obra-edit-sheet` (o el módulo nuevo) → pasa; suite completa verde.

## Done criteria

- [ ] Ningún call site debounced de campos custom/personales envía patch multi-campo no solicitado
- [ ] Tests nuevos verdes; `bun run typecheck && bun run check && bun run test` exit 0
- [ ] Sin cambios en convex/, ni en delays, ni en progress/quotes
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Algún call site real no calza en el mapa de arriba (clave distinta, builder distinto): reporta el sitio exacto.
- Mover builders fuera del .tsx rompe imports por tipos circulares: reporta en vez de duplicar código.

## Maintenance notes

- Al agregar un campo personal nuevo: añadirlo al builder Y a su par debounceKey/`only`.
- Verificación manual (deferida al dueño por deployment compartido): editar Reseña y Fecha seguidas dentro de 700 ms y confirmar que ambos valores persisten tras refrescar.
