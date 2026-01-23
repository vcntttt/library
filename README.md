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

Nota: el prototipo actual esta construido sobre Convex (cloud) para iterar rapido. El foco es mantener la experiencia privada via autenticacion y control de acceso.

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
- Convex (backend)
- Better Auth (auth) + Convex Better Auth
- Tailwind CSS + shadcn/ui
- Vitest (tests)
- Biome (lint/format)

## Privacidad y acceso

- La app es privada: requiere login.
- Auth: Better Auth integrado con Convex.
- Objetivo: que cada usuario vea solo sus datos (multi-usuario real) o, alternativamente, modo single-user con sign-up deshabilitado. Esto se decide al aterrizar el modelo de acceso.

## Desarrollo local

Instalar deps:

```bash
bun install
```

Levantar web + Convex en paralelo:

```bash
bun run dev
```

### Variables de entorno (Convex)

Configurar en `.env.local`:

- `VITE_CONVEX_URL`
- `CONVEX_DEPLOYMENT`

Cuando se integre Better Auth, tambien se usa:

- `VITE_CONVEX_SITE_URL` (Convex HTTP Actions URL; termina en `.convex.site`)

Atajo: `npx convex init` puede setearlas automaticamente.

## Scripts

```bash
bun run build
bun run preview
bun run test
bun run lint
bun run format
bun run check
```

## Filosofia de datos (direccion)

- La base de datos guarda estructura
- Markdown guarda pensamiento
- Datos exportables, respaldables y legibles por humanos (sin lock-in)

Nota: el concepto original contemplaba SQLite + archivos Markdown. Hoy priorizamos Convex para velocidad; export/import a Markdown queda como objetivo para evitar lock-in.

## No-objetivos

- Funciones sociales
- Recomendaciones automaticas
- Publicidad
- Trackers/analitica

## Estado

Prototipo inicial, en evolucion constante como sistema personal.

## Roadmap (corto)

- Autenticacion (Better Auth) + proteccion de funciones Convex
- UI de notas Markdown + review
- Progreso editable (current/total) y fechas (inicio/termino)
- Etiquetas/filtros mas potentes
- Export/import a carpeta Markdown (Obsidian-friendly)
