"use client";

import { Link } from "@tanstack/react-router";
import { ChevronDown, ExternalLink, LayoutGrid, List, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

type SortKey = "title" | "type" | "status" | "updatedAt";
type FilterOption<T extends string> = {
	value: T;
	label: string;
};

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
	{ value: "finished", label: "Terminada" },
	{ value: "dropped", label: "Abandonada" },
];

const VIEW_STORAGE_KEY = "library:biblioteca:view";
const MOBILE_LIST_SKELETON_KEYS = ["m1", "m2", "m3", "m4"];
const DESKTOP_LIST_SKELETON_KEYS = ["d1", "d2", "d3", "d4", "d5", "d6"];
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

const getFilterSummary = <T extends string>(
	selected: T[],
	options: FilterOption<T>[],
	emptyLabel: string,
) => {
	if (selected.length === 0) return emptyLabel;
	if (selected.length === 1) {
		return (
			options.find((option) => option.value === selected[0])?.label ??
			emptyLabel
		);
	}
	return `${selected.length} seleccionados`;
};

function MultiFilter<T extends string>({
	label,
	emptyLabel,
	options,
	selected,
	counts,
	onToggle,
	onClear,
}: {
	label: string;
	emptyLabel: string;
	options: FilterOption<T>[];
	selected: T[];
	counts: Record<T, number>;
	onToggle: (value: T) => void;
	onClear: () => void;
}) {
	const summary = getFilterSummary(selected, options, emptyLabel);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="outline"
					className={cn(
						"h-10 w-full justify-between rounded-none border-border bg-background px-3 text-base font-normal shadow-none sm:w-[220px] sm:text-sm",
						selected.length > 0 && "border-foreground text-foreground",
					)}
				>
					<span className="truncate">{summary}</span>
					<ChevronDown className="size-4 shrink-0 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-[240px] rounded-none" align="start">
				<DropdownMenuGroup>
					<div className="flex items-center justify-between gap-2 px-1.5 py-1">
						<DropdownMenuLabel className="px-0 py-0">{label}</DropdownMenuLabel>
						{selected.length > 0 && (
							<DropdownMenuItem
								onClick={onClear}
								className="h-7 px-2 text-xs text-muted-foreground"
							>
								<X className="size-3.5" />
								Limpiar
							</DropdownMenuItem>
						)}
					</div>
					<DropdownMenuSeparator />
					{options.map((option) => {
						const checked = selected.includes(option.value);

						return (
							<DropdownMenuCheckboxItem
								key={option.value}
								checked={checked}
								onCheckedChange={() => onToggle(option.value)}
								className="min-h-9 rounded-none"
							>
								<span className="flex min-w-0 flex-1 items-center justify-between gap-3">
									<span className="truncate">{option.label}</span>
									<span className="text-xs tabular-nums text-muted-foreground">
										{counts[option.value] ?? 0}
									</span>
								</span>
							</DropdownMenuCheckboxItem>
						);
					})}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function BibliotecaTable({
	obras,
	isLoading = false,
}: {
	obras: Obra[];
	isLoading?: boolean;
}) {
	const [search, setSearch] = useState("");
	const [typeFilters, setTypeFilters] = useState<ObraType[]>([]);
	const [statusFilters, setStatusFilters] = useState<ObraStatus[]>([]);
	const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
	const [view, setView] = useState<"list" | "grid">(() => {
		if (typeof window === "undefined") return "list";
		const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
		return stored === "grid" ? "grid" : "list";
	});

	useEffect(() => {
		window.localStorage.setItem(VIEW_STORAGE_KEY, view);
	}, [view]);

	const filteredObras = useMemo(() => {
		let result = [...obras];

		if (search) {
			const q = search.toLowerCase();
			result = result.filter(
				(w) =>
					w.title.toLowerCase().includes(q) ||
					w.creator?.toLowerCase().includes(q) ||
					w.recommendedBy?.toLowerCase().includes(q) ||
					w.tags.some((t: string) => t.toLowerCase().includes(q)),
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
				case "updatedAt":
					comparison =
						new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
					break;
			}
			return sortDir === "asc" ? comparison : -comparison;
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
			setSortDir("asc");
		}
	};

	return (
		<div className="space-y-6">
			<div className="border border-border bg-card p-4">
				<div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
					<div className="relative w-full">
						<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							aria-label="Buscar obras"
							placeholder="Buscar por título, autor o etiqueta..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="rounded-none border-border bg-background pl-9 text-base shadow-none placeholder:text-muted-foreground focus-visible:ring-primary sm:text-sm"
						/>
					</div>
					<div className="grid w-full gap-2 sm:grid-cols-[minmax(180px,220px)_minmax(180px,220px)_auto] sm:items-center lg:w-auto lg:grid-cols-[220px_220px_auto_auto]">
						<MultiFilter
							label="Tipos"
							emptyLabel="Todos los tipos"
							options={typeOptions}
							selected={typeFilters}
							counts={typeCounts}
							onToggle={(value) =>
								setTypeFilters((current) => toggleValue(current, value))
							}
							onClear={() => setTypeFilters([])}
						/>
						<MultiFilter
							label="Estados"
							emptyLabel="Todos los estados"
							options={statusOptions}
							selected={statusFilters}
							counts={statusCounts}
							onToggle={(value) =>
								setStatusFilters((current) => toggleValue(current, value))
							}
							onClear={() => setStatusFilters([])}
						/>
						{activeFiltersCount > 0 && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-10 justify-start rounded-none px-3 text-sm text-muted-foreground hover:text-foreground sm:justify-center"
								onClick={() => {
									setTypeFilters([]);
									setStatusFilters([]);
								}}
							>
								<X className="size-3.5" />
								Limpiar filtros
							</Button>
						)}
						<div className="inline-flex w-full items-center overflow-hidden border border-border bg-card sm:w-auto lg:col-auto">
							<Button
								size="sm"
								variant="ghost"
								className={cn(
									"h-10 flex-1 rounded-none border-r border-border px-3 text-sm sm:flex-none",
									view === "list"
										? "bg-foreground text-background"
										: "text-muted-foreground hover:bg-muted hover:text-foreground",
								)}
								onClick={() => setView("list")}
							>
								<List className="size-3.5" />
								Lista
							</Button>
							<Button
								size="sm"
								variant="ghost"
								className={cn(
									"h-10 flex-1 rounded-none px-3 text-sm sm:flex-none",
									view === "grid"
										? "bg-foreground text-background"
										: "text-muted-foreground hover:bg-muted hover:text-foreground",
								)}
								onClick={() => setView("grid")}
							>
								<LayoutGrid className="size-3.5" />
								Grid
							</Button>
						</div>
					</div>
				</div>
			</div>

			{view === "list" ? (
				<>
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
									<TableHead className="hidden text-xs uppercase tracking-[0.12em] text-muted-foreground sm:table-cell">
										Etiquetas
									</TableHead>
									<TableHead className="text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
										Leer
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
											<TableCell>
												<Skeleton className="h-5 w-20 rounded-none" />
											</TableCell>
											<TableCell>
												<div className="space-y-2">
													<Skeleton className="h-5 w-24 rounded-none" />
													<Skeleton className="h-2 w-28" />
												</div>
											</TableCell>
											<TableCell className="hidden sm:table-cell">
												<div className="flex gap-1">
													<Skeleton className="h-5 w-14 rounded-none" />
													<Skeleton className="h-5 w-12 rounded-none" />
												</div>
											</TableCell>
											<TableCell className="text-right">
												<Skeleton className="ml-auto h-8 w-20 rounded-none" />
											</TableCell>
										</TableRow>
									))
								) : filteredObras.length === 0 ? (
									<TableRow>
										<TableCell colSpan={5} className="h-24">
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
												<TableCell>
													<TypeBadge type={obra.type} showIcon={false} />
												</TableCell>
												<TableCell>
													<ObraStatusCell
														obra={obra}
														showOngoingBadge={showOngoingBadge}
														showUpToDateBadge={showUpToDateBadge}
													/>
												</TableCell>
												<TableCell className="hidden sm:table-cell">
													<div className="flex flex-wrap gap-2">
														{obra.tags.slice(0, 2).map((tag: string) => (
															<span
																key={tag}
																className="border-b border-border pb-0.5 text-sm text-muted-foreground"
															>
																{tag}
															</span>
														))}
														{obra.tags.length > 2 && (
															<span className="text-sm text-muted-foreground">
																+{obra.tags.length - 2}
															</span>
														)}
													</div>
												</TableCell>
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
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</div>
				</>
			) : (
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
								Prueba con otros filtros o cambia a vista de lista.
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
			)}

			<p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
				{isLoading
					? "Cargando obras..."
					: `Mostrando ${filteredObras.length} de ${obras.length} obras`}
			</p>
		</div>
	);
}
