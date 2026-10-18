# Implementation Plans

Generados con el flujo `improve` el 2026-08-22, contra commit `2d168eb`.
Ejecutar en el orden de abajo salvo que las dependencias digan otra cosa. Cada
executor: leer el plan completo antes de empezar, respetar sus STOP conditions
y actualizar su fila al terminar.

Contexto del repo para todo executor: app privada **multiusuario** (React +
TanStack Start/Router, Convex self-hosted + Convex Auth, Tailwind v4 + shadcn,
Vitest + Playwright, Biome, Bun). Dev y producción comparten deployment Convex:
nunca mutar datos reales fuera de flujos `[E2E ...]` con la cuenta dedicada.
UI en español; enums de storage en inglés; Biome con tabs y comillas dobles;
commits convencionales en español (`fix(reading): ...`).

## Execution order & status

| Plan | Título                                                                | Priority | Effort | Depends on                      | Status |
| ---- | --------------------------------------------------------------------- | -------- | ------ | ------------------------------- | ------ |
| 001 | Línea base de verificación (typecheck, tsc verde, Vitest sin cuelgue) | P1 | M | — | DONE (rama `codex/001-linea-base-verificacion`, worktree `/tmp/opencode/library-exec`; desviación aprobada: `TMDB_API_KEY` dummy en vitest.config) |
| 002 | Cerrar autorregistro con código de invitación | P1 | S-M | 001 | DONE (`codex/002-cerrar-registro` sobre 001; verificación manual de signup pendiente del dueño) |
| 003 | Cola de notificaciones robusta (poison pill, tope de intentos, GC) | P1 | M | 001; no en paralelo con 004 | DONE (`codex/003-cola-notificaciones`; revisión aplicó techo también en leases expirados y guardia de candidatos) |
| 004 | Limpiar referencias al eliminar obra | P1 | S | 001; no en paralelo con 003 | DONE (`codex/004-limpieza-referencias`; enmienda reviewer: sin índice nuevo ni push de schema, escaneo acotado) |
| 005 | Autosave con patches de un solo campo | P1 | M | 001 | DONE (`codex/005-autosave-por-campo`; re-basado a `3fec177`; builders extraídos a `src/lib/obra-edit-values.ts` con tests) |
| 006 | Mostrar errores de mutaciones al usuario | P1 | S | 001 | DONE (`codex/006-errores-visibles`; executor documentó que errorMap.onSubmit no captura throws en react-form 1.28 → doble mecanismo) |
| 007 | Guardias para respuestas async fuera de tiempo | P2 | S | 001 | DONE (`codex/007-guardias-async`; token ref en add-obra, id estable en galería) |
| 008 | Quick wins: quitar `as any`, filtro Manhwa | P2 | XS | 001 | DONE (`codex/008-quickwins-correctez`; narrowing por destructuring autorizado en revisión) |
| 009 | Endurecer endpoints internos y fetch externo (SSRF Amazon, secretos) | P2 | M | 001, 002, 003 | DONE (`codex/009-endurecimiento-endpoints`; 2 commits; curl manual deferido al dueño) |
| 010 | Cotas de tamaño y timeout en lecturas externas y EPUB | P2 | M | 001 (tras 009 idealmente) | DONE (`codex/010-cotas-lecturas`; fetchWithLimits, cotas imagen/EPUB/entrada ZIP; verificación con EPUB real deferida) |
| 011 | Canonicalizar symlinks en contención de rutas | P3 | S | 001 | DONE (`codex/011-realpath-contencion`; realpathNearestExisting para escrituras anidadas en vaults frescos) |
| 012 | Characterization tests de proyección/reseña (Convex) | P2 | M | 001 | DONE (`codex/012-characterization-proyeccion`; 14 tests; hallazgo fuera de alcance: `clearReadingProjection` duplica la lista de campos reading* — candidato a helper compartido) |
| 013 | Perf queries Convex (reviewLogs, N+1 documentos) | P2 | M | 012 | DONE (`codex/013-perf-queries-convex`; executor corrigió plan: `by_user_updatedAt` NO existía en readingSources → fusión por status; Step 3 omitido con causa: rompía sugerencias de UI. Follow-up opcional: índice dedicado con push coordinado) |
| 014 | Limpieza de dependencias y pin de nitro | P2 | S | 001 | DONE (`codex/014-limpieza-dependencias`; STOP legítimo del executor corrigió el plan: `shadcn` es input de build vía CSS import, permanece en dependencies) |
| 015 | Eliminar rutas variant-a/b/c | P2 | S | 001 | DONE (`codex/015-eliminar-variants`; −1744 líneas, routeTree limpio) |
| 016  | Consolidar duplicación frontend (URLs, opciones)                      | P3       | M      | 001, 008                        | TODO   |
| 017 | Higiene backend (import cruzado src→convex, índices muertos) | P3 | S | 001; secuencial con 003/004/013 | DONE (`codex/017-higiene-backend`; integration-owner → convex/lib con 2 importadores; índices muertos fuera del schema — materializar con próximo `deploy --with-convex`. Imports cruzados restantes documentados como fuera de alcance) |
| 018 | Documentación veraz | P2 | S | 001, 002 | DONE (`codex/018-docs-veraces`; scripts reales, .env.example comentado, identidad multiusuario, roadmap dividido Hecho/Pendiente) |
| 019  | Tests de handlers de rutas de servidor                                | P2       | M      | 001, 009                        | TODO   |
| 020  | E2E smoke del área de lectura                                         | P3       | M      | 001                             | TODO   |
| 021  | CSP report-only + cabeceras base                                      | P3       | M      | 001                             | TODO   |
| 022  | Code-splitting de /ideas                                              | P3       | S      | 001                             | TODO   |
| 023  | Partir ruta de detalle de obra                                        | P3       | M      | 001, 006, (012)                 | TODO   |
| 024  | Partir providers.ts por proveedor                                     | P3       | L      | 009, 010, (012)                 | TODO   |
| 101  | DIRECCIÓN: diseño export de datos estructurados                       | P3       | M      | —                               | TODO   |
| 102  | DIRECCIÓN: telemetría de sync de lectura                              | P3       | M-L    | 019, 020                        | TODO   |
| 103  | DIRECCIÓN: health unificado con último sync                           | P3       | S-M    | 001                             | TODO   |
| 104  | DIRECCIÓN: highlight curado → idea revisable                          | P3       | M-L    | decisión de producto            | TODO   |

Status values: `TODO | IN PROGRESS | DONE | BLOCKED (<razón>) | REJECTED (<razón>)`

## Waves sugeridas

1. **Wave 0 (baseline)**: 001.
2. **Wave 1 (crítico)**: 002, 003+004 (secuenciales entre sí), 005, 006.
3. **Wave 2**: 007, 008, 009 → 010, 012, 014, 015, 018.
4. **Wave 3**: 011, 013 (requiere 012), 016, 017, 019 (requiere 009), 020.
5. **Wave 4 (estructural/opcional)**: 021, 022, 023, 024.
6. **Dirección**: 101–104 cuando el dueño quiera decidir producto.

## Dependency notes

- **001 es prerrequisito de todos**: define el gate `bun run typecheck` y deja Vitest saliendo limpio; los demás planes asumen ambos verdes.
- 013 requiere 012: tocar `convex/reading.ts` sin characterization tests arriesga las transiciones de progreso.
- 023 y 024 van después de los planes que editan esos mismos archivos (006→$obraId; 009/010→providers).
- 003 y 004 NO en paralelo (ambos tocan funciones/mutaciones Convex); igual 017 respecto a 003/004/013 (schema push).
- 019 depende de las formas de respuesta fijadas por 009.

## Findings considered and rejected

Registrados para no re-auditarlos:

- Escapes `\x` del parser Lua y ZIP64 del extractor EPUB: revisados, manejo actual suficiente.
- `RangeError` de entidades HTML numéricas: capturado por el handler de ruta.
- Hack `queueMicrotask` en galería: frágil pero funcional; no tocar sin motivo.
- Unidades mixtas de timestamp en `compareProgressSource`: camino muerto (el escáner solo produce mtimeMs).
- Heurística `value <= 1` de `formatReadingPercent`: los productores actuales guardan fracciones 0..1.
- `ideas.reviewLogs` creciendo sin límite: FALSO — acotado a 500 por `.slice(-500)` (el problema real era enviarlo al cliente, plan 013).
- `recommendation-badge.tsx` como código muerto: FALSO — lo usan obra-card, obra-status-cell y detalle.
- Imágenes sin lazy loading: FALSO — `loading="lazy"` ya presente en obra-card.
- `providers.ts` inflando bundle cliente: FALSO — solo server routes y Convex lo importan.
- Tres escuelas de data-fetching a consolidar: FALSO — patrón `useQuery(convexApi...)` convergido; `fetch()` solo para endpoints de servidor.
- Fan-in de `src/lib/utils.ts`: sano (`cn()` + formatters), no junk drawer.
- Migraciones pendientes en react-markdown/zod/tailwind/TanStack/ts-fsrs/@base-ui/react: versiones actuales, sin acción.
- SSRF por honorar `https_proxy`: convención estándar, no hallazgo.
