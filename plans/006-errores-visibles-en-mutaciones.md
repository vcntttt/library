# Plan 006: Mostrar los errores de mutaciones al usuario

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza
> tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- src/components/obra-status-picker.tsx src/routes/obra/\$obraId.tsx src/components/add-obra/obra-form.tsx src/components/add-obra-dialog.tsx`
> Mismatch = STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-linea-base-verificacion.md
- **Category**: bug / ux
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

Si Convex rechaza una mutación (red caída, "El progreso está controlado por la integración…", título inválido), el usuario no se entera: los handlers son async sin catch, el picker se cierra igual y la obra parece guardada/borrada cuando no lo fue. En el formulario de alta, el error queda atrapado en `errorMap.onSubmit` que nadie renderiza.

## Current state

- `src/components/obra-status-picker.tsx:82-158` — cuatro handlers async sin catch:

```ts
const handleStatusChange = async (nextStatus: ObraStatus) => {
  await updateObra({
    id: obra.id as Id<"obras">,
    patch: { status: nextStatus },
  });
  closePicker();
  // ...
};
```

Igual: `handleProgressChange`, `handleMarkUpToDate`, `handleSeasonProgressChange`, `handleFinishSeason`. Se invocan vía `onClick={() => handleStatusChange(s)}` (~línea 249).

- `src/routes/obra/$obraId.tsx` — `handleDelete` (~líneas 895-898) hace `await removeObra(...)` sin catch.
- `src/components/add-obra/obra-form.tsx:296-356` — handler de TanStack Form guarda el error en `errorMap.onSubmit`; **ninguna** parte del archivo renderiza errores del form (verifícalo con `rg -n "form.Subscribe|errors" src/components/add-obra/obra-form.tsx`).
- `src/components/add-obra-dialog.tsx:267-273` — `handleFormSubmit` cierra el diálogo tras `createObra(input)` sin capturar fallo.
- Patrón de banner de error existente para copiar estilo: `src/components/reading/reading-documents.tsx` (~líneas 41-46 muestra un mensaje de error inline). Úsalo como referencia visual; no lo modifiques.

## Commands you will need

| Purpose   | Command             | Expected    |
| --------- | ------------------- | ----------- |
| Typecheck | `bun run typecheck` | exit 0      |
| Tests     | `bun run test`      | todas pasan |
| Lint      | `bun run check`     | exit 0      |

## Scope

**In scope**:

- `src/components/obra-status-picker.tsx`
- `src/routes/obra/$obraId.tsx` (solo el handler de borrado)
- `src/components/add-obra/obra-form.tsx`
- `src/components/add-obra-dialog.tsx`

**Out of scope**:

- `obra-edit-sheet.tsx` (ya maneja errores; plan 005 toca otra cosa suya).
- Cualquier cambio en funciones Convex o mensajes de backend.

## Git workflow

- Branch: `codex/006-errores-visibles-mutaciones`
- Commit: `fix(ui): muestra errores de mutaciones en controles críticos`

## Steps

### Step 1: Errores en `obra-status-picker.tsx`

1. Añade estado local `const [actionError, setActionError] = useState<string | null>(null);`
2. Envuelve cada uno de los cinco handlers:

```ts
try {
	await updateObra({ ... });
} catch (error) {
	setActionError(error instanceof Error ? error.message : "No se pudo guardar.");
	return; // NO cerrar el picker ni abrir el diálogo de reseña
}
setActionError(null);
closePicker();
```

3. Renderiza `{actionError && <p className="text-sm text-destructive px-2 py-1">{actionError}</p>}` dentro del popover, sobre las opciones.
4. Limpia `actionError` al abrir el picker.

**Verify**: `bun run typecheck && bun run check` → exit 0.

### Step 2: Error en el borrado (`$obraId.tsx`)

En `handleDelete`, captura el fallo de `removeObra`, muéstralo con el mismo patrón textual del sheet (busca cómo `$obraId` ya muestra mensajes, si no hay banner previo usa un `<p className="text-destructive">`) y NO navegues fuera si falló:

```ts
try {
  await removeObra({ id });
  navigate({ to: "/" }); // o el navigate existente post-borrado
} catch (error) {
  setDeleteError(
    error instanceof Error ? error.message : "No se pudo eliminar.",
  );
}
```

### Step 3: Renderizar `errorMap` en el formulario de alta

En `obra-form.tsx`, añade bajo el último campo (antes del submit):

```tsx
<form.Subscribe selector={(state) => state.errorMap.onSubmit}>
  {(error) =>
    error ? (
      <p role="alert" className="text-sm text-destructive">
        {String(error)}
      </p>
    ) : null
  }
</form.Subscribe>
```

Y en `add-obra-dialog.tsx`, envuelve `createObra(input)` en try/catch: si falla, NO cierres el diálogo; muestra el mensaje (pásalo al form vía `form.setError({ fields: ..., form: "..." })` o un estado local del diálogo renderizado junto al footer).

**Verify**: `rg -n "errorMap" src/components/add-obra/obra-form.tsx` → ahora aparece también en el render.

## Test plan

- Verificación manual (forzar fallo): desconecta `VITE_CONVEX_URL` temporalmente o pide al operador simular un rechazo; alternativamente verifica leyendo que cada ruta de éxito pasa por `return` tras `catch`. La suite E2E existente cubre el camino feliz (crear/borrar obra), así que cualquier regresión ahí se detecta con `bun run test:e2e`.

## Done criteria

- [ ] Ninguno de los seis handlers listados queda sin catch (`rg -n "await updateObra|await removeObra|await createObra" <archivos>` — cada aparición envuelta en try/catch)
- [ ] Un fallo deja el control abierto con mensaje visible
- [ ] `bun run typecheck && bun run check && bun run test` exit 0
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- El picker/diálogo usa un mecanismo de cierre distinto al descrito y no puedes dejarlo abierto sin rediseño: reporta el mecanismo real.
- TanStack Form de la versión instalada no soporta `selector` en `form.Subscribe`: consulta la API instalada en `node_modules/@tanstack/react-form` y ajusta el render de errores.

## Maintenance notes

- Convención emergente: toda mutación disparada desde un control visible debe mostrar su error junto al control. Aplícala en reviews futuros.
- Si agregas más handlers al picker, reutiliza el mismo par estado+render, no banners globales.
