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
- Markdown como base (texto plano, compatible con Obsidian)

Nota: la app ahora corre sobre PostgreSQL local con Better Auth y una API propia en TanStack Start. El foco sigue siendo privacidad, control de acceso y cero dependencia de servicios cloud para el backend.

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

- Notas libres por obra en Markdown
- Citas/highlights y reflexiones personales
- Pensado para exportar/importar facilmente

Estado actual: el modelo ya contempla `notes`/`review`, pero la UI todavia es basica. La idea es desarrollar la capa de "pensamiento" encima del CRUD existente.

## Interfaz (concepto)

- Dashboard: en progreso, recientes, backlog
- Biblioteca: tabla tipo Notion con filtros y columnas ordenables
- Detalle de obra: metadatos, controles de progreso, editor Markdown

## Stack (este repo)

- React + TanStack Router (file-based en `src/routes`)
- Vite
- TanStack Start server routes (backend)
- PostgreSQL + Drizzle ORM
- Better Auth (auth)
- Tailwind CSS + shadcn/ui
- Vitest (tests)
- Biome (lint/format)

## Privacidad y acceso

- La app es privada: requiere login.
- Auth: Better Auth sobre PostgreSQL.
- Objetivo: que cada usuario vea solo sus datos (multi-usuario real) o, alternativamente, modo single-user con sign-up deshabilitado. Esto se decide al aterrizar el modelo de acceso.

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

- levanta el PostgreSQL compartido de `~/dev/postgres`
- aplica migraciones de Drizzle
- arranca Vite en `http://localhost:3000`

La DB local ya no vive en este repo. Se espera un PostgreSQL compartido corriendo en `~/dev/postgres`.

### Variables de entorno

Configurar en `.env.local` o copiar desde `.env.example`:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `VITE_SITE_URL`
- `OBSIDIAN_VAULT_PATH`
- `TMDB_API_KEY`
- `ALFRED_NOTIFY_SECRET`
- `ALFRED_NOTIFY_URL`

Opcional:

- `MANGA_RELEASE_WORKER_INTERVAL_MS`

### PostgreSQL local

La base local corre en el stack compartido `~/dev/postgres` usando estas credenciales por defecto:

- host: `127.0.0.1`
- puerto: `5432`
- db: `library`
- user: `postgres`
- password: `postgres`

`bun run db:down` apaga esa instancia compartida completa, no solo esta app.

## Scripts

```bash
bun run build
bun run preview
bun run test
bun run lint
bun run format
bun run check
bun run db:up
bun run db:down
bun run db:logs
bun run db:generate
bun run db:migrate
```

## Filosofia de datos (direccion)

- La base de datos guarda estructura
- Markdown guarda pensamiento
- Datos exportables, respaldables y legibles por humanos (sin lock-in)

Nota: el concepto original contemplaba SQLite + archivos Markdown. Hoy priorizamos PostgreSQL local para mantener estructura y consultas fuertes sin lock-in cloud; export/import a Markdown sigue siendo objetivo.

## No-objetivos

- Funciones sociales
- Recomendaciones automaticas
- Publicidad
- Trackers/analitica

## Estado

Prototipo inicial, en evolucion constante como sistema personal.

## Roadmap (corto)

- Autenticacion (Better Auth) + proteccion de rutas/API
- UI de notas Markdown + review
- Progreso editable (current/total) y fechas (inicio/termino)
- Etiquetas/filtros mas potentes
- Export/import a carpeta Markdown (Obsidian-friendly)
