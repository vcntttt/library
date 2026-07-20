# Diseño: progreso de series por temporada/capítulo

## Resumen

Mejorar el seguimiento de series y anime permitiendo marcar el avance como
"Temporada X · Capítulo Y" en vez de contar a mano un número global de episodios.
La solución mantiene la ficha compacta y ofrece una mini-grilla tipo Series Graph
dentro del edit sheet para marcar episodios de golpe.

## Alcance

- Tipos de obra afectados: `series` y `anime`.
- Mantener `progressCurrent` y `progressTotal` como fuente de verdad.
- Agregar `progressSeasons` como configuración de distribución de episodios.
- Mostrar "Temporada X · Capítulo Y" en la ficha cuando exista distribución.
- Agregar edición por temporadas en el edit sheet (colapsable/segundo sheet).
- Precargar `progressSeasons` desde TMDB cuando la serie venga de ahí.

## Fuera de alcance

- No reemplazar el progreso global por temporada/capítulo.
- No mostrar la grilla completa siempre visible en la ficha.
- No migrar datos existentes (seguirán funcionando con progreso global).
- No integrar detalle por temporada en AniList en esta versión.

## Modelo de datos

### Convex schema

```ts
progressSeasons: v.optional(
  v.array(
    v.object({
      seasonNumber: v.number(),
      episodeCount: v.number(),
    })
  )
)
```

### Tipos TypeScript

```ts
export interface ObraSeason {
  seasonNumber: number;
  episodeCount: number;
}
```

Agregado a:
- `Obra.progressSeasons?: ObraSeason[]`
- `CreateObraInput.progressSeasons?: ObraSeason[]`
- `UpdateObraPatch.progressSeasons?: ObraSeason[] | null`
- `MetadataDetails.seasonDetails?: MetadataSeason[]`
- `MetadataSearchResult.seasonDetails?: MetadataSeason[]`

`ObraMetadata.seasons` sigue siendo `number` (cantidad de temporadas) para no
romper la ficha técnica existente.

## Metadata TMDB

En `getTmdbDetails` leer `data.seasons` (array con `season_number` y
`episode_count`) y mapearlo a `seasonDetails`. Ignorar `season_number === 0`
(temporadas especiales) al importar.

## Helpers

Nuevo archivo `src/lib/season-progress.ts`:

- `getSeasonProgress(seasons, totalCurrent)` → `{ seasonNumber, episode, isComplete }`
- `setSeasonProgress(seasons, seasonNumber, episode)` → nuevo `totalCurrent`
- `totalEpisodesForSeasons(seasons)` → suma de episodios
- `validateSeasons(seasons)` → ordena y valida

## UI

### Ficha (`src/routes/obra/$obraId.tsx`)

Panel de progreso actual:

```
Progreso
40 / 208
Avance en episodios.
```

Nuevo:

```
Progreso
Temporada 2 · Capítulo 8
40 / 208
Avance en episodios.
```

Solo se muestra la línea de temporada/capítulo cuando `progressSeasons` existe.

### Edit sheet (`src/components/obra-edit-sheet.tsx`)

Dentro de la sección "Progreso", agregar:

1. Línea compacta actual: "Temporada 2 · Capítulo 8".
2. Botón "Editar por temporadas".
3. Al hacer clic, abrir un colapsable o sheet secundario con:
   - Lista de temporadas con input de episodios totales.
   - Botones +/− para agregar/eliminar temporadas.
   - Grilla visual de episodios (una fila por temporada, celdas numeradas).
   - Inputs de "Temporada" y "Capítulo" actual.

## Actualización de progreso

- Si el usuario mueve el slider global o presiona +/−, se actualiza
  `progressCurrent` directamente.
- Si el usuario edita temporada/capítulo, se recalcula `progressCurrent`
  mediante `setSeasonProgress`.
- Si el usuario modifica la distribución de temporadas, se recalcula
  `progressTotal` y se ajusta `progressCurrent` si es necesario.

## Tests

- Helpers en `src/lib/season-progress.test.ts`:
  - Conversión correcta con temporadas irregulares.
  - Casos borde: temporada 1 capítulo 1, último capítulo, progreso 0.
- Actualizar tests de metadata si es necesario.

## Comandos de verificación

- `bun run check`
- `bun run test`
