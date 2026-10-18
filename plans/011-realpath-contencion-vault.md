# Plan 011: Canonicalizar symlinks en la contención de rutas del vault y lectura

> **Instrucciones**: pasos + verificación. Actualiza tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- src/lib/server/idea-files.ts src/routes/api/reading/context.ts`
> Mismatch = STOP.

## Status

- **Priority**: P3 (hardening; sin exploit directo hoy)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001
- **Category**: security
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

La contención de rutas se valida con `resolve` + `relative`, que NO siguen symlinks: un `.md` dentro de `Ideas/` enlazado simbólicamente fuera del vault, o un EPUB enlazado fuera de `READING_BOOKS_PATH`, pasaría el check y sería leído/escrito fuera del confinamiento previsto. Los paths vienen de escaneos locales o mutaciones owner-only, así que el riesgo real es bajo — es cerrar barato una defensa que ya intenta existir.

## Current state

- `src/lib/server/idea-files.ts:101-116`:

```ts
function resolveIdeaPath(vaultPath: string, relativePath: string) {
  const vaultRoot = resolve(vaultPath);
  const ideasRoot = getIdeasRoot(vaultPath);
  const candidate = resolve(vaultRoot, relativePath);
  const candidateRelativeToIdeas = relative(ideasRoot, candidate);
  if (
    !candidateRelativeToIdeas ||
    candidateRelativeToIdeas.startsWith(`..${sep}`) ||
    candidateRelativeToIdeas === ".." ||
    candidateRelativeToIdeas.includes(`${sep}.${sep}`) ||
    extname(candidate).toLowerCase() !== ".md"
  ) {
    throw new Error("La ruta de la idea no es válida.");
  }
  return candidate;
}
```

- `src/routes/api/reading/context.ts:64-71`: mismo patrón (`resolve` + `startsWith`) antes de `readFile`.
- Tests de referencia para fixtures temporales: `src/lib/server/idea-files.test.ts` no existe, pero `src/lib/server/reading-files.test.ts` sí y usa archivos temporales — úsalo como patrón.

## Commands you will need

| Purpose      | Command                          | Expected    |
| ------------ | -------------------------------- | ----------- |
| Typecheck    | `bun run typecheck`              | exit 0      |
| Tests        | `bun run test`                   | todas pasan |
| Test puntual | `bun run test -- src/lib/server` | pasa        |

## Scope

**In scope**:

- `src/lib/server/idea-files.ts` (solo `resolveIdeaPath` y su caller de escritura si aplica)
- `src/routes/api/reading/context.ts` (solo el bloque de contención)
- `src/lib/server/idea-files.test.ts` (crear)

**Out of scope**:

- `reading-files.ts` (escaneo local, sin input de red).
- Cambiar mensajes ni códigos de error.

## Git workflow

- Branch: `codex/011-realpath-contencion`
- Commit: `fix(server): canonicaliza symlinks en contención de rutas`

## Steps

### Step 1: `resolveIdeaPath` con realpath

```ts
import { realpath } from "node:fs/promises"; // o realpathSync según uso actual

async function resolveIdeaPath(vaultPath: string, relativePath: string) {
  // ...validaciones actuales idénticas...
  try {
    const realCandidate = await realpath(candidate);
    const realIdeasRoot = await realpath(ideasRoot);
    const contained = relative(realIdeasRoot, realCandidate);
    if (
      contained.startsWith(`..${sep}`) ||
      contained === ".." ||
      isAbsolute(contained)
    ) {
      throw new Error("La ruta de la idea no es válida.");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Archivo nuevo aún inexistente: canonicalizar el directorio padre.
      const realParent = await realpath(dirname(candidate));
      if (!realParent.startsWith(await realpath(ideasRoot))) {
        throw new Error("La ruta de la idea no es válida.");
      }
    } else if (
      error instanceof Error &&
      error.message.includes("no es válida")
    ) {
      throw error;
    } else {
      throw error;
    }
  }
  return candidate;
}
```

Ajusta los callers a `await resolveIdeaPath(...)` (deben ser async-capables; revisa cuántos son con `rg -n "resolveIdeaPath" src/lib/server/idea-files.ts`).

**Verify**: `bun run typecheck` → exit 0.

### Step 2: Contención en `context.ts`

Antes de `readFile`:

```ts
const [realRoot, realFile] = await Promise.all([
  realpath(absoluteRoot),
  realpath(absolutePath),
]);
if (!realFile.startsWith(`${realRoot}${sep}`)) {
  return jsonError("La fuente de lectura no es válida.", 400);
}
```

(mantén también el check lógico previo; este es el segundo candado).

### Step 3: Test con symlink

Crea `src/lib/server/idea-files.test.ts` (patrón: `mkdtempSync` como en `reading-files.test.ts`):

1. Crea vault temporal con `Ideas/a.md` y un archivo externo `secreto.md` FUERA del vault.
2. Crea symlink `Ideas/link.md → secreto.md` (`symlinkSync`).
3. `await expect(resolveIdeaPath(vault, "Ideas/link.md")).rejects.toThrow("no es válida")` — exporta `resolveIdeaPath` si es necesario (es interno; exportar para test es aceptable).
4. Caso feliz: `Ideas/a.md` resuelve sin lanzar.
5. En Windows este test puede saltarse (`test.skipIf(process.platform === "win32")`) — este repo corre en Linux.

**Verify**: `bun run test -- src/lib/server/idea-files.test.ts` → pasa.

## Test plan

- Los 5 casos del Step 3.

## Done criteria

- [ ] Ambos puntos de contención canonicalizan con realpath
- [ ] Test de symlink verde
- [ ] Gates verdes; fila actualizada en `plans/README.md`

## STOP conditions

- El flujo de escritura de ideas crea directorios intermedios y `realpath` del padre falla por otra razón distinta a ENOENT.

## Maintenance notes

- Regla: toda contención nueva de rutas usa realpath de raíz Y candidato/padre.
