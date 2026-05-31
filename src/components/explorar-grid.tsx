"use client";

import { LayoutGrid, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { Obra, ObraStatus, ObraType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Search } from "./icons";
import { ObraCard } from "./obra-card";

type SortKey =
	| "title"
	| "type"
	| "status"
	| "year"
	| "startedAt"
	| "finishedAt"
	| "createdAt"
	| "updatedAt";
type SortDir = "asc" | "desc";
type SortValue = `${SortKey}:${SortDir}`;
type FilterOption<T extends string> = {
	value: T;
	label: string;
};

interface SortOption {
	value: SortValue;
	label: string;
}

const typeOptions: FilterOption<ObraType>[] = [
	{ value: "book", label: "Libro" },
	{ value: "movie", label: "Película" },
	{ value: "series", label: "Serie" },
	{ value: "anime", label: "Anime" },
	{ value: "manga", label: "Manga" },
];

const statusOptions: FilterOption<ObraStatus>[] = [
	{ value: "backlog", label: "Pendiente" },
	{ value: "in-progress", label: "En progreso" },
	{ value: "paused", label: "Pausada" },
	{ value: "hiatus", label: "Hiatus" },
	{ value: "finished", label: "Terminada" },
	{ value: "dropped", label: "Abandonada" },
];

const sortOptions: SortOption[] = [
	{ value: "updatedAt:desc", label: "Actualización reciente" },
	{ value: "finishedAt:desc", label: "Terminadas recientemente" },
	{ value: "finishedAt:asc", label: "Fecha de término antigua" },
	{ value: "startedAt:desc", label: "Inicio reciente" },
	{ value: "createdAt:desc", label: "Agregadas recientemente" },
	{ value: "title:asc", label: "Título A-Z" },
	{ value: "title:desc", label: "Título Z-A" },
	{ value: "year:desc", label: "Año más reciente" },
	{ value: "year:asc", label: "Año más antiguo" },
	{ value: "type:asc", label: "Tipo" },
	{ value: "status:asc", label: "Estado" },
];

const GRID_SKELETON_KEYS = [
	"g1",
	"g2",
	"g3",
	"g4",
	"g5",
	"g6",
	"g7",
	"g8",
	"g9",
	"g10",
];

const FILTERS_STORAGE_KEY = "library:explorar:filters";
const SORT_STORAGE_KEY = "library:explorar:sort";

function readFilters() {
	try {
		const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
		if (!raw) return { types: [] as ObraType[], statuses: [] as ObraStatus[] };
		const parsed = JSON.parse(raw) as {
			types?: ObraType[];
			statuses?: ObraStatus[];
		};
		return {
			types: Array.isArray(parsed.types) ? parsed.types : ([] as ObraType[]),
			statuses: Array.isArray(parsed.statuses)
				? parsed.statuses
				: ([] as ObraStatus[]),
		};
	} catch {
		return { types: [] as ObraType[], statuses: [] as ObraStatus[] };
	}
}

function readSort(): { key: SortKey; dir: SortDir } {
	try {
		const raw = window.localStorage.getItem(SORT_STORAGE_KEY);
		if (!raw) return { key: "updatedAt", dir: "desc" };
		const parsed = JSON.parse(raw) as { key?: SortKey; dir?: SortDir };
		const key =
			parsed.key &&
			sortOptions.some((o) => o.value.startsWith(`${parsed.key}:`))
				? parsed.key
				: "updatedAt";
		const dir =
			parsed.dir === "asc" || parsed.dir === "desc" ? parsed.dir : "desc";
		return { key, dir };
	} catch {
		return { key: "updatedAt", dir: "desc" };
	}
}

const toggleValue = <T extends string>(values: T[], value: T) =>
	values.includes(value)
		? values.filter((item) => item !== value)
		: [...values, value];

const compareOptionalNumber = (
	a: number | undefined,
	b: number | undefined,
	direction: SortDir,
) => {
	const aHasValue = typeof a === "number";
	const bHasValue = typeof b === "number";
	if (!aHasValue && !bHasValue) return 0;
	if (!aHasValue) return 1;
	if (!bHasValue) return -1;

	const comparison = a - b;
	return direction === "asc" ? comparison : -comparison;
};

const sortValueFromParts = (key: SortKey, dir: SortDir): SortValue =>
	`${key}:${dir}`;

export function ExplorarGrid({
	obras,
	isLoading = false,
}: {
	obras: Obra[];
	isLoading?: boolean;
}) {
	const [search, setSearch] = useState("");
	const [typeFilters, setTypeFilters] = useState<ObraType[]>(() => {
		if (typeof window === "undefined") return [];
		return readFilters().types;
	});
	const [statusFilters, setStatusFilters] = useState<ObraStatus[]>(() => {
		if (typeof window === "undefined") return [];
		return readFilters().statuses;
	});
	const [sortKey, setSortKey] = useState<SortKey>(() => {
		if (typeof window === "undefined") return "updatedAt";
		return readSort().key;
	});
	const [sortDir, setSortDir] = useState<SortDir>(() => {
		if (typeof window === "undefined") return "desc";
		return readSort().dir;
	});

	useEffect(() => {
		window.localStorage.setItem(
			FILTERS_STORAGE_KEY,
			JSON.stringify({ types: typeFilters, statuses: statusFilters }),
		);
	}, [typeFilters, statusFilters]);

	useEffect(() => {
		window.localStorage.setItem(
			SORT_STORAGE_KEY,
			JSON.stringify({ key: sortKey, dir: sortDir }),
		);
	}, [sortKey, sortDir]);

	const filteredObras = useMemo(() => {
		let result = [...obras];

		if (search) {
			const q = search.toLowerCase();
			result = result.filter(
				(w) =>
					w.title.toLowerCase().includes(q) ||
					w.creator?.toLowerCase().includes(q) ||
					w.recommendedBy?.toLowerCase().includes(q),
			);
		}

		if (typeFilters.length > 0) {
			result = result.filter((w) => typeFilters.includes(w.type));
		}

		if (statusFilters.length > 0) {
			result = result.filter((w) => statusFilters.includes(w.status));
		}

		result.sort((a, b) => {
			let comparison = 0;
			switch (sortKey) {
				case "title":
					comparison = a.title.localeCompare(b.title);
					break;
				case "type":
					comparison = a.type.localeCompare(b.type);
					break;
				case "status":
					comparison = a.status.localeCompare(b.status);
					break;
				case "year":
					comparison = compareOptionalNumber(a.year, b.year, sortDir);
					break;
				case "startedAt":
					comparison = compareOptionalNumber(a.startedAt, b.startedAt, sortDir);
					break;
				case "finishedAt":
					comparison = compareOptionalNumber(
						a.finishedAt,
						b.finishedAt,
						sortDir,
					);
					break;
				case "createdAt":
					comparison = compareOptionalNumber(a.createdAt, b.createdAt, sortDir);
					break;
				case "updatedAt":
					comparison = compareOptionalNumber(a.updatedAt, b.updatedAt, sortDir);
					break;
			}
			if (sortKey === "title" || sortKey === "type" || sortKey === "status") {
				comparison = sortDir === "asc" ? comparison : -comparison;
			}
			if (comparison !== 0) return comparison;
			return a.title.localeCompare(b.title);
		});

		return result;
	}, [obras, search, typeFilters, statusFilters, sortKey, sortDir]);

	const typeCounts = useMemo(
		() =>
			typeOptions.reduce(
				(counts, option) => {
					counts[option.value] = obras.filter(
						(obra) => obra.type === option.value,
					).length;
					return counts;
				},
				{} as Record<ObraType, number>,
			),
		[obras],
	);

	const statusCounts = useMemo(
		() =>
			statusOptions.reduce(
				(counts, option) => {
					counts[option.value] = obras.filter(
						(obra) => obra.status === option.value,
					).length;
					return counts;
				},
				{} as Record<ObraStatus, number>,
			),
		[obras],
	);

	const activeFiltersCount = typeFilters.length + statusFilters.length;

	const sortValue = sortValueFromParts(sortKey, sortDir);

	return (
		<div className="space-y-6">
			<div className="border border-border bg-card p-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="relative min-w-0 flex-1">
						<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							aria-label="Buscar obras"
							placeholder="Buscar por título, autor o recomendación..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="h-10 rounded-none border-border bg-background pl-9 text-base shadow-none placeholder:text-muted-foreground focus-visible:ring-primary sm:text-sm"
						/>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="outline"
									className={cn(
										"h-10 gap-1.5 rounded-none border-border bg-background px-3 text-sm font-normal shadow-none",
										activeFiltersCount > 0 &&
											"border-foreground text-foreground",
									)}
								>
									<SlidersHorizontal className="size-4" />
									Filtros
									{activeFiltersCount > 0 && (
										<Badge
											variant="default"
											className="h-5 min-w-5 rounded-full px-1.5 text-xs"
										>
											{activeFiltersCount}
										</Badge>
									)}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-[260px] rounded-none"
								align="end"
							>
								<DropdownMenuGroup>
									<div className="flex items-center justify-between gap-2 px-2 py-1.5">
										<DropdownMenuLabel className="px-0 py-0 text-sm font-medium">
											Tipos
										</DropdownMenuLabel>
										{typeFilters.length > 0 && (
											<DropdownMenuItem
												onClick={() => setTypeFilters([])}
												className="h-7 px-2 text-xs text-muted-foreground"
											>
												<X className="size-3.5" />
												Limpiar
											</DropdownMenuItem>
										)}
									</div>
									<DropdownMenuSeparator />
									{typeOptions.map((option) => (
										<DropdownMenuCheckboxItem
											key={option.value}
											checked={typeFilters.includes(option.value)}
											onCheckedChange={() =>
												setTypeFilters((current) =>
													toggleValue(current, option.value),
												)
											}
											className="min-h-9 rounded-none"
										>
											<span className="flex min-w-0 flex-1 items-center justify-between gap-3">
												<span className="truncate">{option.label}</span>
												<span className="text-xs tabular-nums text-muted-foreground">
													{typeCounts[option.value] ?? 0}
												</span>
											</span>
										</DropdownMenuCheckboxItem>
									))}
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
									<div className="flex items-center justify-between gap-2 px-2 py-1.5">
										<DropdownMenuLabel className="px-0 py-0 text-sm font-medium">
											Estados
										</DropdownMenuLabel>
										{statusFilters.length > 0 && (
											<DropdownMenuItem
												onClick={() => setStatusFilters([])}
												className="h-7 px-2 text-xs text-muted-foreground"
											>
												<X className="size-3.5" />
												Limpiar
											</DropdownMenuItem>
										)}
									</div>
									<DropdownMenuSeparator />
									{statusOptions.map((option) => (
										<DropdownMenuCheckboxItem
											key={option.value}
											checked={statusFilters.includes(option.value)}
											onCheckedChange={() =>
												setStatusFilters((current) =>
													toggleValue(current, option.value),
												)
											}
											className="min-h-9 rounded-none"
										>
											<span className="flex min-w-0 flex-1 items-center justify-between gap-3">
												<span className="truncate">{option.label}</span>
												<span className="text-xs tabular-nums text-muted-foreground">
													{statusCounts[option.value] ?? 0}
												</span>
											</span>
										</DropdownMenuCheckboxItem>
									))}
								</DropdownMenuGroup>
								{activeFiltersCount > 0 && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onClick={() => {
												setTypeFilters([]);
												setStatusFilters([]);
											}}
											className="h-9 rounded-none text-sm text-muted-foreground"
										>
											<X className="mr-1.5 size-3.5" />
											Limpiar todos los filtros
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
						<Select
							value={sortValue}
							onValueChange={(value) => {
								const [key, direction] = value.split(":") as [SortKey, SortDir];
								setSortKey(key);
								setSortDir(direction);
							}}
						>
							<SelectTrigger
								aria-label="Ordenar obras"
								className="!h-10 w-auto min-w-[200px] rounded-none border-border bg-background px-3 text-sm font-normal shadow-none focus:ring-primary"
							>
								<span className="truncate">
									{sortOptions.find((option) => option.value === sortValue)
										?.label ?? "Ordenar"}
								</span>
							</SelectTrigger>
							<SelectContent className="rounded-none" align="end">
								{sortOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<div className="inline-flex items-center overflow-hidden border border-border bg-card">
							<Button
								size="sm"
								variant="ghost"
								className="h-10 flex-1 rounded-none px-3 text-sm sm:flex-none bg-foreground text-background"
								disabled
							>
								<LayoutGrid className="size-3.5" />
								<span className="hidden sm:inline">Grid</span>
							</Button>
						</div>
					</div>
				</div>
			</div>

			<div className="space-y-4">
				{isLoading ? (
					<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
						{GRID_SKELETON_KEYS.map((key) => (
							<div
								key={key}
								className="overflow-hidden border border-border bg-card"
							>
								<Skeleton className="aspect-[4/5] w-full rounded-none" />
								<div className="space-y-2 p-3">
									<Skeleton className="h-4 w-20 rounded-none" />
									<Skeleton className="h-4 w-3/4 rounded-none" />
									<Skeleton className="h-3 w-1/2 rounded-none" />
								</div>
							</div>
						))}
					</div>
				) : filteredObras.length === 0 ? (
					<div className="border border-dashed border-border bg-card py-10 text-center">
						<p className="text-sm font-medium text-card-foreground">
							No se encontraron obras
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							Prueba con otros filtros o términos de búsqueda.
						</p>
					</div>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
						{filteredObras.map((obra) => (
							<ObraCard key={obra.id} obra={obra} variant="grid" />
						))}
					</div>
				)}
			</div>

			<p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
				{isLoading
					? "Cargando obras..."
					: `Mostrando ${filteredObras.length} de ${obras.length} obras`}
			</p>
		</div>
	);
}
