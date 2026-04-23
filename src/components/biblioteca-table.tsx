"use client";

import { Link } from "@tanstack/react-router";
import { ExternalLink, LayoutGrid, List } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ProgressBar } from "./progress-bar";
import { StatusBadge } from "./status-badge";
import { TypeBadge } from "./type-badge";

type SortKey = "title" | "type" | "status" | "updatedAt";

const typeLabels: Record<ObraType | "all", string> = {
	all: "Todos los tipos",
	book: "Libro",
	movie: "Película",
	series: "Serie",
	anime: "Anime",
	manga: "Manga",
};

const statusLabels: Record<ObraStatus | "all", string> = {
	all: "Todos los estados",
	backlog: "Pendiente",
	"in-progress": "En progreso",
	finished: "Terminada",
	dropped: "Abandonada",
};

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

export function BibliotecaTable({
	obras,
	isLoading = false,
}: {
	obras: Obra[];
	isLoading?: boolean;
}) {
	const [search, setSearch] = useState("");
	const [typeFilter, setTypeFilter] = useState<ObraType | "all">("all");
	const [statusFilter, setStatusFilter] = useState<ObraStatus | "all">("all");
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
					w.tags.some((t: string) => t.toLowerCase().includes(q)),
			);
		}

		if (typeFilter !== "all") {
			result = result.filter((w) => w.type === typeFilter);
		}

		if (statusFilter !== "all") {
			result = result.filter((w) => w.status === statusFilter);
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
	}, [obras, search, typeFilter, statusFilter, sortKey, sortDir]);

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
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div className="relative w-full lg:max-w-md">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							aria-label="Buscar obras"
							placeholder="Buscar por título, autor o etiqueta..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-9 border-border bg-background rounded-none shadow-none focus-visible:ring-primary"
						/>
					</div>
					<div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
						<Select
							value={typeFilter}
							onValueChange={(v) => setTypeFilter(v as ObraType | "all")}
						>
							<SelectTrigger className="w-full border-border bg-background rounded-none shadow-none sm:w-[220px]">
								<span className="truncate">{typeLabels[typeFilter]}</span>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Todos los tipos</SelectItem>
								<SelectItem value="book">Libro</SelectItem>
								<SelectItem value="movie">Película</SelectItem>
								<SelectItem value="series">Serie</SelectItem>
								<SelectItem value="anime">Anime</SelectItem>
								<SelectItem value="manga">Manga</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={statusFilter}
							onValueChange={(v) => setStatusFilter(v as ObraStatus | "all")}
						>
							<SelectTrigger className="w-full border-border bg-background rounded-none shadow-none sm:w-[220px]">
								<span className="truncate">{statusLabels[statusFilter]}</span>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Todos los estados</SelectItem>
								<SelectItem value="backlog">Pendiente</SelectItem>
								<SelectItem value="in-progress">En progreso</SelectItem>
								<SelectItem value="finished">Terminada</SelectItem>
								<SelectItem value="dropped">Abandonada</SelectItem>
							</SelectContent>
						</Select>
						<div className="inline-flex w-full items-center overflow-hidden border border-border bg-card sm:w-auto">
							<Button
								size="sm"
								variant="ghost"
								className={cn(
									"h-10 flex-1 rounded-none border-r border-border px-3 text-xs sm:flex-none",
									view === "list"
										? "bg-foreground text-background"
										: "text-muted-foreground hover:bg-muted hover:text-foreground",
								)}
								onClick={() => setView("list")}
							>
								<List className="h-3.5 w-3.5" />
								Lista
							</Button>
							<Button
								size="sm"
								variant="ghost"
								className={cn(
									"h-10 flex-1 rounded-none px-3 text-xs sm:flex-none",
									view === "grid"
										? "bg-foreground text-background"
										: "text-muted-foreground hover:bg-muted hover:text-foreground",
								)}
								onClick={() => setView("grid")}
							>
								<LayoutGrid className="h-3.5 w-3.5" />
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
								<p className="mt-1 text-xs text-muted-foreground">
									Prueba quitando filtros o buscando otro término.
								</p>
							</div>
						) : (
							<div className="grid gap-3">
								{filteredObras.map((obra) => {
									const readingUrl = normalizeReadingUrl(obra.readingUrl);
									return (
										<div key={obra.id} className="space-y-2">
											<ObraCard obra={obra} variant="default" />
											{readingUrl && (
												<a
													href={readingUrl}
													target="_blank"
													rel="noreferrer"
													className="inline-flex h-9 items-center gap-1.5 border border-border bg-card px-3 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
												>
													<ExternalLink className="h-3.5 w-3.5" />
													Ir a leer
												</a>
											)}
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
									<TableHead className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
										<button
											type="button"
											className="inline-flex items-center gap-1 text-left transition-colors hover:text-foreground"
											onClick={() => handleSort("title")}
										>
											Título
											{sortKey === "title" && (sortDir === "asc" ? "↑" : "↓")}
										</button>
									</TableHead>
									<TableHead className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
										<button
											type="button"
											className="inline-flex items-center gap-1 text-left transition-colors hover:text-foreground"
											onClick={() => handleSort("type")}
										>
											Tipo
											{sortKey === "type" && (sortDir === "asc" ? "↑" : "↓")}
										</button>
									</TableHead>
									<TableHead className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
										<button
											type="button"
											className="inline-flex items-center gap-1 text-left transition-colors hover:text-foreground"
											onClick={() => handleSort("status")}
										>
											Estado
											{sortKey === "status" && (sortDir === "asc" ? "↑" : "↓")}
										</button>
									</TableHead>
									<TableHead className="hidden text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground sm:table-cell">
										Etiquetas
									</TableHead>
									<TableHead className="text-right text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
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
												<p className="mt-1 text-xs text-muted-foreground">
													Prueba quitando filtros o cambiando el orden.
												</p>
											</div>
										</TableCell>
									</TableRow>
								) : (
									filteredObras.map((obra) => {
										const metaLine = getObraMetaLine(obra);
										const showOngoingBadge =
											(obra.type === "series" || obra.type === "anime") &&
											isMetadataOngoing(obra.metadata?.status);
										const showUpToDateBadge = isObraUpToDate(obra);
										const showProgress =
											obra.type !== "movie" && (obra.progress?.total ?? 0) > 0;
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
																className="font-medium text-foreground hover:text-primary transition-colors"
															>
																{obra.title}
															</Link>
															{obra.creator && (
																<p className="text-sm text-muted-foreground">
																	{obra.creator}
																</p>
															)}
															{metaLine && (
																<p className="text-xs text-muted-foreground">
																	{metaLine}
																</p>
															)}
														</div>
													</div>
												</TableCell>
												<TableCell>
													<TypeBadge type={obra.type} showIcon={false} />
												</TableCell>
												<TableCell>
													<div className="space-y-2">
														<div className="flex flex-wrap items-center gap-2">
															<StatusBadge status={obra.status} />
															{showOngoingBadge && (
																<Badge
																	variant="outline"
																	className="h-5 rounded-none border-[#4A4E69]/30 bg-[#4A4E69]/8 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-[#4A4E69] dark:text-[#8A8EA9]"
																>
																	En emisión
																</Badge>
															)}
															{showUpToDateBadge && (
																<Badge
																	variant="outline"
																	className="h-5 rounded-none border-[#3A5A40]/30 bg-[#3A5A40]/8 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-[#3A5A40] dark:text-[#7AA080]"
																>
																	Al día
																</Badge>
															)}
														</div>
														{showProgress && obra.progress && (
															<ProgressBar
																current={obra.progress.current}
																total={obra.progress.total}
																type={obra.type}
																showLabel={false}
																className="w-28"
															/>
														)}
													</div>
												</TableCell>
												<TableCell className="hidden sm:table-cell">
													<div className="flex flex-wrap gap-2">
														{obra.tags.slice(0, 2).map((tag: string) => (
															<span
																key={tag}
																className="text-xs text-muted-foreground border-b border-border pb-0.5"
															>
																{tag}
															</span>
														))}
														{obra.tags.length > 2 && (
															<span className="text-xs text-muted-foreground">
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
															className="inline-flex h-9 items-center gap-1.5 border border-border bg-card px-3 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
														>
															<ExternalLink className="h-3.5 w-3.5" />
															Ir a leer
														</a>
													) : (
														<span className="text-xs text-muted-foreground">
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
							<p className="mt-1 text-xs text-muted-foreground">
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

			<p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
				{isLoading
					? "Cargando obras..."
					: `Mostrando ${filteredObras.length} de ${obras.length} obras`}
			</p>
		</div>
	);
}
