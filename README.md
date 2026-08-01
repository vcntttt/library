# Library

Sistema personal para llevar el registro y la reflexion de libros, peliculas, series, anime y manga.
Privado por defecto, enfocado en el pensamiento mas que en el consumo.

## Que es esto?

Library es una aplicacion web personal para registrar y reflexionar sobre obras culturales:

- Libros
- Peliculas
- Series
- Anime
- Manga

No es una red social: no hay feeds, recomendaciones, algoritmos ni perfiles publicos.

## Principios base

- Privado por defecto
- Modelo unificado (una sola entidad: "Obra" con distintos tipos)
- Reflexion sobre metricas (las notas importan mas que los numeros)
- Uso rapido (registrar algo no debe generar friccion)
- Texto libre como base para notas y reflexion

Nota: la app ahora corre sobre Convex self-hosted con Convex Auth. El foco sigue siendo privacidad, control de acceso y backend propio.

## Funcionalidades (concepto + prototipo)

### Obras

Cada elemento es una Obra, con un tipo:

- libro
- pelicula
- serie
- anime
- manga

Campos comunes:

- Estado: pendiente, en_progreso, terminado, abandonado
- Valoracion (1-5)
- Etiquetas/temas
- Fechas de inicio y termino

### Progreso (segun tipo)

- Libros: paginas leidas / total
- Series/Anime: episodios vistos
- Manga: capitulos leidos
- Peliculas: fecha de visualizacion

### Notas

- Notas libres por obra
- Citas/highlights y reflexiones personales
- Pensado para exportar/importar facilmente

Estado actual: el modelo ya contempla `notes`/`review`, pero la UI todavia es basica. La idea es desarrollar la capa de "pensamiento" encima del CRUD existente.

## Interfaz (concepto)

- Dashboard: en progreso, recientes, backlog
- Biblioteca: tabla tipo Notion con filtros y columnas ordenables
- Detalle de obra: metadatos, controles de progreso, editor de texto

## Stack (este repo)

- React + TanStack Router (file-based en `src/routes`)
- Vite
- TanStack Start server routes para endpoints internos/metadata
- Convex self-hosted (database, functions, crons)
- Convex Auth (auth)
- Tailwind CSS + shadcn/ui
- Vitest (tests)
- Biome (lint/format)

## Privacidad y acceso

- La app es privada: requiere login.
- Auth: Convex Auth con email/password.
- Cada usuario ve solo sus datos por scoping en funciones Convex.

## Desarrollo local

Instalar deps:

```bash
bun install
```

Levantar la app:

```bash
bun run dev
```

`bun run dev` ahora:

- sincroniza `convex/*` con el deployment via `convex dev`
- regenera `convex/_generated/*`
- arranca Vite en `http://localhost:3000`

Dev y prod apuntan al mismo deployment Convex self-hosted. Las mutaciones locales afectan datos reales.

### Variables de entorno

Configurar en `.env.local` o copiar desde `.env.example`:

- `VITE_CONVEX_URL`
- `CONVEX_SELF_HOSTED_URL`
- `CONVEX_SELF_HOSTED_ADMIN_KEY` (solo local/CI, no commitear)
- `CONVEX_SITE_URL`
- `VITE_SITE_URL`
- `TMDB_API_KEY`
- `ALFRED_NOTIFY_SECRET`
- `ALFRED_NOTIFY_URL`
- `READING_BOOKS_PATH` (ruta absoluta a la carpeta `Books` sincronizada con
  KOReader en el servidor)
- `OBSIDIAN_VAULT_PATH` (ruta absoluta al vault de Obsidian sincronizado en el
  servidor)
- `READING_INTEGRATION_OWNER_ID` (ID de usuario Convex autorizado para acceder
  a las rutas privadas de lectura y al vault)
- `READING_SYNC_MAX_FILES` (opcional, máximo de libros inspeccionados por
  sincronización; por defecto 500)
- `ALFRED_NOTIFY_USER_EMAIL` (email del único usuario cuyas obras se envían a Alfred)

## Scripts

```bash
bun run build
bun run preview
bun run test
bun run lint
bun run format
bun run check
bun run test:e2e
bun run test:e2e:headed
bun run test:e2e:ui
bun run test:e2e:debug
bun run test:e2e:install
bun run convex:dev
bun run convex:push
bun run convex:deploy
bun run deploy
```

Convex Auth requiere `JWT_PRIVATE_KEY` y `JWKS` configuradas como variables del deployment Convex. No son variables del frontend ni del contenedor web de Library. Configuralas en tu instancia/deployment Convex self-hosted, por ejemplo con `convex env set` o desde la administración de tu self-host.

## Producción

Para deploy en Dokploy necesitás estas variables en el entorno de build/runtime:

- `VITE_CONVEX_URL`
- `CONVEX_SELF_HOSTED_URL`
- `CONVEX_SELF_HOSTED_ADMIN_KEY`
- `CONVEX_SITE_URL`
- `VITE_SITE_URL`
- `TMDB_API_KEY`
- `ALFRED_NOTIFY_SECRET`
- `ALFRED_NOTIFY_URL`
- `READING_BOOKS_PATH`
- `OBSIDIAN_VAULT_PATH`
- `READING_INTEGRATION_OWNER_ID`
- `READING_SYNC_MAX_FILES` (opcional)
- `ALFRED_NOTIFY_USER_EMAIL` (email del único usuario cuyas obras se envían a Alfred)

### Verificación E2E en navegador

Playwright se usa para verificar flujos críticos en un navegador real. Las
pruebas autenticadas requieren una cuenta dedicada de E2E; no uses una cuenta
personal porque el entorno local puede apuntar al Convex self-hosted con datos
reales.

Variables locales:

```bash
E2E_TEST_EMAIL=
E2E_TEST_PASSWORD=
E2E_BASE_URL=http://localhost:3100
```

Instalar Chromium:

```bash
bun run test:e2e:install
```

Ejecutar la suite:

```bash
bun run test:e2e
```

Para inspección visual o debugging:

```bash
bun run test:e2e:headed
bun run test:e2e:debug
```

Los datos creados por la suite usan prefijo `[E2E ...]` y se limpian desde la
UI. Si falla una prueba, revisa `playwright-report/` y los artefactos de
captura/traza retenidos por Playwright.

Variables viejas para eliminar del deploy:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `MANGA_RELEASE_WORKER_INTERVAL_MS`

`bun run deploy` primero ejecuta `bun run convex:deploy` y despues triggerea Dokploy. La imagen de la app ya no corre migraciones al arrancar.

## Filosofia de datos (direccion)

- La base de datos guarda estructura
- El texto libre guarda pensamiento
- Datos exportables, respaldables y legibles por humanos (sin lock-in)
- El contenido de las ideas vive en Markdown; Convex guarda su índice y agenda
  FSRS.

Export/import estructurado sigue siendo una posibilidad futura, pero la migración actual empezó con datos limpios en Convex.

## No-objetivos

- Funciones sociales
- Recomendaciones automaticas
- Publicidad
- Trackers/analitica

## Estado

Prototipo inicial, en evolucion constante como sistema personal.

Estado actual de trabajo:

- `manga` es el tipo priorizado para uso diario.
- El flujo de alta, detalle, progreso y notificaciones de manga ya está integrado.
- La documentación de contexto del proyecto vive en [docs/project-context.md](/home/vrivera/dev/library/docs/project-context.md).

## Roadmap (corto)

- Endurecer flujo de alta/login en Convex Auth
- UI de notas y review
- Progreso editable (current/total) y fechas (inicio/termino)
- Etiquetas/filtros mas potentes
- Export/import de datos estructurados
