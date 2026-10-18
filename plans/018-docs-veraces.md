# Plan 018: Documentación veraz (scripts, .env.example, identidad multiusuario, project-context)

> **Instrucciones**: pasos + verificación. Al editar `.md` ejecuta `prettier --write <archivo>`. Actualiza tu fila en `plans/README.md`.
>
> **Drift check (primero)**: `git diff --stat 2d168eb..HEAD -- README.md AGENTS.md package.json docs/project-context.md docs/plans`
> Mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001 (nombres de scripts finales), plans/002 (SIGNUP_INVITE_CODE ya documentado)
- **Category**: docs
- **Planned at**: commit `2d168eb`, 2026-08-22

## Why this matters

La documentación está activamente equivocada en los dos momentos de mayor fricción —desplegar y configurar— y describe el producto con una identidad vieja: README/AGENTS referencian `bun run convex:deploy` que NO existe en package.json; prometen un `.env.example` inexistente; dicen "sistema personal" siendo multiusuario; y `docs/project-context.md` afirma que la prioridad es terminar la integración KOReader que YA está completa (#9). Quien siga estos documentos (humano o agente) falla o planea hacia el pasado.

## Current state

- `package.json` — scripts reales relevantes: `convex:dev`, `convex:push`, `deploy:dry-run`, `deploy:sync-only`, `deploy` (`deploy library --with-convex`). **No hay** `convex:deploy`.
- `README.md:148` lista `bun run convex:deploy`; `README.md:223` dice "`bun run deploy` primero ejecuta `bun run convex:deploy`"; `README.md:109` promete `.env.example`; `README.md:3` "Sistema personal..."; roadmap (líneas 253-258) lista como pendientes ítems ya entregados ("Progreso editable", "UI de notas y review" — existen: sheet de edición con progreso, quotes, diálogo de reseña).
- `AGENTS.md` — bloque Commands repite `bun run convex:deploy`.
- `docs/project-context.md:49-58` — "La prioridad funcional es terminar la integración owner-only..." + tensión sin resolver con "No ampliar el alcance a series/películas/libros..." (línea 45).
- Git log confirma integración completa: `b7abf06 feat(reading): complete KOReader integration (#9)`, `dde721f` restricción owner.
- Regla del usuario: al editar Markdown ejecutar `prettier --write`.

## Commands you will need

| Purpose      | Command                                                                                | Expected     |
| ------------ | -------------------------------------------------------------------------------------- | ------------ | ----- | -------------------------------------------------------- |
| Formato md   | `prettier --write README.md docs/project-context.md AGENTS.md .env.example 2>/dev/null |              | true` | archivos formateados (prettier ignora lo que no matchea) |
| Verificación | `rg -n "convex:deploy" README.md AGENTS.md`                                            | 0 resultados |
| Gates        | `bun run check`                                                                        | exit 0       |

## Scope

**In scope**:

- `README.md`
- `AGENTS.md`
- `docs/project-context.md`
- `.env.example` (crear si no existe aún)

**Out of scope**:

- Reescribir el producto ni añadir features al roadmap.
- Los design docs históricos en `docs/plans/` (quedan como registro fechado).

## Git workflow

- Branch: `codex/018-docs-veraces`
- Commit: `docs: corrige scripts reales, env example e identidad multiusuario`

## Steps

### Step 1: Scripts correctos

En README y AGENTS.md reemplaza toda mención de `bun run convex:deploy` por el flujo real (`bun run deploy`, que despliega Convex + triggerea Dokploy). En README:150 ajusta el bloque de scripts para reflejar EXACTAMENTE package.json.

**Verify**: `rg -n "convex:deploy" README.md AGENTS.md` → 0.

### Step 2: `.env.example`

Crea el archivo con TODAS las variables listadas en README (107-129 y bloque producción), valores vacíos y comentario breve en español cada uno. Incluye las E2E (`E2E_TEST_EMAIL`, etc.) y `SIGNUP_INVITE_CODE` (plan 002). Nada de valores reales.

**Verify**: `rg -c "=" .env.example` ≥ 15 y ninguna línea tiene valor no vacío.

### Step 3: Identidad multiusuario en README

1. Línea 3 → "Aplicación web privada multiusuario para llevar el registro y la reflexión…".
2. Sección Estado (~244): sustituir "Prototipo inicial… sistema personal" por estado real (multiusuario, manga pulido, integración KOReader completa).
3. Roadmap: marca como hecho "Progreso editable…" y "UI de notas y review" (con nota de qué existe: edición auto-save, citas, reseñas); deja pendientes solo export/import y etiquetas avanzadas.
4. Añade advertencia visible arriba de Desarrollo: "Dev y prod comparten deployment Convex: nunca mutar datos reales fuera de flujos E2E."

### Step 4: project-context actualizado

1. Reemplaza "Nueva dirección: integración de lectura / La prioridad funcional es terminar…" por sección "Integración de lectura (completa)" con fecha y referencia al spec.
2. Resuelve la tensión de la línea 45 con una decisión fechada explícita, p. ej.: "Decisión 2026-08: el corte de lectura prioriza libros; los cambios compartidos para otros tipos se hacen solo cuando rompan algo existente."
3. Corrige la afirmación "Obsidian, ideas revisables y FSRS permanecen fuera de este corte" añadiendo "(ideas/FSRS ya implementadas aparte; ver `/ideas`)". El vocabulario canónico vive en CONTEXT.md — mantenlo intacto.

### Step 5: Prettier

Ejecuta prettier sobre los tres `.md` tocados.

**Verify**: `prettier --check README.md docs/project-context.md` → exit 0.

## Test plan

- Solo gates de formato; lectura humana final de ambos docs para consistencia interna.

## Done criteria

- [ ] Cero menciones a scripts inexistentes
- [ ] `.env.example` completo y sin secretos
- [ ] README/project-context describen el estado real
- [ ] Prettier limpio; fila actualizada en `plans/README.md`

## STOP conditions

- Descubres que algún script documentado SÍ existía bajo otro nombre con semántica distinta (no inventes equivalencias).

## Maintenance notes

- Regla operativa nueva para AGENTS.md: "todo script nuevo se documenta en README y AGENTS.md en el mismo PR".
