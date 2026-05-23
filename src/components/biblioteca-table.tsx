"use client";

import { Link } from "@tanstack/react-router";
import {
	ExternalLink,
	Pencil,
	SlidersHorizontal,
	Table2,
	X,
} from "lucide-react";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	getObraMetaLine,
	isMetadataOngoing,
	isObraUpToDate,
} from "@/lib/metadata/format";
import type { Obra, ObraStatus, ObraType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Search } from "./icons";
import { ObraCard } from "./obra-card";
import { ObraStatusCell } from "./obra-status-cell";
import { TypeBadge } from "./type-badge";

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
	{ value: "manhwa", label: "Manhwa" },
];

const statusOptions: FilterOption<ObraStatus>[] = [
	{ value: "backlog", label: "Pendiente" },
	{ value: "in-progress", label: "En progreso" },
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

const FILTERS_STORAGE_KEY = "library:biblioteca:filters";
const SORT_STORAGE_KEY = "library:biblioteca:sort";
const COLUMNS_STORAGE_KEY = "library:biblioteca:columns";

interface VisibleColumns {
	type: boolean;
	status: boolean;
	reading: boolean;
}

const defaultVisibleColumns: VisibleColumns = {
	type: true,
	status: true,
	reading: true,
};

function readColumns(): VisibleColumns {
	try {
		const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
		if (!raw) return defaultVisibleColumns;
		const parsed = JSON.parse(raw) as Partial<VisibleColumns>;
		return {
			type: parsed.type ?? true,
			status: parsed.status ?? true,
			reading: parsed.reading ?? true,
		};
	} catch {
		return defaultVisibleColumns;
	}
}

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

const MOBILE_LIST_SKELETON_KEYS = ["m1", "m2", "m3", "m4"];
const DESKTOP_LIST_SKELETON_KEYS = ["d1", "d2", "d3", "d4", "d5", "d6"];

const normalizeReadingUrl = (value?: string) => {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
};

const toggleValue = <T extends string>(values: T[], value: T) =>
	values.includes(value)
		? values.filter((item) => item !== value)
		: [...values, value];

const sortValueFromParts = (key: SortKey, dir: SortDir): SortValue =>
	`${key}:${dir}`;

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

const getDefaultSortDir = (key: SortKey): SortDir =>
	key === "title" || key === "type" || key === "status" ? "asc" : "desc";

export function BibliotecaTable({
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
	const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>(() => {
		if (typeof window === "undefined") return defaultVisibleColumns;
		return readColumns();
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

	useEffect(() => {
		window.localStorage.setItem(
			COLUMNS_STORAGE_KEY,
			JSON.stringify(visibleColumns),
		);
	}, [visibleColumns]);

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

	const handleSort = (key: SortKey) => {
		if (sortKey === key) {
			setSortDir(sortDir === "asc" ? "desc" : "asc");
		} else {
			setSortKey(key);
			setSortDir(getDefaultSortDir(key));
		}
	};

	const sortValue = sortValueFromParts(sortKey, sortDir);
	const columnCount =
		1 +
		(visibleColumns.type ? 1 : 0) +
		(visibleColumns.status ? 1 : 0) +
		(visibleColumns.reading ? 1 : 0) +
		1;

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
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="outline"
									className={cn(
										"h-10 gap-1.5 rounded-none border-border bg-background px-3 text-sm font-normal shadow-none",
									)}
								>
									<Table2 className="size-4" />
									<span className="hidden sm:inline">Columnas</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-[200px] rounded-none"
								align="end"
							>
								<DropdownMenuGroup>
									<DropdownMenuLabel className="px-2 py-1.5 text-sm font-medium">
										Mostrar columnas
									</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuCheckboxItem
										checked={visibleColumns.type}
										onCheckedChange={() =>
											setVisibleColumns((prev) => ({
												...prev,
												type: !prev.type,
											}))
										}
										className="min-h-9 rounded-none"
									>
										Tipo
									</DropdownMenuCheckboxItem>
									<DropdownMenuCheckboxItem
										checked={visibleColumns.status}
										onCheckedChange={() =>
											setVisibleColumns((prev) => ({
												...prev,
												status: !prev.status,
											}))
										}
										className="min-h-9 rounded-none"
									>
										Estado
									</DropdownMenuCheckboxItem>
									<DropdownMenuCheckboxItem
										checked={visibleColumns.reading}
										onCheckedChange={() =>
											setVisibleColumns((prev) => ({
												...prev,
												reading: !prev.reading,
											}))
										}
										className="min-h-9 rounded-none"
									>
										Leer
									</DropdownMenuCheckboxItem>
								</DropdownMenuGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</div>

			<div className="sm:hidden">
				{isLoading ? (
					<div className="grid gap-3">
						{MOBILE_LIST_SKELETON_KEYS.map((key) => (
							<div key={key} className="border border-border bg-card p-3">
								<div className="flex items-start gap-3">
									<Skeleton className="h-16 w-12 rounded-none" />
									<div className="min-w-0 flex-1 space-y-2">
										<Skeleton className="h-4 w-3/4" />
										<Skeleton className="h-3 w-1/2" />
										<Skeleton className="h-3 w-2/3" />
									</div>
								</div>
							</div>
						))}
					</div>
				) : filteredObras.length === 0 ? (
					<div className="border border-border bg-card px-4 py-10 text-center">
						<p className="text-sm font-medium text-card-foreground">
							No se encontraron obras
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							Prueba quitando filtros o buscando otro término.
						</p>
					</div>
				) : (
					<div className="grid gap-3">
						{filteredObras.map((obra) => {
							return (
								<div key={obra.id}>
									<ObraCard obra={obra} variant="default" />
								</div>
							);
						})}
					</div>
				)}
			</div>
			<div className="hidden border border-border bg-card shadow-sm overflow-hidden sm:block">
				<Table>
					<TableHeader>
						<TableRow className="bg-muted hover:bg-muted">
							<TableHead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
								<button
									type="button"
									className="inline-flex items-center gap-1 text-left transition-colors hover:text-foreground"
									onClick={() => handleSort("title")}
								>
									Título
									{sortKey === "title" && (sortDir === "asc" ? "↑" : "↓")}
								</button>
							</TableHead>
							{visibleColumns.type && (
								<TableHead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
									<button
										type="button"
										className="inline-flex items-center gap-1 text-left transition-colors hover:text-foreground"
										onClick={() => handleSort("type")}
									>
										Tipo
										{sortKey === "type" && (sortDir === "asc" ? "↑" : "↓")}
									</button>
								</TableHead>
							)}
							{visibleColumns.status && (
								<TableHead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
									<button
										type="button"
										className="inline-flex items-center gap-1 text-left transition-colors hover:text-foreground"
										onClick={() => handleSort("status")}
									>
										Estado
										{sortKey === "status" && (sortDir === "asc" ? "↑" : "↓")}
									</button>
								</TableHead>
							)}
							{visibleColumns.reading && (
								<TableHead className="text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
									Leer
								</TableHead>
							)}
							<TableHead className="w-16 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
								Editar
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							DESKTOP_LIST_SKELETON_KEYS.map((key) => (
								<TableRow key={key}>
									<TableCell>
										<div className="flex items-center gap-3">
											<Skeleton className="h-12 w-8 rounded-none" />
											<div className="min-w-0 space-y-2">
												<Skeleton className="h-4 w-44 rounded-none" />
												<Skeleton className="h-3 w-28 rounded-none" />
											</div>
										</div>
									</TableCell>
									{visibleColumns.type && (
										<TableCell>
											<Skeleton className="h-5 w-20 rounded-none" />
										</TableCell>
									)}
									{visibleColumns.status && (
										<TableCell>
											<div className="space-y-2">
												<Skeleton className="h-5 w-24 rounded-none" />
												<Skeleton className="h-2 w-28" />
											</div>
										</TableCell>
									)}
									{visibleColumns.reading && (
										<TableCell className="text-right">
											<Skeleton className="ml-auto h-8 w-20 rounded-none" />
										</TableCell>
									)}
									<TableCell className="text-right">
										<Skeleton className="ml-auto size-9 rounded-none" />
									</TableCell>
								</TableRow>
							))
						) : filteredObras.length === 0 ? (
							<TableRow>
								<TableCell colSpan={columnCount} className="h-24">
									<div className="text-center">
										<p className="text-sm font-medium text-card-foreground">
											No se encontraron obras
										</p>
										<p className="mt-1 text-sm text-muted-foreground">
											Prueba quitando filtros o cambiando el orden.
										</p>
									</div>
								</TableCell>
							</TableRow>
						) : (
							filteredObras.map((obra) => {
								const metaLine = getObraMetaLine(obra, "list");
								const showOngoingBadge =
									(obra.type === "series" || obra.type === "anime") &&
									isMetadataOngoing(obra.metadata?.status);
								const showUpToDateBadge = isObraUpToDate(obra);
								const readingUrl = normalizeReadingUrl(obra.readingUrl);
								return (
									<TableRow
										key={obra.id}
										className="group transition-colors hover:bg-muted/50"
									>
										<TableCell>
											<div className="flex items-center gap-3">
												{obra.coverUrl && (
													<div className="h-12 w-8 overflow-hidden bg-background">
														<img
															src={obra.coverUrl}
															alt={`Portada de ${obra.title}`}
															className="h-full w-full object-cover"
															loading="lazy"
														/>
													</div>
												)}
												<div className="min-w-0">
													<Link
														to="/obra/$obraId"
														params={{
															obraId: obra.id,
														}}
														className="block truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
													>
														{obra.title}
													</Link>
													{obra.creator && (
														<p className="truncate text-sm text-muted-foreground">
															{obra.creator}
														</p>
													)}
													{metaLine && (
														<p className="truncate text-sm text-muted-foreground">
															{metaLine}
														</p>
													)}
													{obra.recommendedBy && (
														<p className="truncate text-sm text-muted-foreground">
															Recomendada por {obra.recommendedBy}
														</p>
													)}
												</div>
											</div>
										</TableCell>
										{visibleColumns.type && (
											<TableCell>
												<TypeBadge type={obra.type} showIcon={false} />
											</TableCell>
										)}
										{visibleColumns.status && (
											<TableCell>
												<ObraStatusCell
													obra={obra}
													showOngoingBadge={showOngoingBadge}
													showUpToDateBadge={showUpToDateBadge}
												/>
											</TableCell>
										)}
										{visibleColumns.reading && (
											<TableCell className="text-right">
												{readingUrl ? (
													<a
														href={readingUrl}
														target="_blank"
														rel="noreferrer"
														className="inline-flex h-9 items-center gap-1.5 border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
													>
														<ExternalLink className="size-3.5" />
														Ir a leer
													</a>
												) : (
													<span className="text-sm text-muted-foreground">
														-
													</span>
												)}
											</TableCell>
										)}
										<TableCell className="text-right">
											<Button
												asChild
												type="button"
												variant="ghost"
												size="icon"
												className="size-9 rounded-none text-muted-foreground hover:text-foreground"
											>
												<Link
													to="/obra/$obraId"
													params={{ obraId: obra.id }}
													search={{ edit: true }}
													aria-label={`Editar ${obra.title}`}
												>
													<Pencil className="size-4" />
												</Link>
											</Button>
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</div>

			<p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
				{isLoading
					? "Cargando obras..."
					: `Mostrando ${filteredObras.length} de ${obras.length} obras`}
			</p>
		</div>
	);
}
