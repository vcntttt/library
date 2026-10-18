"use client";
import { LayoutGrid } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Obra } from "@/lib/types";
import { countBy, filterAndSortObras } from "./biblioteca-filtering";
import { useLibraryPreferences } from "./biblioteca-preferences";
import { LibraryToolbar } from "./biblioteca-toolbar";
import { ObraCard } from "./obra-card";

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
export function ExplorarGrid({
	obras,
	isLoading = false,
}: {
	obras: Obra[];
	isLoading?: boolean;
}) {
	const [search, setSearch] = useState("");
	const { filters, setFilters, sort, setSort } =
		useLibraryPreferences("explorar");
	const filteredObras = useMemo(
		() => filterAndSortObras(obras, { ...filters, search, sort }),
		[obras, filters, search, sort],
	);
	const typeCounts = useMemo(
		() => countBy(obras, (obra) => obra.type),
		[obras],
	);
	const statusCounts = useMemo(
		() => countBy(obras, (obra) => obra.status),
		[obras],
	);
	return (
		<div className="space-y-6">
			<LibraryToolbar
				search={search}
				onSearchChange={setSearch}
				filters={filters}
				onFiltersChange={setFilters}
				sort={sort}
				onSortChange={setSort}
				typeCounts={typeCounts}
				statusCounts={statusCounts}
			>
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
			</LibraryToolbar>

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
