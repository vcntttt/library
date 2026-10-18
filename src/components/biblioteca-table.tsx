"use client";
import { useMemo, useState } from "react";
import type { Obra, ObraId } from "@/lib/types";
import {
	countBy,
	filterAndSortObras,
	toggleSort,
} from "./biblioteca-filtering";
import {
	BibliotecaDesktopList,
	BibliotecaMobileList,
} from "./biblioteca-lists";
import {
	useLibraryPreferences,
	useVisibleColumns,
} from "./biblioteca-preferences";
import { LibraryToolbar } from "./biblioteca-toolbar";
import { ObraEditSheet } from "./obra-edit-sheet";
export function BibliotecaTable({
	obras,
	isLoading = false,
}: {
	obras: Obra[];
	isLoading?: boolean;
}) {
	const [search, setSearch] = useState("");
	const { filters, setFilters, sort, setSort } =
		useLibraryPreferences("biblioteca");
	const [visibleColumns, setVisibleColumns] = useVisibleColumns();
	const [editingObraId, setEditingObraId] = useState<ObraId | null>(null);
	const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
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
				columns={visibleColumns}
				onColumnsChange={setVisibleColumns}
			/>
			<BibliotecaMobileList
				filteredObras={filteredObras}
				isLoading={isLoading}
			/>
			<BibliotecaDesktopList
				filteredObras={filteredObras}
				isLoading={isLoading}
				visibleColumns={visibleColumns}
				sort={sort}
				onSort={(key) => setSort(toggleSort(sort, key))}
				onEdit={(id) => {
					setEditingObraId(id);
					setIsEditSheetOpen(true);
				}}
			/>
			<p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
				{isLoading
					? "Cargando obras..."
					: `Mostrando ${filteredObras.length} de ${obras.length} obras`}
			</p>
			<ObraEditSheet
				obraId={editingObraId}
				open={isEditSheetOpen}
				onOpenChange={setIsEditSheetOpen}
			/>
		</div>
	);
}
