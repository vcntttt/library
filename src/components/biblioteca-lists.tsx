import { Link } from "@tanstack/react-router";
import { ExternalLink, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { Obra, ObraId } from "@/lib/types";
import type { LibrarySort, SortKey } from "./biblioteca-filtering";
import type { VisibleColumns } from "./biblioteca-preferences";
import { ObraCard } from "./obra-card";
import { ObraStatusCell } from "./obra-status-cell";
import { TypeBadge } from "./type-badge";

const MOBILE_LIST_SKELETON_KEYS = ["m1", "m2", "m3", "m4"];
const DESKTOP_LIST_SKELETON_KEYS = ["d1", "d2", "d3", "d4", "d5", "d6"];
function normalizeReadingUrl(value?: string) {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
interface LibraryListProps {
	filteredObras: Obra[];
	isLoading: boolean;
}
export function BibliotecaMobileList({
	filteredObras,
	isLoading,
}: LibraryListProps) {
	return (
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
	);
}
export function BibliotecaDesktopList({
	filteredObras,
	isLoading,
	visibleColumns,
	sort,
	onSort: handleSort,
	onEdit,
}: LibraryListProps & {
	visibleColumns: VisibleColumns;
	sort: LibrarySort;
	onSort: (key: SortKey) => void;
	onEdit: (id: ObraId) => void;
}) {
	const sortKey = sort.key;
	const sortDir = sort.dir;
	const columnCount =
		2 +
		Number(visibleColumns.type) +
		Number(visibleColumns.status) +
		Number(visibleColumns.reading);
	return (
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
						filteredObras.map((obra) => (
							<BibliotecaRow
								key={obra.id}
								obra={obra}
								visibleColumns={visibleColumns}
								onEdit={onEdit}
							/>
						))
					)}
				</TableBody>
			</Table>
		</div>
	);
}
function BibliotecaRow({
	obra,
	visibleColumns,
	onEdit,
}: {
	obra: Obra;
	visibleColumns: VisibleColumns;
	onEdit: (id: ObraId) => void;
}) {
	const metaLine = getObraMetaLine(obra);
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
					</div>
				</div>
			</TableCell>
			{visibleColumns.type && (
				<TableCell>
					<TypeBadge type={obra.type} format={obra.format} showIcon={false} />
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
						<span className="text-sm text-muted-foreground">-</span>
					)}
				</TableCell>
			)}
			<TableCell className="text-right">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-9 rounded-none text-muted-foreground hover:text-foreground"
					aria-label={`Editar ${obra.title}`}
					onClick={() => onEdit(obra.id)}
				>
					<Pencil className="size-4" />
				</Button>
			</TableCell>
		</TableRow>
	);
}
