# Plan 007: Guardias para respuestas async fuera de tiempo

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza
> tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- src/components/add-obra-dialog.tsx src/components/reading/reading-gallery.tsx`
> Mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-linea-base-verificacion.md
- **Category**: bug
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

Dos flujos aplican la respuesta de un fetch aunque la selección haya cambiado mientras volaba: en "Agregar obra", elegir resultado A y luego B rápido puede prellenar el formulario con los metadatos de A (obra creada con ficha de otra, sin indicio visible); en la galería de lectura, el contexto EPUB mostrado bajo una anotación puede corresponder a otra.

## Current state

- `src/components/add-obra-dialog.tsx:230-265` — `handleSelectResult(result)`: setea `selectedMetadata`, hace `fetch("/api/metadata/details?...")` y al final aplica sin guardia:

```ts
const payload = await response.json();
const details = payload?.details as MetadataDetails | undefined;
if (details) setMetadataDetails(details);
```

No hay AbortController ni comparación con la selección vigente.

- El mismo archivo YA tiene el patrón correcto para la búsqueda (~líneas 122-125): un `AbortController` por búsqueda que se aborta al iniciar otra. Sigue ese estilo.
- `src/components/reading/reading-gallery.tsx:184-226` — seleccionar otra anotación limpia `context` (líneas 184-195), pero `handleLoadContext` (197-226) capturó la anotación previa y su `setContext(payload)` puede aterrizar después: contexto equivocado bajo la anotación B.
- Convención: componentes con estado local + hooks; sin librerías de data-fetching adicionales.

## Commands you will need

| Purpose   | Command             | Expected    |
| --------- | ------------------- | ----------- |
| Typecheck | `bun run typecheck` | exit 0      |
| Tests     | `bun run test`      | todas pasan |
| Lint      | `bun run check`     | exit 0      |

## Scope

**In scope**:

- `src/components/add-obra-dialog.tsx`
- `src/components/reading/reading-gallery.tsx`

**Out of scope**:

- Las rutas API ni el proveedor de metadatos.
- Cualquier otro fetch del repo.

## Git workflow

- Branch: `codex/007-guardias-async`
- Commit: `fix(ui): descarta respuestas async de selecciones obsoletas`

## Steps

### Step 1: Guardia en `add-obra-dialog.tsx`

1. Añade una ref de versión de selección:

```ts
const selectionTokenRef = useRef(0);
```

2. En `handleSelectResult`, primera línea tras setear estados: `const token = ++selectionTokenRef.current;`
3. Antes de aplicar:

```ts
if (token !== selectionTokenRef.current) return; // llegó tarde
if (details) setMetadataDetails(details);
```

4. Aplica también la guardia al `catch`: si llegó tarde, no setees `setMetadataError` (un error viejo no debe ensuciar la selección nueva).
5. Alternativa válida si prefieres simetría con la búsqueda: `AbortController` por selección guardado en ref y `abort()` al iniciar otra. Elige UNA variante y sé consistente dentro del archivo.

**Verify**: `bun run typecheck && bun run check` → exit 0.

### Step 2: Guardia en `reading-gallery.tsx`

En `handleLoadContext`: captura `const annotationId = selectedAnnotation?.id` al inicio (o el identificador equivalente que use el componente) y, tras el await:

```ts
if (selectedAnnotation?.id !== annotationId) return; // cambió la selección
setContext(payload);
```

Si el componente mantiene la anotación en estado con otra forma (`sourceKey`, índice), usa ese identificador estable.

**Verify**: revisión del diff: ambas guardias presentes; suite verde.

## Test plan

- Sin test automatizado nuevo: reproducir requiere latencia controlada de red. Verificación manual:
  1. En "Agregar obra" (con red throttled desde DevTools), elige A, luego B inmediatamente → el paso 3 debe mostrar datos de B siempre.
  2. En galería, abre contexto de anotación A y cambia rápido a B → bajo B nunca aparece texto de A.

## Done criteria

- [ ] Ambos handlers descartan respuestas tardías (diff lo muestra)
- [ ] `bun run typecheck && bun run check && bun run test` exit 0
- [ ] Verificación manual hecha
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- La estructura real de los handlers difiere (p. ej. ya existe algún guard parcial): adapta el mínimo y documenta; si el fix requeriría refactor grande, reporta.

## Maintenance notes

- Regla nueva para reviews: todo `setState` después de un `await` que depende de una selección debe tener guardia de vigencia o abort.
