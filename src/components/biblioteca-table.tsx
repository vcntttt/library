"use client";

import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import type { Obra, ObraStatus, ObraType } from "@/lib/types";
import { Search } from "./icons";
import { StarRating } from "./star-rating";
import { StatusBadge } from "./status-badge";
import { TypeBadge } from "./type-badge";

type SortKey = "title" | "type" | "status" | "rating" | "updatedAt";

const typeLabels: Record<ObraType | "all", string> = {
	all: "Todos los tipos",
	book: "Libro",
	movie: "Pelicula",
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
				case "rating":
					comparison = (a.rating ?? 0) - (b.rating ?? 0);
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
			<div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="relative flex-1 min-w-[220px]">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Buscar por titulo, autor o etiqueta..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-9 rounded-full bg-background/70 shadow-sm"
						/>
					</div>
					<div className="flex flex-wrap gap-2">
						<Select
							value={typeFilter}
							onValueChange={(v) => setTypeFilter(v as ObraType | "all")}
						>
							<SelectTrigger className="w-[130px] rounded-full bg-background/70 shadow-sm">
								<span className="truncate">{typeLabels[typeFilter]}</span>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Todos los tipos</SelectItem>
								<SelectItem value="book">Libro</SelectItem>
								<SelectItem value="movie">Pelicula</SelectItem>
								<SelectItem value="series">Serie</SelectItem>
								<SelectItem value="anime">Anime</SelectItem>
								<SelectItem value="manga">Manga</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={statusFilter}
							onValueChange={(v) => setStatusFilter(v as ObraStatus | "all")}
						>
							<SelectTrigger className="w-[140px] rounded-full bg-background/70 shadow-sm">
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
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-border/60 bg-card/70 shadow-sm overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow className="bg-muted/40 hover:bg-muted/40">
							<TableHead
								className="cursor-pointer select-none text-xs uppercase tracking-[0.2em] text-muted-foreground"
								onClick={() => handleSort("title")}
							>
								Titulo {sortKey === "title" && (sortDir === "asc" ? "↑" : "↓")}
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
								Estado {sortKey === "status" && (sortDir === "asc" ? "↑" : "↓")}
							</TableHead>
							<TableHead
								className="cursor-pointer select-none text-xs uppercase tracking-[0.2em] text-muted-foreground"
								onClick={() => handleSort("rating")}
							>
								Valoracion{" "}
								{sortKey === "rating" && (sortDir === "asc" ? "↑" : "↓")}
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
									colSpan={5}
									className="h-24 text-center text-muted-foreground"
								>
									No se encontraron obras
								</TableCell>
							</TableRow>
						) : (
							filteredObras.map((obra) => (
								<TableRow
									key={obra.id}
									className="group transition-colors hover:bg-muted/40"
								>
									<TableCell>
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
									</TableCell>
									<TableCell>
										<TypeBadge type={obra.type} showIcon={false} />
									</TableCell>
									<TableCell>
										<StatusBadge status={obra.status} />
									</TableCell>
									<TableCell>
										{obra.rating ? (
											<StarRating rating={obra.rating} size="sm" />
										) : (
											"—"
										)}
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
							))
						)}
					</TableBody>
				</Table>
			</div>

			<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
				Mostrando {filteredObras.length} de {obras.length} obras
			</p>
		</div>
	);
}
