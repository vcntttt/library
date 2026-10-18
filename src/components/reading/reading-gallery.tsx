import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAuthToken } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { Shuffle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { AnnotationCard } from "@/components/reading/reading-gallery-card";
import { AnnotationDetail } from "@/components/reading/reading-gallery-detail";
import {
	filterGalleryEntries,
	type GalleryGroupBy,
	type GallerySort,
	groupGalleryEntries,
	sortGalleryEntries,
} from "@/components/reading/reading-gallery-model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

export function ReadingGallery() {
	const keptAnnotations = useQuery(convexApi.reading.listAnnotations, {
		status: "kept",
		limit: 500,
	});
	const obras = useQuery(convexApi.obras.list, { limit: 500 });
	const setStatus = useMutation(convexApi.reading.setAnnotationStatus);
	const authToken = useAuthToken();
	const [updatingAnnotationId, setUpdatingAnnotationId] =
		useState<Id<"readingAnnotations"> | null>(null);
	const [selectedAnnotationId, setSelectedAnnotationId] =
		useState<Id<"readingAnnotations"> | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedObraId, setSelectedObraId] = useState("all");
	const [groupBy, setGroupBy] = useState<GalleryGroupBy>("none");
	const [sortBy, setSortBy] = useState<GallerySort>("shuffle");
	const [shuffleSeed, setShuffleSeed] = useState(() => Date.now());
	const handleReshuffle = useCallback(() => setShuffleSeed(Date.now()), []);
	const obraTitles = useMemo(
		() => new Map((obras ?? []).map((obra) => [obra.id, obra.title])),
		[obras],
	);
	const selectedEntry =
		keptAnnotations?.find(
			({ annotation }) => annotation._id === selectedAnnotationId,
		) ?? null;
	const filteredEntries = useMemo(
		() =>
			keptAnnotations &&
			filterGalleryEntries(keptAnnotations, {
				searchQuery,
				selectedObraId,
				obraTitles,
			}),
		[keptAnnotations, obraTitles, searchQuery, selectedObraId],
	);
	const annotationGroups = useMemo(
		() =>
			filteredEntries &&
			groupGalleryEntries(
				sortGalleryEntries(filteredEntries, sortBy, shuffleSeed),
				groupBy,
			),
		[filteredEntries, groupBy, sortBy, shuffleSeed],
	);

	const handleStatusChange = async (id: Id<"readingAnnotations">) => {
		setUpdatingAnnotationId(id);
		setMessage(null);
		try {
			await setStatus({ id, status: "unprocessed" });
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "No se pudo devolver la anotación al inbox.",
			);
		} finally {
			setUpdatingAnnotationId(null);
		}
	};

	return (
		<section className="space-y-4">
			<div className="flex items-baseline justify-between gap-4">
				<div>
					<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
						Colección
					</p>
					<h2 className="font-serif text-2xl font-semibold">
						Galería de anotaciones
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Busca y revisa los pasajes que decidiste conservar.
					</p>
				</div>
				<span className="text-sm text-muted-foreground">
					{keptAnnotations?.length ?? "…"}
				</span>
			</div>

			<div className="grid gap-3 border border-border bg-card p-3 md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_minmax(9rem,11rem)_minmax(9rem,11rem)]">
				<Input
					value={searchQuery}
					onChange={(event) => setSearchQuery(event.target.value)}
					placeholder="Buscar pasajes, notas o comentarios…"
					aria-label="Buscar en la galería de anotaciones"
					className="rounded-none"
				/>
				<select
					value={selectedObraId}
					onChange={(event) => setSelectedObraId(event.target.value)}
					aria-label="Filtrar por obra"
					className="border border-border bg-background px-3 py-2 text-sm"
				>
					<option value="all">Todas las obras</option>
					<option value="unlinked">Sin obra vinculada</option>
					{obras?.map((obra) => (
						<option key={obra.id} value={obra.id}>
							{obra.title}
						</option>
					))}
				</select>
				<select
					value={groupBy}
					onChange={(event) => setGroupBy(event.target.value as GalleryGroupBy)}
					aria-label="Agrupar anotaciones"
					className="border border-border bg-background px-3 py-2 text-sm"
				>
					<option value="none">Sin agrupar</option>
					<option value="chapter">Agrupar por capítulo</option>
				</select>
				<select
					value={sortBy}
					onChange={(event) => setSortBy(event.target.value as GallerySort)}
					aria-label="Ordenar anotaciones"
					className="border border-border bg-background px-3 py-2 text-sm"
				>
					<option value="shuffle">Aleatorio</option>
					<option value="recent">Más recientes</option>
					<option value="oldest">Más antiguas</option>
				</select>
			</div>

			{keptAnnotations !== undefined && (
				<div className="flex items-center justify-between">
					<p className="text-xs text-muted-foreground">
						Mostrando {filteredEntries?.length ?? 0} de {keptAnnotations.length}{" "}
						anotaciones
					</p>
					{sortBy === "shuffle" && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="gap-1.5 rounded-none text-xs"
							onClick={handleReshuffle}
						>
							<Shuffle className="size-3.5" />
							Mezclar de nuevo
						</Button>
					)}
				</div>
			)}

			{filteredEntries === undefined ? (
				<Skeleton className="h-40 w-full rounded-none" />
			) : filteredEntries.length === 0 ? (
				<p className="border border-dashed border-border p-6 text-sm text-muted-foreground">
					{keptAnnotations?.length === 0
						? "Todavía no has conservado anotaciones."
						: "No hay anotaciones que coincidan con estos filtros."}
				</p>
			) : (
				<div className="space-y-8">
					{annotationGroups?.map(({ label, annotations }) => (
						<div key={label ?? "all"} className="space-y-3">
							{label && (
								<h3 className="font-serif text-xl font-semibold">{label}</h3>
							)}
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
								{annotations.map((entry) => (
									<AnnotationCard
										key={entry.annotation._id}
										entry={entry}
										obraTitles={obraTitles}
										isUpdating={updatingAnnotationId === entry.annotation._id}
										onOpen={() => setSelectedAnnotationId(entry.annotation._id)}
										onReturnToInbox={() =>
											void handleStatusChange(entry.annotation._id)
										}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			)}

			{message && (
				<p className="border border-border bg-card px-4 py-3 text-sm">
					{message}
				</p>
			)}

			<Sheet
				open={selectedEntry !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedAnnotationId(null);
				}}
			>
				<SheetContent className="h-dvh max-h-dvh w-full max-w-none overflow-hidden border-l-border bg-card p-0 sm:max-w-xl">
					{selectedEntry && (
						<AnnotationDetail
							key={selectedEntry.annotation._id}
							entry={selectedEntry}
							authToken={authToken}
						/>
					)}
				</SheetContent>
			</Sheet>
		</section>
	);
}
