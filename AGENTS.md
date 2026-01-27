# AGENTS.md
This file is guidance for agentic coding tools working in this repo.

## Project quick facts
- App name: Library (private personal media library)
- Frontend: React + TanStack Router (file-based routes in `src/routes`)
- Build tool: Vite (TanStack Start plugin) + Nitro
- Backend: Convex (`convex/`)
- Styling: Tailwind v4 + shadcn/ui
- Tests: Vitest
- Lint/format: Biome
- Package manager/runtime: Bun

## Skill map (OpenCode)

Use these skills intentionally; load them when the task matches.

- `brainstorming`: always before creative work (new features, new UI, behavior changes)
- `systematic-debugging`: any bug/test failure/unexpected behavior before proposing fixes
- `Error Resolver`: when you have an error message/stack trace and need a structured diagnosis
- `senior-frontend`: React/TanStack Router/TypeScript/Tailwind implementation and performance
- `frontend-design`: high-quality UI build work (layouts, styling direction, motion)
- `ui-design-system`: tokens/components docs and design-dev handoff patterns
- `senior-fullstack`: end-to-end work spanning UI + Convex + data flow/architecture
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
- Usar labels/tags correctamente: por defecto `feature`, sumar 1-2 labels de dominio (por ejemplo `ui`, `backend`, `convex`, `auth`, `docs`). No crear labels nuevos salvo necesidad.
- La descripcion de la issue debe ser implementable en otra sesion: contexto, alcance/no alcance, criterios de aceptacion, notas tecnicas, links/mocks, edge cases y definition of done.
- Al empezar a trabajar en una issue, marcarla como `In Progress` (y asignar a `me` si aplica).
- No completar issues hasta confirmacion del usuario o el flujo de `/commit`.

## Commands

- Do not run `bun run dev` unless explicitly asked; server is usually running in another terminal.

```bash
# install
bun install

# dev
bun run dev        # web + convex
bun run dev:web
bun run dev:convex

# build
bun run build
bun run preview

# lint/format (Biome; tabs + double quotes)
bun run lint
bun run format
bun run check

# tests (Vitest)
bun run test
bun run test -- src/path/to/my.test.ts
bun run test -- -t "my test name"
bunx vitest
```

## Repo layout
- `src/routes/*`: TanStack Router file-based routes (most routes set `ssr: false`).
- `src/components/*`: App components.
- `src/components/ui/*`: shadcn/ui primitives.
- `src/lib/*`: app types and mapping helpers.
- `src/lib/auth-*`: Better Auth client/server helpers.
- `convex/*`: Convex schema + query/mutation functions.
- `convex/_generated/*`: generated Convex API/types (do not edit).

Generated files (do not edit): `src/routeTree.gen.ts`, `convex/_generated/*`.

## Environment variables

- Local config lives in `.env.local` (never commit secrets).
- Convex:
  - `VITE_CONVEX_URL`
  - `CONVEX_DEPLOYMENT`
- Auth (planned with Better Auth + Convex Better Auth):
  - `VITE_CONVEX_SITE_URL` (Convex HTTP Actions URL, ends in `.convex.site`)

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
- Keep Convex document types separated from UI types (see `src/lib/obras.ts`).

### React / UI
- Components: PascalCase names, exported as named exports when reusable.
- Files: kebab-case for components (existing pattern: `add-obra-dialog.tsx`).
- Routes: keep data fetching in the route component; pass typed data to UI.
- Copy/labels: product language should be Spanish (per current direction);
  internal enum values may remain English, but UI should map to Spanish labels.

### Naming

- Prefer domain language in UI: "Obra", "Biblioteca", "En progreso", etc.
- Keep storage enums stable (English) unless you plan a migration.
- Component files: kebab-case; exported components: PascalCase.

### Routing (TanStack Router)
- New routes belong in `src/routes`.
- Use `createFileRoute(...)({ ssr: false, component: ... })` unless SSR is
  intentionally required.
- Prefer `<Link>` for navigation and route params (see `src/routes/obra/$obraId.tsx`).

### Convex guidelines
- All functions must validate inputs with `v` validators.
- Use indexes where needed; define them in `convex/schema.ts`.
- Use `Date.now()` for timestamps; keep `createdAt` immutable and update `updatedAt`.
- Error handling: throw `new Error("...")` with a clear, user-facing message.
- Keep mutations small and deterministic; avoid side effects outside Convex.

Access control (important):
- Do not ship new mutations without an auth check.
- Once auth lands, all queries/mutations should scope data to the current user.

Data model notes:
- Documents include system fields `_id` and `_creationTime` (do not add to schema).
- In the UI, map Convex docs to app types via `obraFromDoc` (`src/lib/obras.ts`).

### Auth / privacy
- The goal is a private app; do not leave write operations unauthenticated.
- Planned approach: Better Auth integrated with Convex Better Auth.
- When adding auth, protect Convex queries/mutations and add a login gate in UI.
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

### Convex schema notes
- Read Convex types and system fields docs when designing schema:
  https://docs.convex.dev/database/types
- Use `v` validator builder correctly:
  https://docs.convex.dev/api/modules/values#v
- System fields exist on every document:
  `_id` (document id) and `_creationTime` (ms since epoch).
- You do not need to add indexes for system fields; Convex provides them.

The `.cursorrules` file also contains an example schema; use it as reference
for unions, optional fields, and indexes.
