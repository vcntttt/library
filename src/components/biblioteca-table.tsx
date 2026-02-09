"use client";

import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
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

export function BibliotecaTable({ obras }: { obras: Obra[] }) {
	const [search, setSearch] = useState("");
	const [typeFilter, setTypeFilter] = useState<ObraType | "all">("all");
	const [statusFilter, setStatusFilter] = useState<ObraStatus | "all">("all");
	const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
	const [view, setView] = useState<"list" | "grid">("list");

	const filteredObras = useMemo(() => {
		let result = [...obras];

		// Search
		if (search) {
			const q = search.toLowerCase();
			result = result.filter(
				(w) =>
					w.title.toLowerCase().includes(q) ||
					w.creator?.toLowerCase().includes(q) ||
					w.tags.some((t: string) => t.toLowerCase().includes(q)),
			);
		}

		// Type filter
		if (typeFilter !== "all") {
			result = result.filter((w) => w.type === typeFilter);
		}

		// Status filter
		if (statusFilter !== "all") {
			result = result.filter((w) => w.status === statusFilter);
		}

		// Sort
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
			<div className="rounded-lg border border-border/60 bg-card/70 p-4 shadow-sm">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div className="relative w-full lg:max-w-md">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Buscar por título, autor o etiqueta..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-9 rounded-lg bg-background/70 shadow-sm"
						/>
					</div>
					<div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
						<Select
							value={typeFilter}
							onValueChange={(v) => setTypeFilter(v as ObraType | "all")}
						>
							<SelectTrigger className="w-full rounded-lg bg-background/70 shadow-sm sm:w-[220px]">
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
							<SelectTrigger className="w-full rounded-lg bg-background/70 shadow-sm sm:w-[220px]">
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
						<div className="hidden items-center overflow-hidden rounded-lg border border-border/60 bg-card/70 shadow-sm sm:inline-flex">
							<Button
								size="sm"
								variant="ghost"
								className={cn(
									"h-8 rounded-none border-r border-border/60 px-3 text-xs",
									view === "list"
										? "bg-foreground/10 text-foreground"
										: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
								)}
								onClick={() => setView("list")}
							>
								Lista
							</Button>
							<Button
								size="sm"
								variant="ghost"
								className={cn(
									"h-8 rounded-none px-3 text-xs",
									view === "grid"
										? "bg-foreground/10 text-foreground"
										: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
								)}
								onClick={() => setView("grid")}
							>
								Grid
							</Button>
						</div>
					</div>
				</div>
			</div>

			{view === "list" ? (
				<>
					<div className="sm:hidden">
						{filteredObras.length === 0 ? (
							<div className="rounded-lg border border-border/60 bg-card/70 py-10 text-center">
								<p className="text-sm text-muted-foreground">
									No se encontraron obras
								</p>
							</div>
						) : (
							<div className="grid gap-3">
								{filteredObras.map((obra) => (
									<ObraCard key={obra.id} obra={obra} variant="grid" />
								))}
							</div>
						)}
					</div>
					<div className="hidden rounded-lg border border-border/60 bg-card/70 shadow-sm overflow-hidden sm:block">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/40 hover:bg-muted/40">
									<TableHead
										className="cursor-pointer select-none text-xs uppercase tracking-[0.2em] text-muted-foreground"
										onClick={() => handleSort("title")}
									>
										Título{" "}
										{sortKey === "title" && (sortDir === "asc" ? "↑" : "↓")}
									</TableHead>
									<TableHead
										className="cursor-pointer select-none text-xs uppercase tracking-[0.2em] text-muted-foreground"
										onClick={() => handleSort("type")}
									>
										Tipo {sortKey === "type" && (sortDir === "asc" ? "↑" : "↓")}
									</TableHead>
									<TableHead
										className="cursor-pointer select-none text-xs uppercase tracking-[0.2em] text-muted-foreground"
										onClick={() => handleSort("status")}
									>
										Estado{" "}
										{sortKey === "status" && (sortDir === "asc" ? "↑" : "↓")}
									</TableHead>
									<TableHead className="hidden text-xs uppercase tracking-[0.2em] text-muted-foreground sm:table-cell">
										Etiquetas
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredObras.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={4}
											className="h-24 text-center text-muted-foreground"
										>
											No se encontraron obras
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
										return (
											<TableRow
												key={obra.id}
												className="group transition-colors hover:bg-muted/40"
											>
												<TableCell>
													<div className="flex items-center gap-3">
														{obra.coverUrl && (
															<div className="h-12 w-8 overflow-hidden rounded-md bg-muted/60">
																<img
																	src={obra.coverUrl}
																	alt=""
																	className="h-full w-full object-cover"
																	loading="lazy"
																/>
															</div>
														)}
														<div className="min-w-0">
															<Link
																to="/obra/$obraId"
																params={{ obraId: obra.id }}
																className="font-medium text-foreground hover:underline"
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
																	className="h-4 rounded-full border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-200"
																>
																	En emisión
																</Badge>
															)}
															{showUpToDateBadge && (
																<Badge
																	variant="outline"
																	className="h-4 rounded-full border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200"
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
													<div className="flex flex-wrap gap-1">
														{obra.tags.slice(0, 2).map((tag: string) => (
															<span
																key={tag}
																className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[0.65rem] tracking-[0.08em] text-muted-foreground"
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
					{filteredObras.length === 0 ? (
						<div className="rounded-lg border border-dashed border-border/60 bg-card/60 py-10 text-center">
							<p className="text-sm text-muted-foreground">
								No se encontraron obras
							</p>
						</div>
					) : (
						<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
							{filteredObras.map((obra) => (
								<ObraCard key={obra.id} obra={obra} variant="grid" />
							))}
						</div>
					)}
				</div>
			)}

			<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
				Mostrando {filteredObras.length} de {obras.length} obras
			</p>
		</div>
	);
}
