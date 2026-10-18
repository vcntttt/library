# Plan 024: Partir `providers.ts` en un módulo por proveedor

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- src/lib/metadata`
> Mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED (archivo compartido por server routes y Convex; mover con tests verdes entre pasos)
- **Depends on**: plans/009 y plans/010 (modifican este archivo — ejecutar después de ambos), plans/012 recomendado
- **Category**: tech-debt
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

`src/lib/metadata/providers.ts` tiene ~2865 líneas y ~106 funciones mezclando 10 proveedores (Google Books, Open Library, Apple Books, Amazon, TMDB, AniList, ManhwaWeb, MangaDex, MANGA Plus, Cubari) más rate-limit, caché, extracción de IDs y normalización. Cualquier cambio de metadatos navega el monolito entero. Es deuda de navegabilidad: solo lo importan server routes (`src/routes/api/metadata/**`) y `convex/notifications.ts`, así que no infla bundle.

## Current state

- API pública que DEBE conservarse estable (consumida fuera):
  - `searchMetadata` (`providers.ts:53`)
  - `getMangaReadingUrlDetails` (`:1109`)
  - `getMetadataDetails` (`:1180`)
  - `proxyManhwaWebImageUrl` (`:1623`)
  - `isAllowedManhwaWebImageUrl` (usada por `src/routes/api/metadata/image.ts`)
- Inventario parcial de funciones internas (verificado): extractores de ID por proveedor (`extractGoogleBookId`, `extractOpenLibraryBookId`, `extractAppleBookId`, `extractAmazonAsin`, `extractTmdbId`, `extractAnilistId`, `extractManhwaWebId`, `extractMangaDexTitleId`, `getCubariManifestUrl`...), helpers transversales (`normalizeTitle`, `normalizeUrlCandidate`, `parseChapterNumber`, `fetchJson/fetchWithLimits`).
- Tests existentes que fijan comportamiento: `src/lib/metadata/providers.test.ts`.
- Consumidores a preservar sin cambios: `src/routes/api/metadata/{search,details,image}.ts`, `convex/notifications.ts`.

## Commands you will need

| Purpose | Command                              | Expected    |
| ------- | ------------------------------------ | ----------- |
| Tests   | `bun run test -- src/lib/metadata`   | todas pasan |
| Gates   | `bun run typecheck && bun run check` | verde       |
| Build   | `bun run build`                      | exit 0      |

## Scope

**In scope**:

- `src/lib/metadata/providers/` (nuevo directorio; un archivo por proveedor + shared)
- `src/lib/metadata/providers.ts` → queda como fachada que re-exporta la API pública
- `src/lib/metadata/providers.test.ts` (solo si algún import interno cambia)

**Out of scope**:

- Cambiar comportamiento, URLs o parsing de ningún proveedor.
- Cambiar los consumidores ni las firmas públicas.
- Nuevas features de metadatos.

## Git workflow

- Branch: `codex/024-partir-proveedores`
- Commits: uno por proveedor extraído (`refactor(metadata): extrae proveedor AniList`, ...).

## Steps

### Step 1: Extraer transversales primero

Crea `src/lib/metadata/providers/shared.ts` con: tipos comunes, `normalizeTitle`, `normalizeUrlCandidate`, `parseChapterNumber`, fetchers (`fetchJson`, `fetchWithLimits`), rate-limit/caché. Los movimientos son cortar-pegar + imports internos.

**Verify**: suite metadata verde.

### Step 2: Extraer proveedores uno a uno

Orden sugerido (de menor acoplamiento a mayor, ajústalo leyendo dependencias reales):

```text
providers/amazon.ts        (extractAmazonAsin + fetch/scrape)
providers/apple-books.ts
providers/open-library.ts
providers/google-books.ts  (+ quota-error helpers)
providers/tmdb.ts          (+ getTmdbCreator)
providers/anilist.ts
providers/mangadex.ts      (+ pickMangaDexCandidate)
providers/manhwaweb.ts     (+ proxy/isAllowed image url fns)
providers/mangaplus.ts
providers/cubari.ts
```

Regla por commit: mueve las funciones del proveedor + sus tipos, importa transversales desde `./shared`, y `providers.ts` importa del módulo. NUNCA edites lógica mientras mueves.

**Verify** tras cada extracción: `bun run test -- src/lib/metadata && bun run typecheck` → verde.

### Step 3: Fachada final

`providers.ts` queda reducido a: imports desde `./providers/*` + `export { searchMetadata, getMetadataDetails, getMangaReadingUrlDetails, proxyManhwaWebImageUrl, isAllowedManhwaWebImageUrl }`. El orquestador `getMetadataDetails` puede vivir en `providers/index.ts` si su cuerpo es pura delegación.

**Verify**:

- `wc -l src/lib/metadata/providers.ts` → <150.
- `rg -n "from \"@/lib/metadata/providers\"" src convex` → consumidores intactos, sin tocarlos.
- `bun run build && bun run test && bun run check` → todo verde.

## Test plan

- La suite existente de metadata es la red completa; NO escribas tests nuevos de comportamiento en este plan (es movimiento puro).

## Done criteria

- [ ] Ningún archivo de proveedor >400 líneas
- [ ] API pública byte-compatible (mismos exports, mismas firmas)
- [ ] Todos los gates verdes; fila actualizada en `plans/README.md`

## STOP conditions

- Un proveedor resulta tener estado compartido mutable con otro (singletons cruzados): reporta el acoplamiento antes de romperlo.
- Los tests empiezan a requerir mocks nuevos para seguir pasando (señal de que el movimiento alteró algo).

## Maintenance notes

- Nuevo proveedor = archivo nuevo + registro en el orquestador; ya no se navega el monolito.
- Reviewer: muestrear 3 diffs de movimiento y confirmar pureza con diff de funciones.
