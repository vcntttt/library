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

## Commands

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
- `src/integrations/convex/*`: Convex provider.
- `convex/*`: Convex schema + query/mutation functions.
- `convex/_generated/*`: generated Convex API/types (do not edit).

Generated files (do not edit): `src/routeTree.gen.ts`, `convex/_generated/*`.

## Environment variables

- Local config lives in `.env.local` (never commit secrets).
- Convex:
  - `VITE_CONVEX_URL`
  - `CONVEX_DEPLOYMENT`
- Auth (planned with Better Auth + Convex Better Auth):
  - `VITE_CONVEX_SITE_URL` (e.g. `http://localhost:3000`)

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
- Keep Convex document types separated from UI types (see `src/lib/works.ts`).

### React / UI
- Components: PascalCase names, exported as named exports when reusable.
- Files: kebab-case for components (existing pattern: `add-work-dialog.tsx`).
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
- Prefer `<Link>` for navigation and route params (see `src/routes/work/$workId.tsx`).

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
- In the UI, map Convex docs to app types via `workFromDoc` (`src/lib/works.ts`).

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
