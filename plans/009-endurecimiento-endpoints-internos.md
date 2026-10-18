# Plan 009: Endurecer endpoints internos y fetch externo (secreto en tiempo constante, errores genéricos, SSRF Amazon)

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza
> tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- src/lib/server/http.ts src/routes/internal/alfred src/routes/api/internal/reading/sync.ts src/lib/metadata/providers.ts convex/notifications.ts`
> Mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (tocar auth de endpoints; el cambio de redirect puede afectar búsquedas legítimas de Amazon)
- **Depends on**: plans/001, plans/002 (con registro cerrado la superficie queda menos expuesta), plans/003 (no tocar `assertAlfredSecret` en paralelo con 003)
- **Category**: security
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

Tres debilidades del mismo tipo —superficies de servicio— corregidas juntas:

1. **SSRF parcial en Amazon**: `extractAmazonAsin` acepta hosts vecinos (`evil-amazon.com`) porque usa `hostname.endsWith("amazon.com")`, y `fetchAmazonBookHtml` sigue redirects a cualquier destino. Un usuario autenticado puede hacer que el servidor consulte URLs elegidas por él y ver fragmentos reflejados.
2. **Comparación de secretos no constante**: las rutas Alfred y `assertAlfredSecret` comparan strings con `!==`; el propio repo ya usa `timingSafeEqual` en el sync de lectura.
3. **Filtración de configuración pre-auth**: los endpoints responden qué variable falta (`"Falta configurar READING_SYNC_SECRET."` → 503) y distinguen "sin secreto configurado" (500) de "secreto incorrecto" (401).

## Current state

- `src/lib/metadata/providers.ts:1419-1425`:

```ts
function extractAmazonAsin(value: string) {
	try {
		const url = new URL(value);
		const hostname = url.hostname.replace(/^www\./, "");
		if (!hostname.endsWith("amazon.com")) return undefined;
```

- `providers.ts` — `fetchAmazonBookHtml` (~1850-1866) hace `fetch(url)` sin opción `redirect`. Alcanzable desde `/api/metadata/search` y `/api/metadata/details`.
- `src/routes/api/internal/reading/sync.ts:11-31` — tres `jsonError("Falta configurar X.", 503)` antes del check de secreto; luego `sameSecret(received, expected)` con `node:crypto.timingSafeEqual` (líneas al final del archivo). ESE helper es el estándar local.
- `src/routes/internal/alfred/notifications/pull.ts:8-16`:

```ts
function assertAlfredSecret(request: Request) {
  const expected = process.env.ALFRED_NOTIFY_SECRET;
  if (!expected) throw new Error("Falta ALFRED_NOTIFY_SECRET.");
  if (request.headers.get("x-library-secret") !== expected) {
    throw new Error("No autorizado.");
  }
}
```

y en el handler: `message.includes("Falta") ? 500 : 401`. Idéntico en `ack.ts` y `mark-read.ts`.

- `convex/notifications.ts:744-750` — `assertAlfredSecret(secret)` con `secret !== expected` dentro de mutaciones (runtime V8 de Convex: **no** hay `node:crypto` ahí).
- `src/lib/server/http.ts` — helpers compartidos `json`, `jsonError`, `readJson`, `withUnauthorizedGuard`.

## Commands you will need

| Purpose      | Command                                              | Expected    |
| ------------ | ---------------------------------------------------- | ----------- |
| Typecheck    | `bun run typecheck`                                  | exit 0      |
| Tests        | `bun run test`                                       | todas pasan |
| Test puntual | `bun run test -- src/lib/metadata/providers.test.ts` | pasa        |
| Lint         | `bun run check`                                      | exit 0      |

## Scope

**In scope**:

- `src/lib/metadata/providers.ts` (solo `extractAmazonAsin` + opciones de `fetchAmazonBookHtml`)
- `src/lib/server/http.ts` (añadir helper `sameSecret`)
- `src/routes/api/internal/reading/sync.ts`
- `src/routes/internal/alfred/notifications/{pull,ack,mark-read}.ts`
- `convex/notifications.ts` (solo `assertAlfredSecret`)
- Tests nuevos: `src/lib/server/http.test.ts`

**Out of scope**:

- El proxy de imágenes y cotas de tamaño (plan 010).
- Cualquier otro proveedor de metadatos.

## Git workflow

- Branch: `codex/009-endurecimiento-endpoints`
- Commits: `fix(security): valida host de Amazon con ancla y bloquea redirects`, `fix(security): compara secretos en tiempo constante y uniforma respuestas pre-auth`.

## Steps

### Step 1: Ancla de host en Amazon

En `extractAmazonAsin`:

```ts
const hostname = url.hostname.replace(/^www\./, "");
if (hostname !== "amazon.com" && !hostname.endsWith(".amazon.com"))
  return undefined;
```

Añade casos al test existente `src/lib/metadata/providers.test.ts`: `"https://evil-amazon.com/dp/XXXX"` → sin ASIN; `"https://www.amazon.es/..."` → sin ASIN (dominio regional fuera de alcance); subdominio válido `"https://smile.amazon.com/dp/..."` → ASIN si el resto del path calza.

**Verify**: `bun run test -- src/lib/metadata/providers.test.ts` → pasa.

### Step 2: Bloquear redirects en fetch de Amazon

En `fetchAmazonBookHtml`, añade `redirect: "error"` al init del `fetch`. Si una búsqueda real dejara de funcionar por un redirect legítimo de Amazon, se resolverá re-validando saltos manualmente (fuera de alcance aquí).

**Verify**: typecheck; prueba manual opcional de una búsqueda de libro Amazon desde la UI.

### Step 3: Helper compartido `sameSecret`

1. En `src/lib/server/http.ts` añade:

```ts
import { timingSafeEqual } from "node:crypto";

export function sameSecret(received: string, expected: string) {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}
```

2. En `sync.ts`, borra el `sameSecret` local e importa el de `@/lib/server/http`.

### Step 4: Alfred routes — tiempo constante y respuesta uniforme

En cada una de las tres rutas (`pull.ts`, `ack.ts`, `mark-read.ts`):

1. Cambia `assertAlfredSecret` para usar `sameSecret(header ?? "", expected)`.
2. En el catch del handler, responde SIEMPRE `jsonError("No autorizado.", 401)` y loguea el motivo real: `console.error("[alfred/pull] auth failed", error);`. Elimina el ternario `includes("Falta") ? 500 : 401`.

### Step 5: `convex/notifications.ts` — tiempo constante puro

Reemplaza la comparación de `assertAlfredSecret` por una XOR en tiempo constante (V8 isolate no tiene `node:crypto`):

```ts
function constantTimeEquals(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < b.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
```

y úsala en lugar de `!==`. Mantén el mensaje "No autorizado.".

### Step 6: Uniformar pre-auth en sync route

En `sync.ts`, colapsa las tres comprobaciones de variables faltantes en:

```ts
const missing = [
  ["READING_INTEGRATION_OWNER_ID", ownerId],
  ["READING_SYNC_SECRET", expectedSecret],
  ["READING_BOOKS_PATH", rootPath],
].filter(([, value]) => !value);
if (missing.length > 0) {
  console.error(
    "[reading/internal-sync] config incompleta",
    missing.map(([name]) => name),
  );
  return jsonError("Servicio no disponible.", 503);
}
```

### Step 7: Test del helper

Crea `src/lib/server/http.test.ts` modelado sobre cualquier test de `src/lib/**` (imports vitest): `sameSecret` true/false para iguales, distintos, largos distintos, vacíos.

**Verify**: `bun run test -- src/lib/server/http.test.ts` → pasa.

## Test plan

- Casos unitarios de host lookalike y `sameSecret` como arriba.
- Verificación manual: `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3100/internal/alfred/notifications/pull` → 401 con cuerpo uniforme, tanto sin secreto configurado como con secreto erróneo (el detalle solo en logs del server).

## Done criteria

- [ ] `rg -n 'endsWith\("amazon.com"\)' src/lib/metadata/providers.ts` → solo la versión con ancla
- [ ] `rg -n '"Falta' src/routes/internal src/routes/api/internal` → 0 resultados visibles en respuestas
- [ ] `rg -n '!== expected' src/routes/internal/alfred convex/notifications.ts` → 0
- [ ] Gates verdes; fila actualizada en `plans/README.md`

## STOP conditions

- Las búsquedas reales de Amazon dejan de devolver resultados tras `redirect: "error"` en más de un caso puntual: reporta cuáles URLs fallaron (sin pegar HTML).
- Las rutas Alfred cambiaron de firma respecto al drift check (plan 019 dependerá de estas formas).

## Maintenance notes

- Regla nueva: TODO secreto compartido nuevo debe pasar por `sameSecret` (server) o `constantTimeEquals` (Convex).
- Si el bot de Alfred depende del texto exacto de los errores 500/401, coordina el cambio con ese repo (`~/dev/alfred`).
