# Plan 022: Code-splitting de `/ideas` (react-markdown fuera del chunk inicial)

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- src/routes/ideas.tsx src/router.tsx vite.config.ts`
> Mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001
- **Category**: perf
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

`react-markdown` + `remark-gfm` (~30-40 KB gzip) se importan estáticamente en la ruta `/ideas`, su única superficie de uso en todo el repo, mientras la ruta crítica es la Biblioteca. Si el auto code-splitting del router no está activo, ese peso se paga en cada carga inicial.

## Current state

- `src/routes/ideas.tsx:6-7`: imports estáticos de ambos paquetes (verifica con `rg -n "react-markdown|remark-gfm" src` que no haya otro consumidor).
- `src/router.tsx`: `createRouter({ routeTree, context: {}, scrollRestoration: true, defaultPreloadStaleTime: 0 })` — sin config de code-splitting.
- El plugin de TanStack Router soporta `autoCodeSplitting` (según versión instalada); alternativa garantizada: `React.lazy` del componente que renderiza Markdown.

## Commands you will need

| Purpose    | Command                                                                | Expected                                      |
| ---------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| Build      | `bun run build`                                                        | exit 0                                        |
| Inspección | `rg -l "remark" .output/dist 2>/dev/null \| head; ls dist 2>/dev/null` | react-markdown en chunk separado, NO en entry |
| Gates      | `bun run typecheck && bun run test && bun run check`                   | verde                                         |

## Scope

**In scope**: `src/routes/ideas.tsx`, `src/router.tsx` o `vite.config.ts` (solo una de las dos vías), componente wrapper nuevo si aplica.

**Out of scope**: otras rutas o librerías.

## Git workflow

- Branch: `codex/022-split-ideas`
- Commit: `perf(ideas): carga react-markdown con lazy chunk`

## Steps

### Step 1: Medir antes

`bun run build` → anota si el bundle entry incluye react-markdown (`rg -l "remarkGfm\|remark-gfm" <dir de salida>`; identifica el directorio real de salida del build primero).

### Step 2: Aplicar UNA vía

- **Vía A (preferida)**: activa `autoCodeSplitting` según doc de la versión instalada (en TanStack Router plugin moderno es opción del plugin/vite). Verifica build.
- **Vía B (garantizada)**: extrae el render de Markdown a `src/components/idea-markdown.tsx` y cárgalo con `lazy(() => import("@/components/idea-markdown"))` + `<Suspense fallback={<Skeleton/>}>` en ideas.

### Step 3: Medir después

Repite Step 1: react-markdown debe vivir en un chunk aparte cargado solo al entrar a /ideas.

**Verify**: navegación manual a /ideas renderiza Markdown igual; resto de la app no descarga ese chunk (pestaña Network).

## Test plan

- Suite + verificación visual/Network.

## Done criteria

- [ ] Entry sin react-markdown
- [ ] /ideas funcional
- [ ] Gates verdes; fila actualizada en `plans/README.md`

## STOP conditions

- Ninguna de las dos vías separa el chunk (build config anómala): reporta output del build.

## Maintenance notes

- Si mañana otras vistas renderizan Markdown, reutilizar el mismo lazy component.
