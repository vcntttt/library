import type { Obra, ObraStatus, ObraType } from "@/lib/types";

// Claves por las que se puede ordenar; `sortOptions` decide qué combinaciones ofrece la UI.
export const sortKeys = [
	"title",
	"type",
	"status",
	"year",
	"startedAt",
	"finishedAt",
	"createdAt",
	"updatedAt",
] as const;

export type SortKey = (typeof sortKeys)[number];
export type SortDir = "asc" | "desc";

export interface FilterOption<T extends string> {
	value: T;
	label: string;
}

export interface SortOption {
	label: string;
	sort: LibrarySort;
}

export interface LibraryFilters {
	types: ObraType[];
	statuses: ObraStatus[];
}

export interface LibrarySort {
	key: SortKey;
	dir: SortDir;
}

export interface LibraryQuery extends LibraryFilters {
	search: string;
	sort: LibrarySort;
}

export const typeOptions: FilterOption<ObraType>[] = [
	{ value: "book", label: "Libro" },
	{ value: "movie", label: "Película" },
	{ value: "series", label: "Serie" },
	{ value: "anime", label: "Anime" },
	{ value: "manga", label: "Manga" },
	{ value: "manhwa", label: "Manhwa" },
];

export const statusOptions: FilterOption<ObraStatus>[] = [
	{ value: "backlog", label: "Pendiente" },
	{ value: "in-progress", label: "En progreso" },
	{ value: "paused", label: "Pausada" },
	{ value: "hiatus", label: "Hiatus" },
	{ value: "finished", label: "Terminada" },
	{ value: "dropped", label: "Abandonada" },
];

export const sortOptions: SortOption[] = [
	{ label: "Actualización reciente", sort: { key: "updatedAt", dir: "desc" } },
	{
		label: "Terminadas recientemente",
		sort: { key: "finishedAt", dir: "desc" },
	},
	{
		label: "Fecha de término antigua",
		sort: { key: "finishedAt", dir: "asc" },
	},
	{ label: "Inicio reciente", sort: { key: "startedAt", dir: "desc" } },
	{ label: "Agregadas recientemente", sort: { key: "createdAt", dir: "desc" } },
	{ label: "Título A-Z", sort: { key: "title", dir: "asc" } },
	{ label: "Título Z-A", sort: { key: "title", dir: "desc" } },
	{ label: "Año más reciente", sort: { key: "year", dir: "desc" } },
	{ label: "Año más antiguo", sort: { key: "year", dir: "asc" } },
	{ label: "Tipo", sort: { key: "type", dir: "asc" } },
	{ label: "Estado", sort: { key: "status", dir: "asc" } },
];

export const sortValueOf = (sort: LibrarySort) => `${sort.key}:${sort.dir}`;

// Título, tipo y estado empiezan en A-Z; las fechas y años, del más reciente.
const getDefaultSortDir = (key: SortKey): SortDir =>
	key === "title" || key === "type" || key === "status" ? "asc" : "desc";

// Repetir la clave invierte la dirección; una clave nueva arranca con su dirección natural.
export const toggleSort = (sort: LibrarySort, key: SortKey): LibrarySort =>
	sort.key === key
		? { key, dir: sort.dir === "asc" ? "desc" : "asc" }
		: { key, dir: getDefaultSortDir(key) };

export const toggleValue = <T extends string>(values: T[], value: T) =>
	values.includes(value)
		? values.filter((item) => item !== value)
		: [...values, value];

export function countBy<T extends string>(
	obras: Obra[],
	pick: (obra: Obra) => T,
): Map<T, number> {
	const counts = new Map<T, number>();
	for (const obra of obras) {
		const value = pick(obra);
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	return counts;
}

// Búsqueda, filtros y orden de la biblioteca y de explorar; devuelve una copia nueva.
export function filterAndSortObras(obras: Obra[], query: LibraryQuery): Obra[] {
	const search = query.search.toLowerCase();
	const types = new Set(query.types);
	const statuses = new Set(query.statuses);

	return obras
		.filter(
			(obra) =>
				(!search || matchesSearch(obra, search)) &&
				(types.size === 0 || types.has(obra.type)) &&
				(statuses.size === 0 || statuses.has(obra.status)),
		)
		.sort((a, b) => compareObras(a, b, query.sort));
}

function matchesSearch(obra: Obra, search: string) {
	return [obra.title, obra.creator, obra.recommendedBy].some((field) =>
		field?.toLowerCase().includes(search),
	);
}

// El título sirve de desempate para que el orden sea estable entre recargas.
function compareObras(a: Obra, b: Obra, sort: LibrarySort) {
	const comparison = compareByKey(a, b, sort);
	return comparison !== 0 ? comparison : a.title.localeCompare(b.title);
}

function compareByKey(a: Obra, b: Obra, { key, dir }: LibrarySort): number {
	switch (key) {
		case "title":
			return directed(a.title.localeCompare(b.title), dir);
		case "type":
			return directed(a.type.localeCompare(b.type), dir);
		case "status":
			return directed(a.status.localeCompare(b.status), dir);
		case "year":
			return compareOptionalNumber(a.year, b.year, dir);
		case "startedAt":
			return compareOptionalNumber(a.startedAt, b.startedAt, dir);
		case "finishedAt":
			return compareOptionalNumber(a.finishedAt, b.finishedAt, dir);
		case "createdAt":
			return compareOptionalNumber(a.createdAt, b.createdAt, dir);
		case "updatedAt":
			return compareOptionalNumber(a.updatedAt, b.updatedAt, dir);
	}
}

const directed = (comparison: number, dir: SortDir) =>
	dir === "asc" ? comparison : -comparison;

// Las obras sin valor van al final en cualquier dirección.
function compareOptionalNumber(
	a: number | undefined,
	b: number | undefined,
	dir: SortDir,
) {
	const aHasValue = typeof a === "number";
	const bHasValue = typeof b === "number";
	if (!aHasValue && !bHasValue) return 0;
	if (!aHasValue) return 1;
	if (!bHasValue) return -1;

	return directed(a - b, dir);
}
