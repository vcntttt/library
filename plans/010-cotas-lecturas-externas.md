# Plan 010: Cotas de tamaño y timeout en lecturas externas y EPUB

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza
> tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- src/lib/metadata/providers.ts src/routes/api/metadata/image.ts src/routes/api/reading/context.ts src/lib/server/epub-context.ts`
> Mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (unas cotas mal elegidas rompen EPUBs grandes o portadas pesadas; usar topes generosos)
- **Depends on**: plans/001; recomendado después del plan 009 (mismo archivo `providers.ts`)
- **Category**: security / perf
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

Todas las lecturas externas y el procesamiento EPUB son ilimitados: `fetchJson` no tiene AbortSignal ni tope de tamaño, el scraping de Amazon lee HTML completo, el proxy de imágenes transmite el cuerpo upstream sin límite, la ruta de contexto EPUB carga el archivo entero en memoria, y el parser ZIP propio infla entradas sin límite de expansión. Respuestas hostiles o EPUBs artificiales pueden retener memoria/CPU de Nitro y degradar la app para todos. Superficie autenticada (y owner-only en lectura), así que es endurecimiento, no exposición crítica.

## Current state

- `src/lib/metadata/providers.ts` — `fetchJson` (~1238-1256): `const response = await fetch(url, ...); return await response.json();` sin timeout ni cota. `fetchAmazonBookHtml` (~1850): igual con HTML.
- `src/routes/api/metadata/image.ts:20-47` — proxy ManhwaWeb: valida content-type pero reenvía `upstream.body` completo.
- `src/routes/api/reading/context.ts:64-72` — `resolve(root, source.sourcePath)` + contención, luego `await readFile(absolutePath)` (EPUB completo a memoria).
- `src/lib/server/epub-context.ts:191-196`:

```ts
function readEntry(entries: Map<string, ZipEntry>, name: string) {
  const entry = entries.get(posix.normalize(name));
  if (!entry) return undefined;
  if (entry.method === 0) return Buffer.from(entry.data).toString("utf8");
  if (entry.method === 8) return inflateRawSync(entry.data).toString("utf8");
  return undefined;
}
```

`inflateRawSync` soporta `{ maxOutputLength }` (lanza `RangeError` al exceder).

## Commands you will need

| Purpose      | Command                                               | Expected    |
| ------------ | ----------------------------------------------------- | ----------- |
| Typecheck    | `bun run typecheck`                                   | exit 0      |
| Tests        | `bun run test`                                        | todas pasan |
| Test puntual | `bun run test -- src/lib/server/epub-context.test.ts` | pasa        |
| Lint         | `bun run check`                                       | exit 0      |

## Scope

**In scope**:

- `src/lib/metadata/providers.ts`
- `src/routes/api/metadata/image.ts`
- `src/routes/api/reading/context.ts`
- `src/lib/server/epub-context.ts`
- Tests: ampliar `src/lib/server/epub-context.test.ts`

**Out of scope**:

- Cambiar proveedores o sus URLs.
- El parser ZIP más allá del límite de inflado (ZIP64 quedó descartado tras revisión).

## Git workflow

- Branch: `codex/010-cotas-lecturas`
- Commit: `fix(server): cotas de tamaño y timeout en fetches externos y EPUB`

## Steps

### Step 1: Helper `fetchWithLimits` en providers.ts

Añade junto a `fetchJson`:

```ts
async function fetchWithLimits(
  url: string,
  init: RequestInit | undefined,
  options: { timeoutMs: number; maxBytes: number },
) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > options.maxBytes) {
    throw new Error("Respuesta demasiado grande.");
  }
  const reader = response.body?.getReader();
  if (!reader) return response;
  let total = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > options.maxBytes) {
      await reader.cancel();
      throw new Error("Respuesta demasiado grande.");
    }
    chunks.push(value);
  }
  return new Response(new Blob(chunks), {
    status: response.status,
    headers: response.headers,
  });
}
```

Constantes del módulo: `const FETCH_TIMEOUT_MS = 10_000; const FETCH_MAX_BYTES = 5 * 1024 * 1024;` (5 MB basta para JSON y HTML de libros).

Usa `fetchWithLimits` dentro de `fetchJson` y `fetchAmazonBookHtml`. Si algún otro `fetch` de providers apunta a APIs JSON (busca `rg -n "await fetch\\(" src/lib/metadata/providers.ts`), aplícalo también.

**Verify**: `bun run test -- src/lib/metadata/providers.test.ts` → sigue pasando (mocks existentes pueden necesitar ajuste mínimo si no devuelven body legible; ajusta SOLO los mocks).

### Step 2: Cota en proxy de imágenes

En `image.ts`, antes de responder:

```ts
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
```

Valida `contentLength` declarado (>10MB → 502 "Imagen demasiado grande.") y consume `upstream.body` con un reader que corte al superar el tope (misma mecánica del helper; puedes duplicar el bucle aquí para no exportar helpers entre capas UI/server).

### Step 3: Cota de EPUB en contexto

En `context.ts`, antes de `readFile`:

```ts
const statInfo = await stat(absolutePath);
if (statInfo.size > MAX_EPUB_BYTES) {
  return jsonError(
    "El archivo es demasiado grande para extraer contexto.",
    413,
  );
}
const epub = await readFile(absolutePath);
```

con `const MAX_EPUB_BYTES = 50 * 1024 * 1024;` e import de `stat` desde `node:fs/promises`.

### Step 4: Límite de inflado por entrada ZIP

En `readEntry`:

```ts
const MAX_ENTRY_BYTES = 10 * 1024 * 1024;
if (entry.method === 0) {
  if (entry.compressedSize > MAX_ENTRY_BYTES) return undefined;
  return Buffer.from(entry.data).toString("utf8");
}
if (entry.method === 8) {
  try {
    return inflateRawSync(entry.data, {
      maxOutputLength: MAX_ENTRY_BYTES,
    }).toString("utf8");
  } catch {
    return undefined;
  }
}
```

En el caller de `extractEpubContext`, una entrada que devuelve `undefined` ya se maneja como "sin contenido" — verifica eso leyendo el flujo y confirma que el resultado degradado es el esperado ("continúa sin contexto", según el design doc).

**Verify**: `bun run test -- src/lib/server/epub-context.test.ts` → pasa.

### Step 5: Test nuevo del límite de entrada

Amplía `epub-context.test.ts`: construye un buffer con una entrada method=8 cuyo `compressedSize` declarado supere `MAX_ENTRY_BYTES`... (si fabricar el fixture es complejo, exporta `MAX_ENTRY_BYTES` y prueba `readEntry` con un Map sintético: `{ method: 0, compressedSize: MAX+1, data: new Uint8Array(0) }` → `undefined`; y un caso válido method=0 pequeño → string).

**Verify**: `bun run test -- src/lib/server/epub-context.test.ts` → incluye ≥2 aserciones nuevas.

## Test plan

- Unitarios: readEntry con entradas sobre/p bajo el tope.
- Manual: abrir contexto de un EPUB real desde galería → funciona igual; subir imagen de portada manhwaweb normal → carga.

## Done criteria

- [ ] Ningún `fetch(` externo sin timeout/cota en `providers.ts` e `image.ts`
- [ ] `rg -n "AbortSignal.timeout" src/lib/metadata/providers.ts` ≥1
- [ ] `inflateRawSync` recibe `maxOutputLength`
- [ ] Gates verdes; fila actualizada en `plans/README.md`

## STOP conditions

- Algún proveedor real devuelve respuestas >5 MB legítimas (revisa cuál y sube SOLO esa cota con justificación).
- Los mocks existentes de providers.test.ts requieren reescritura mayor que un ajuste mínimo.

## Maintenance notes

- Cotas elegidas generosas a propósito; si ves truncamientos en logs, subirlas es un cambio de una línea.
- Cuando TanStack Start/Nitro exponga middleware global, estos topes podrían centralizarse; hoy viven cerca de cada consumo.
