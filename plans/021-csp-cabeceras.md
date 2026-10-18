# Plan 021: CSP en modo report-only y cabeceras de endurecimiento

> **Instrucciones**: pasos + verificación. STOP conditions al final. Actualiza tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- src/routes/__root.tsx src/lib/server/http.ts vite.config.ts src/router.tsx`
> Mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (una CSP mal calibrada rompe imágenes remotas, WS de Convex o el PWA; por eso report-only primero)
- **Depends on**: plans/001
- **Category**: security
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

La app renderiza Markdown del vault, imágenes remotas de proveedores y es PWA con service worker, pero no publica ninguna cabecera de endurecimiento: sin CSP no hay red de contención ante una futura regresión XSS, ni `nosniff`, ni política de referrer. Hoy no existe sink XSS conocido (react-markdown sin rehype-raw, cero `dangerouslySetInnerHTML` — verificado), así que el valor es preventivo.

## Current state

- `src/routes/__root.tsx:38-58` — `RootDocument` con `<head><HeadContent /></head>`; sin meta CSP.
- `src/lib/server/http.ts` — helpers `json/jsonError` solo ponen `content-type`.
- Cliente Convex: `new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)` (`__root.tsx:9`) → necesita `connect-src` hacia ese host (ws+wss/http+https).
- Imágenes remotas: `coverUrl`, `customCoverUrl`, proxy `/api/metadata/image` → `img-src https:` mínimo.
- PWA: `vite-plugin-pwa` autoUpdate registra service worker desde origen propio → `worker-src 'self'`.
- TanStack Start expone middleware de servidor (`createMiddleware`/server functions) — la vía exacta depende de la versión instalada; ver Step 1.

## Commands you will need

| Purpose             | Command                                                     | Expected            |
| ------------------- | ----------------------------------------------------------- | ------------------- | ---------- | --------- |
| Build/dev           | `bun run build` / `bun run dev`                             | exit 0 / app arriba |
| Verificar cabeceras | `curl -sI http://localhost:3100/ \| rg -i "content-security | x-content-type      | referrer"` | presentes |
| E2E                 | `bun run test:e2e`                                          | pasa                |

## Scope

**In scope**:

- Middleware de servidor global (archivo nuevo bajo `src/` según lo que soporte la versión instalada)
- `src/routes/__root.tsx` (solo si la vía elegida requiere meta fallback)

**Out of scope**:

- Pasar a enforcing (quedar documentado como follow-up tras observar reportes).
- Cambiar el service worker.

## Git workflow

- Branch: `codex/021-csp-cabeceras`
- Commit: `fix(security): publica CSP report-only y cabeceras base`

## Steps

### Step 1: Confirmar la vía de middleware en la versión instalada

Consulta la doc de la versión instalada de `@tanstack/react-start` (Context7 o `node_modules/@tanstack/react-start`): busca cómo registrar un middleware global que añada headers a todas las respuestas. Si la versión instalada NO soporta middleware global, alternativa aceptada: definir las cabeceras en el reverse proxy (Dokploy) y dejar aquí SOLO la documentación — STOP y reporta esa decisión.

### Step 2: Implementar cabeceras

```ts
const securityHeaders = {
  "Content-Security-Policy-Report-Only": [
    "default-src 'self'",
    "img-src 'self' https: data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'", // relajar aquí primero; endurecer con reportes
    "connect-src 'self' <host-de-VITE_CONVEX_URL>",
    "worker-src 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};
```

Aplica a TODAS las respuestas (HTML, JSON de rutas API). El host de Convex se deriva de env en runtime, no hardcodeado.

**Verify**: curl de arriba muestra las 3 cabeceras en `/` y también en un POST a una ruta API.

### Step 3: Verificación funcional completa

1. App carga, login funciona (Convex conecta).
2. Portadas remotas visibles en Biblioteca.
3. `/ideas` renderiza Markdown.
4. Consola del navegador SIN errores de CSP bloqueando (en report-only no bloquea; verifica que los reportes, si se configuran, no muestren violaciones absurdas).
5. Suite E2E verde.

## Test plan

- Verificación manual + suite existente. No hay test unitario de cabeceras (el plan 019 podría extenderse luego).

## Done criteria

- [ ] Las tres cabeceras presentes en HTML y JSON
- [ ] Flujos manuales 1-4 sin regresión
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- La versión instalada no soporta middleware global y no quieres tocar Dokploy: detente con esa conclusión.

## Maintenance notes

- Follow-up: recolectar reportes 1-2 semanas → pasar a `Content-Security-Policy` enforcing quitando `'unsafe-inline'` de scripts si los reportes lo permiten.
