# AGENTS.md

This file is guidance for agentic coding tools working in this repo.

## Project quick facts

- App name: Library (private personal media library)
- Frontend: React + TanStack Router (file-based routes in `src/routes`)
- Build tool: Vite (TanStack Start plugin) + Nitro
- Backend: Convex self-hosted + TanStack Start server routes for metadata/internal bridges
- Styling: Tailwind v4 + shadcn/ui
- Tests: Vitest
- Lint/format: Biome
- Package manager/runtime: Bun

> **⚠️ Multi-usuario**: la app ya no es de uso individual — hay varias personas usándola. Tener mucho cuidado con cambios que puedan romper funcionalidad existente o perder datos. Privilegiar estabilidad, migraciones seguras y datos de prueba antes de tocar schema o eliminar columnas/tablas.

## External integrations

- Discord bot repo: `~/dev/alfred`.
- When the task involves Discord notifications or bot behavior, you can and should review/edit that repo as part of the implementation.
- Treat `~/dev/alfred` as the canonical bot runtime for notification delivery and operational bot logic when applicable.

## Skill map (OpenCode)

Use these skills intentionally; load them when the task matches.

- `brainstorming`: always before creative work (new features, new UI, behavior changes)
- `systematic-debugging`: any bug/test failure/unexpected behavior before proposing fixes
- `Error Resolver`: when you have an error message/stack trace and need a structured diagnosis
- `senior-frontend`: React/TanStack Router/TypeScript/Tailwind implementation and performance
- `frontend-design`: high-quality UI build work (layouts, styling direction, motion)
- `ui-design-system`: tokens/components docs and design-dev handoff patterns
- `senior-fullstack`: end-to-end work spanning UI + API + data flow/architecture
- `senior-devops`: CI/CD, build/deploy, infra, containerization, monitoring
- `senior-qa`: test strategy, Vitest coverage, E2E/test automation setup
- `changelog-generator`: produce user-facing release notes from git history
- `file-organizer`: repo/file organization, dedupe, structure cleanup
- `SEO Optimizer`: SEO + metadata + CWV improvements (if public-facing pages appear)
- `ux-researcher-designer`: personas, journeys, usability testing plans/synthesis
- `obsidian-markdown`: Obsidian-flavored markdown authoring/editing
- `obsidian-bases`: `.base` files for Obsidian Bases (views/filters/formulas)
- `skill-creator` / `skill-creation-guide`: when defining or refining new skills/workflows
- `Git Commit Helper` (`git-commit-helper`): draft conventional commit messages from staged diffs

Notes:

- Prefer loading a domain skill (`senior-frontend`, `senior-fullstack`, etc.) plus `systematic-debugging` when debugging.
- Some skills may be unused in this repo today; keep them here as a capability map.

## Linear workflow

- Siempre trabajar con Team: Freelance y Project: Library (salvo que el usuario indique lo contrario).
- Minimizar la cantidad de issues: preferir una issue con checklist/descripcion clara en lugar de muchas issues o subissues.
- Evitar subissues salvo que sean indispensables (trabajo en paralelo real, bloqueos o dependencias claras).
- Usar labels/tags correctamente: por defecto `feature`, sumar 1-2 labels de dominio (por ejemplo `ui`, `backend`, `db`, `auth`, `docs`). No crear labels nuevos salvo necesidad.
- La descripcion de la issue debe ser implementable en otra sesion: contexto, alcance/no alcance, criterios de aceptacion, notas tecnicas, links/mocks, edge cases y definition of done.
- Al empezar a trabajar en una issue, marcarla como `In Progress` (y asignar a `me` si aplica).
- No completar issues hasta confirmacion del usuario o el flujo de `/commit`.

## Commands

- You may run `bun run dev` when useful for verification. First check whether a
  server is already running and choose a non-conflicting port if needed. Dev uses
  the same Convex deployment/data as production, so never mutate real user data
  outside explicit user requests or E2E-prefixed test flows.

```bash
# install
bun install

# dev
bun run dev
bun run dev:web

# build
bun run build
bun run preview

# convex
bun run convex:dev
bun run convex:push
bun run convex:deploy

# lint/format (Biome; tabs + double quotes)
bun run lint
bun run format
bun run check

# tests (Vitest)
bun run test
bun run test -- src/path/to/my.test.ts
bun run test -- -t "my test name"
bunx vitest

# browser verification (Playwright)
bun run test:e2e:install
bun run test:e2e
bun run test:e2e:headed
bun run test:e2e:debug
```

## Repo layout

- `src/routes/*`: TanStack Router file-based routes (most routes set `ssr: false`).
- `convex/*`: Convex schema, auth, functions and crons.
- `src/components/*`: App components.
- `src/components/ui/*`: shadcn/ui primitives.
- `src/lib/*`: app types, metadata providers and mapping helpers.
- `src/lib/server/*`: server-side helpers for TanStack Start routes.

Generated files (do not edit): `src/routeTree.gen.ts`, `convex/_generated/*`.

## Environment variables

- Local config lives in `.env.local` (never commit secrets).
- Convex:
  - `VITE_CONVEX_URL`
  - `CONVEX_SELF_HOSTED_URL`
  - `CONVEX_SELF_HOSTED_ADMIN_KEY`
  - `CONVEX_SITE_URL`
- App:
  - `VITE_SITE_URL`
  - `OBSIDIAN_VAULT_PATH`
  - `TMDB_API_KEY`
- `ALFRED_NOTIFY_SECRET`
- `ALFRED_NOTIFY_URL`
- `ALFRED_NOTIFY_USER_EMAIL` (usuario propietario cuyas obras se notifican)
- E2E browser tests:
  - `E2E_TEST_EMAIL`
  - `E2E_TEST_PASSWORD`
  - `E2E_BASE_URL` (defaults to `http://localhost:3100`)

## Code style and conventions

### Formatting

- Use Biome; do not hand-format large sections.
- Indentation: tabs.
- Quotes: double quotes.
- Keep diffs minimal and consistent with surrounding code.

### Imports

- Prefer path alias `@/*` for app imports (configured in `tsconfig.json`).
- Use type-only imports when possible: `import type { ... } from ...`.
- Let Biome organize imports; avoid manual reordering unless necessary.

### TypeScript

- Prefer explicit unions for enums (see `src/lib/types.ts`).
- Use `interface` for object shapes shared across modules; `type` for unions.
- Avoid `any`; if truly necessary, scope it narrowly and add context.
- Keep DB rows separated from UI types (see `src/lib/obras.ts` and `src/lib/server/obras.ts`).

### React / UI

- Components: PascalCase names, exported as named exports when reusable.
- Files: kebab-case for components (existing pattern: `add-obra-dialog.tsx`).
- Routes: keep data fetching in the route component; pass typed data to UI.
- Copy/labels: product language should be Spanish (per current direction);
  internal enum values may remain English, but UI should map to Spanish labels.
- Existing obra edits auto-save: do not add global "Guardar" buttons for
  persisted fields on existing obras. Use debounced saves for text fields,
  immediate saves for discrete controls, and always show save/error state.
- Creation, destructive actions, external search, and explicit external apply
  flows remain user-confirmed actions.

### Browser verification

- Use Playwright for browser-level feature verification after UI/user-flow
  changes.
- Default E2E URL is `http://localhost:3100`, so verification does not
  accidentally reuse an unrelated app on port 3000. Override with
  `E2E_BASE_URL` only when intentionally targeting another running instance.
- Authenticated E2E flows require a dedicated test account via
  `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`; never use a personal account.
- E2E-created records must keep the `[E2E ...]` prefix and be cleaned up from
  the UI flow when possible.

### Autonomous feature loop

When the user describes a feature and asks for autonomous execution:

1. Do the intake carefully before automation:
   - Explore the repo first; do not ask questions that can be answered from
     code, docs, config, tests, or existing UI.
   - For medium/large features, ambiguous product behavior, user-facing
     workflow changes, data model changes, or anything that will be hard to
     unwind after an automatic PR+merge, use `grill-me` to stress-test the
     plan one decision at a time before implementation.
   - For small bug fixes, copy tweaks, narrow test fixes, mechanical refactors,
     or clearly specified changes, skip `grill-me` and clarify only
     product-impacting ambiguity.
   - When using `grill-me`, ask one question at a time, give a recommended
     answer, and stop grilling once goal, scope, non-goals, acceptance criteria,
     risks, and verification are clear enough to implement autonomously.
2. Create or use a feature branch. If on `main`, create `codex/{feature-slug}`.
3. Implement with subagents when scopes can be separated cleanly.
4. Verify with:
   - `bun run check`
   - `bun run test`
   - `bun run test:e2e`
5. Use Playwright/browser verification for user-facing flows.
6. Commit atomically and avoid staging unrelated user changes.
7. Push and open a draft PR automatically.
8. Spawn an independent reviewer agent; it must not be the implementation
   thread.
9. Fix blocking and should-fix review findings automatically when the fix does
   not change product intent or data semantics.
10. Update the PR body with validation status, browser verification notes, and
    known blockers.

Loop safety rules:

- Never use personal accounts for E2E.
- Never mutate real user data outside an E2E-prefixed dedicated test account.
- Never mark PRs ready-for-review without explicit user instruction.
- Stop only for real blockers: missing credentials, risky data mutation,
  non-trivial git conflicts, inaccessible CI logs, or product ambiguity that
  changes visible behavior.
- Default screenshots policy: rely on Playwright artifacts and summarize what
  was verified in the PR. Do not commit `test-results/` or
  `playwright-report/`.

### Naming

- Prefer domain language in UI: "Obra", "Biblioteca", "En progreso", etc.
- Keep storage enums stable (English) unless you plan a migration.
- Component files: kebab-case; exported components: PascalCase.

### Routing (TanStack Router)

- New routes belong in `src/routes`.
- Use `createFileRoute(...)({ ssr: false, component: ... })` unless SSR is
  intentionally required.
- Prefer `<Link>` for navigation and route params (see `src/routes/obra/$obraId.tsx`).

### Backend guidelines

- Validate Convex/API inputs before touching the DB.
- Use indexes where needed and keep them in `convex/schema.ts`.
- Use `Date.now()` for app timestamps; keep `createdAt` immutable and update `updatedAt`.
- Error handling: throw `new Error("...")` with a clear, user-facing message.
- Keep Convex functions small and deterministic; isolate external fetches in actions and scheduled work in `convex/crons.ts`.

Access control (important):

- Do not ship new write endpoints without an auth check.
- All DB reads/writes that touch user data must scope by the authenticated user.

Data model notes:

- Auth state lives in Convex Auth tables.
- In the UI, map Convex-backed payloads to app types via `obraFromDoc` (`src/lib/obras.ts`).

### Auth / privacy

- The goal is a private app; do not leave write operations unauthenticated.
- Convex Auth protects user-facing reads/writes.
- Protect server routes and API handlers, and keep login gates in UI.
- Never commit secrets; use `.env.local` for local config.

## Editing notes

- Prefer adding/adjusting small components over large refactors.
- Avoid touching auto-generated output in `.output/`.
- Keep UI text changes consistent (Spanish) and avoid mixing languages.

## Cursor rules to follow

This repo includes `.cursorrules`. Key points:

### shadcn instructions

- Use the latest shadcn/ui CLI when adding components:

```bash
pnpm dlx shadcn@latest add button
```

### Database notes

- Prefer explicit enums/unions for stable storage values.
- Keep Convex schema as the source of truth in `convex/schema.ts`.
- Deploy Convex schema/functions with `bun run convex:deploy`.
- The `.cursorrules` file also contains schema guidance; use it as reference for unions, optional fields, and indexes.
