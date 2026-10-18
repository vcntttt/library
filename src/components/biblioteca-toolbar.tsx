import { Search, SlidersHorizontal, Table2, X } from "lucide-react";
import type { ReactNode } from "react";
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
import type { ObraStatus, ObraType } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
	type FilterOption,
	type LibraryFilters,
	type LibrarySort,
	type SortDir,
	type SortKey,
	sortOptions,
	sortValueOf,
	statusOptions,
	toggleValue,
	typeOptions,
} from "./biblioteca-filtering";
import type { VisibleColumns } from "./biblioteca-preferences";

interface LibraryToolbarProps {
	children?: ReactNode;
	search: string;
	onSearchChange: (value: string) => void;
	filters: LibraryFilters;
	onFiltersChange: (value: LibraryFilters) => void;
	sort: LibrarySort;
	onSortChange: (value: LibrarySort) => void;
	typeCounts: Map<ObraType, number>;
	statusCounts: Map<ObraStatus, number>;
	columns?: VisibleColumns;
	onColumnsChange?: (value: VisibleColumns) => void;
}
export function LibraryToolbar({
	search,
	onSearchChange: setSearch,
	filters,
	onFiltersChange,
	sort,
	onSortChange,
	typeCounts,
	statusCounts,
	columns,
	onColumnsChange,
	children,
}: LibraryToolbarProps) {
	const typeFilters = filters.types;
	const statusFilters = filters.statuses;
	const setTypeFilters = (types: ObraType[]) =>
		onFiltersChange({ ...filters, types });
	const setStatusFilters = (statuses: ObraStatus[]) =>
		onFiltersChange({ ...filters, statuses });
	const activeFiltersCount = typeFilters.length + statusFilters.length;
	const sortValue = sortValueOf(sort);
	return (
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
						<DropdownMenuTrigger
							render={
								<Button
									type="button"
									variant="outline"
									className={cn(
										"h-10 gap-1.5 rounded-none border-border bg-background px-3 text-sm font-normal shadow-none",
										activeFiltersCount > 0 &&
											"border-foreground text-foreground",
									)}
								/>
							}
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
						</DropdownMenuTrigger>
						<DropdownMenuContent className="w-[260px] rounded-none" align="end">
							<LibraryFilterGroup
								label="Tipos"
								options={typeOptions}
								selected={typeFilters}
								counts={typeCounts}
								onChange={setTypeFilters}
							/>
							<DropdownMenuSeparator />
							<LibraryFilterGroup
								label="Estados"
								options={statusOptions}
								selected={statusFilters}
								counts={statusCounts}
								onChange={setStatusFilters}
							/>
							{activeFiltersCount > 0 && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() => {
											onFiltersChange({ types: [], statuses: [] });
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
							if (!value) return;
							const [key, direction] = value.split(":") as [SortKey, SortDir];
							onSortChange({ key, dir: direction });
						}}
					>
						<SelectTrigger
							aria-label="Ordenar obras"
							className="!h-10 w-auto min-w-[200px] rounded-none border-border bg-background px-3 text-sm font-normal shadow-none focus:ring-primary"
						>
							<span className="truncate">
								{sortOptions.find(
									(option) => sortValueOf(option.sort) === sortValue,
								)?.label ?? "Ordenar"}
							</span>
						</SelectTrigger>
						<SelectContent className="rounded-none" align="end">
							{sortOptions.map((option) => (
								<SelectItem
									key={sortValueOf(option.sort)}
									value={sortValueOf(option.sort)}
								>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{columns && onColumnsChange && (
						<LibraryColumnsMenu
							visibleColumns={columns}
							setVisibleColumns={onColumnsChange}
						/>
					)}
					{children}
				</div>
			</div>
		</div>
	);
}

function LibraryFilterGroup<T extends string>({
	label,
	options,
	selected,
	counts,
	onChange,
}: {
	label: string;
	options: FilterOption<T>[];
	selected: T[];
	counts: Map<T, number>;
	onChange: (value: T[]) => void;
}) {
	const selectedValues = new Set(selected);
	return (
		<DropdownMenuGroup>
			<div className="flex items-center justify-between gap-2 px-2 py-1.5">
				<DropdownMenuLabel className="px-0 py-0 text-sm font-medium">
					{label}
				</DropdownMenuLabel>
				{selected.length > 0 && (
					<DropdownMenuItem
						onClick={() => onChange([])}
						className="h-7 px-2 text-xs text-muted-foreground"
					>
						<X className="size-3.5" />
						Limpiar
					</DropdownMenuItem>
				)}
			</div>
			<DropdownMenuSeparator />
			{options.map((option) => (
				<DropdownMenuCheckboxItem
					key={option.value}
					checked={selectedValues.has(option.value)}
					onCheckedChange={() => onChange(toggleValue(selected, option.value))}
					className="min-h-9 rounded-none"
				>
					<span className="flex min-w-0 flex-1 items-center justify-between gap-3">
						<span className="truncate">{option.label}</span>
						<span className="text-xs tabular-nums text-muted-foreground">
							{counts.get(option.value) ?? 0}
						</span>
					</span>
				</DropdownMenuCheckboxItem>
			))}
		</DropdownMenuGroup>
	);
}
function LibraryColumnsMenu({
	visibleColumns,
	setVisibleColumns,
}: {
	visibleColumns: VisibleColumns;
	setVisibleColumns: (value: VisibleColumns) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						variant="outline"
						className={cn(
							"h-10 gap-1.5 rounded-none border-border bg-background px-3 text-sm font-normal shadow-none",
						)}
					/>
				}
			>
				<Table2 className="size-4" />
				<span className="hidden sm:inline">Columnas</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-[200px] rounded-none" align="end">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="px-2 py-1.5 text-sm font-medium">
						Mostrar columnas
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuCheckboxItem
						checked={visibleColumns.type}
						onCheckedChange={() =>
							setVisibleColumns({
								...visibleColumns,
								type: !visibleColumns.type,
							})
						}
						className="min-h-9 rounded-none"
					>
						Tipo
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem
						checked={visibleColumns.status}
						onCheckedChange={() =>
							setVisibleColumns({
								...visibleColumns,
								status: !visibleColumns.status,
							})
						}
						className="min-h-9 rounded-none"
					>
						Estado
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem
						checked={visibleColumns.reading}
						onCheckedChange={() =>
							setVisibleColumns({
								...visibleColumns,
								reading: !visibleColumns.reading,
							})
						}
						className="min-h-9 rounded-none"
					>
						Leer
					</DropdownMenuCheckboxItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
