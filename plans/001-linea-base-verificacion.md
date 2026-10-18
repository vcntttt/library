# Plan 001: Dejar la línea base de verificación verde (typecheck, tsc y Vitest)

> **Instrucciones para el executor**: sigue el plan paso a paso. Ejecuta cada
> comando de verificación y confirma el resultado esperado antes de avanzar.
> Si ocurre algo de la sección "STOP conditions", detente y reporta — no
> improvises. Al terminar, actualiza la fila de este plan en `plans/README.md`.
>
> **Drift check (ejecutar primero)**: `git diff --stat 2d168eb..HEAD -- package.json tsconfig.json scripts/sync-convex-env.ts src/components/Header.tsx src/components/biblioteca-table.tsx src/components/explorar-grid.tsx src/components/ui/switch.tsx vite.config.ts`
> Si algún archivo in-scope cambió desde que se escribió el plan, compara los
> extractos de "Current state" con el código vivo; ante cualquier diferencia,
> trátalo como condición de STOP.

## Status

- **Priority**: P1 (prerrequisito de todos los demás planes)
- **Effort**: M
- **Risk**: MED (los cambios de `asChild` afectan render de dropdowns)
- **Depends on**: none
- **Category**: dx / bug
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

Hoy nadie verifica tipos en este repo: no existe script `typecheck`, no hay CI, y `bunx tsc --noEmit` falla con 7 errores reales. El único comando "verde" (`bun run check`, Biome) no mira tipos. Además, `bun run test` deja a Vitest colgado ~10 s al cerrar (`close timed out after 10000ms`) y `src/lib/metadata/providers.test.ts` falló por timeout en una corrida fría de cada dos. Todo plan posterior usa typecheck y tests como gates: esta línea base debe existir primero.

## Current state

- `package.json` — scripts actuales: `dev`, `dev:web`, `build`, `preview`, `test` (`vitest run --passWithNoTests`), `test:e2e*`, `format`/`lint`/`check` (Biome), `convex:dev`, `convex:push`, `reading:sync`, `secrets:*`, `deploy:*`. **No existe** `typecheck`.
- `tsconfig.json` — `strict: true`, `"types": ["vite/client"]`, paths `@/* → ./src/*` y `@convex/* → ./convex/*`.
- Salida real de `bunx tsc --noEmit` (verificada en `2d168eb`):

```text
scripts/sync-convex-env.ts(26,16): error TS2868: Cannot find name 'Bun'.
src/components/Header.tsx(43,19): error TS2339: Property 'requiresReadingAccess' does not exist ...
src/components/biblioteca-table.tsx(389,29): error TS2322: ... Property 'asChild' does not exist on type 'IntrinsicAttributes & Props<unknown>'.
src/components/biblioteca-table.tsx(508,34): error TS18047: 'value' is possibly 'null'.
src/components/biblioteca-table.tsx(531,29): error TS2322: ... 'asChild' ...
src/components/explorar-grid.tsx(308,29): error TS2322: ... 'asChild' ...
src/components/explorar-grid.tsx(427,34): error TS18047: 'value' is possibly 'null'.
src/components/ui/switch.tsx(1,34): error TS2307: Cannot find module '@radix-ui/react-switch' ...
```

- `scripts/sync-convex-env.ts:26` usa la global `Bun.spawn`; falta `@types/bun`.
- `Header.tsx:28-46`: `navItems` se declara `as const`; solo algunos ítems tienen `requiresReadingAccess: true`, y el filtro de la línea 43 accede a esa propiedad en todos.
- `biblioteca-table.tsx:388-390` y `531-533`, `explorar-grid.tsx:307-309`: patrón roto:

```tsx
<DropdownMenu>
	<DropdownMenuTrigger asChild>
		<Button type="button" variant="outline" className={...}>...</Button>
	</DropdownMenuTrigger>
```

La primitiva es Base UI (`src/components/ui/dropdown-menu.tsx:1` importa `@base-ui/react/menu`), que **no soporta `asChild`**: su API es `render`. `DropdownMenuTrigger` está definido así (líneas 20-23):

```tsx
function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}
```

- `biblioteca-table.tsx:506-512` y `explorar-grid.tsx:425-431`: dentro de `onValueChange={(value) => { const [key, direction] = value.split(":") ... }}` el tipo de `value` incluye `null`.
- `src/components/ui/switch.tsx:1` importa `@radix-ui/react-switch`, paquete que NO está en `package.json`. Verificado con `rg -l "ui/switch" src` → nadie importa este archivo.
- `vite.config.ts:10-42` — la config de Vite (que Vitest hereda) carga TODOS los plugins de la app: `nitro()`, `tanstackStart()`, `VitePWA`, `tailwindcss`, devtools. La sección `test` solo define `exclude: [...configDefaults.exclude, "e2e/**"]`. Sospechoso principal del cuelgue al cerrar: esos plugins dejan handles vivos en el proceso de test.

## Commands you will need

| Purpose           | Command             | Expected on success                                                                        |
| ----------------- | ------------------- | ------------------------------------------------------------------------------------------ |
| Instalar deps     | `bun install`       | exit 0                                                                                     |
| Typecheck (nuevo) | `bun run typecheck` | exit 0, sin errores                                                                        |
| Tests             | `bun run test`      | 97 passed y proceso termina sin `close timed out`                                          |
| Lint/format       | `bun run check`     | exit 0                                                                                     |
| E2E smoke         | `bun run test:e2e`  | specs pasan (requiere `.env.local` con credenciales E2E; si no existen, omite y repórtalo) |

## Scope

**In scope**:

- `package.json`
- `tsconfig.json`
- `vitest.config.ts` (crear)
- `scripts/sync-convex-env.ts`
- `src/components/Header.tsx`
- `src/components/biblioteca-table.tsx`
- `src/components/explorar-grid.tsx`
- `src/components/ui/switch.tsx` (eliminar)

**Out of scope**:

- Cualquier otro componente UI o migración Radix→Base UI adicional (solo los sitios con error de tsc).
- `vite.config.ts` de la app (no tocar plugins de build).
- Los tests existentes (no cambies aserciones).

## Git workflow

- Branch: `codex/001-linea-base-verificacion`
- Commits convencionales en español, uno por paso. Ejemplo del repo: `chore(deps): añade dependencias de Markdown y FSRS`.

## Steps

### Step 1: Agregar script `typecheck` y tipos de Bun

1. En `package.json` agrega: `"typecheck": "tsc --noEmit"` junto a `check`.
2. `bun add -d @types/bun`.
3. En `tsconfig.json`, cambia `"types": ["vite/client"]` por `"types": ["vite/client", "bun"]`.

**Verify**: `bun run typecheck` → el error de `scripts/sync-convex-env.ts(26)` desaparece (los otros 6 siguen).

### Step 2: Corregir `Header.tsx`

Opción mínima que conserva `as const`: agrega `requiresReadingAccess: false` a cada ítem de `navItems` que no tenga la propiedad (`"/"`, `/biblioteca` y los que falten). Todos los miembros quedan con la misma forma.

**Verify**: `bun run typecheck` → el error de `Header.tsx(43)` desaparece.

### Step 3: Convertir los tres `asChild` a la API `render` de Base UI

En `biblioteca-table.tsx:388` y `:531`, y `explorar-grid.tsx:307`, reemplaza:

```tsx
<DropdownMenuTrigger asChild>
	<Button type="button" variant="outline" className={cn(...)}>...</Button>
</DropdownMenuTrigger>
```

por la forma Base UI (el trigger compone sobre el elemento pasado en `render`):

```tsx
<DropdownMenuTrigger
	render={
		<Button type="button" variant="outline" className={cn(...)} />
	}
>
	{/* children visuales del botón, igual que antes */}
</DropdownMenuTrigger>
```

Mueve todo el contenido interno del `Button` a los children del trigger. No cambies classNames ni handlers.

**Verify**: `bun run typecheck` → desaparecen los errores `asChild` de ambos archivos. Además `rg -n "asChild" src/components/biblioteca-table.tsx src/components/explorar-grid.tsx` → 0 resultados.

### Step 4: Guardas de null en los `Select`

En `biblioteca-table.tsx:507` y `explorar-grid.tsx:426`, dentro de `onValueChange`, primera línea:

```tsx
if (!value) return;
```

antes del `value.split(":")`.

**Verify**: `bun run typecheck` → 0 errores en todo el repo.

### Step 5: Eliminar `src/components/ui/switch.tsx`

Verifica primero `rg -rn "ui/switch" src` → 0 resultados, luego borra el archivo.

**Verify**: `bun run typecheck && bun run check` → ambos exit 0.

### Step 6: Crear `vitest.config.ts` ligero y verificar salida limpia

Crea `vitest.config.ts` en la raíz con SOLO lo necesario para tests unitarios:

```ts
import { configDefaults, defineConfig } from "vitest/config";
import viteTsConfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
  plugins: [viteTsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});

export default config;
```

Vitest prioriza `vitest.config.ts` sobre `vite.config.ts`, así que los plugins pesados (nitro/start/PWA/tailwind/devtools) dejan de cargarse en tests. Ejecuta `bun run test` tres veces seguidas: debe pasar y terminar sin el mensaje `close timed out after 10000ms`. Cronometra: si antes tardaba ~15 s totales y ahora <10 s, es la señal esperada.

**Verify**: `bun run test` ×3 → 97 passed cada vez, sin texto `close timed out` en la salida.

## Test plan

- No se agregan tests nuevos: este plan repara la infraestructura de verificación.
- Regresión cubierta por la propia suite (97 tests deben seguir verdes).

## Done criteria

- [ ] `bun run typecheck` existe y exit 0
- [ ] `bunx tsc --noEmit` exit 0
- [ ] `bun run test` pasa 3 corridas seguidas sin `close timed out`
- [ ] `bun run check` exit 0
- [ ] `src/components/ui/switch.tsx` no existe
- [ ] `git status` no muestra archivos fuera del scope
- [ ] Fila del plan actualizada en `plans/README.md`

## STOP conditions

- Tras Step 3, un dropdown de Biblioteca/Explorar deja de abrirse al hacer clic (verifícalo con `bun run test:e2e` si hay credenciales, o repórtalo para revisión manual). La conversión `render` puede requerir ajuste fino de composición.
- `@types/bun` introduce nuevos errores de tsc en otros archivos.
- El cuelgue de Vitest persiste tras aislar los plugins (reporta qué reporter `hanging-process` señala).

## Maintenance notes

- Cuando agregues un nuevo script npm, documéntalo también en README y AGENTS.md (hoy están desincronizados; plan 018 lo aborda).
- Si se agregan tests de componentes React con jsdom, define `environment` por archivo o global en `vitest.config.ts`.
- Reviewer debe mirar especialmente los tres diffs de `asChild→render` y probar los menús desplegables.
