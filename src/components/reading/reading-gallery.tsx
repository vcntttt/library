import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAuthToken } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { MoreHorizontal, Shuffle } from "lucide-react";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

/** Seeded Fisher-Yates shuffle (deterministic for a given seed). */
function shuffleArray<T>(array: readonly T[], seed: number): T[] {
	const result = [...array];
	let s = seed;
	for (let i = result.length - 1; i > 0; i--) {
		// Simple mulberry32-style PRNG step
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		const j = Math.floor(r * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

export function ReadingGallery() {
	const keptAnnotations = useQuery(convexApi.reading.listAnnotations, {
		status: "kept",
		limit: 500,
	});
	const obras = useQuery(convexApi.obras.list, { limit: 500 });
	const setStatus = useMutation(convexApi.reading.setAnnotationStatus);
	const updateAnnotationCuration = useMutation(
		convexApi.reading.updateAnnotationCuration,
	);
	const authToken = useAuthToken();
	const [updatingAnnotationId, setUpdatingAnnotationId] =
		useState<Id<"readingAnnotations"> | null>(null);
	const [selectedAnnotationId, setSelectedAnnotationId] =
		useState<Id<"readingAnnotations"> | null>(null);
	const [commentDraft, setCommentDraft] = useState("");
	const [curatedDraft, setCuratedDraft] = useState("");
	const [isSavingComment, setIsSavingComment] = useState(false);
	const [commentMessage, setCommentMessage] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedObraId, setSelectedObraId] = useState("all");
	const [groupBy, setGroupBy] = useState<"none" | "chapter">("none");
	const [sortBy, setSortBy] = useState<"shuffle" | "recent" | "oldest">(
		"shuffle",
	);
	const shuffleSeedRef = useRef(Date.now());
	const handleReshuffle = useCallback(() => {
		shuffleSeedRef.current = Date.now();
		// Force re-render by toggling sort briefly
		setSortBy("recent");
		queueMicrotask(() => setSortBy("shuffle"));
	}, []);
	const [context, setContext] = useState<{
		status: string;
		candidates: Array<{
			id: string;
			chapter: string;
			before: string;
			passage: string;
			after: string;
		}>;
	} | null>(null);
	const [isLoadingContext, setIsLoadingContext] = useState(false);
	const commentId = useId();
	const obraTitles = useMemo(
		() => new Map((obras ?? []).map((obra) => [obra.id, obra.title])),
		[obras],
	);
	const selectedAnnotation =
		keptAnnotations?.find(
			({ annotation }) => annotation._id === selectedAnnotationId,
		) ?? null;
	const filteredAnnotations = useMemo(() => {
		if (!keptAnnotations) return undefined;
		const term = searchQuery.trim().toLocaleLowerCase();

		return keptAnnotations.filter(({ annotation, document }) => {
			if (selectedObraId === "unlinked" && document?.obraId) return false;
			if (
				selectedObraId !== "all" &&
				selectedObraId !== "unlinked" &&
				document?.obraId !== selectedObraId
			) {
				return false;
			}
			if (!term) return true;

			return [
				annotation.text,
				annotation.originalText,
				annotation.curatedText,
				annotation.note,
				annotation.comment,
				annotation.chapter,
				document?.title,
				document?.obraId ? obraTitles.get(document.obraId) : undefined,
			]
				.filter(Boolean)
				.some((value) => value?.toLocaleLowerCase().includes(term));
		});
	}, [keptAnnotations, obraTitles, searchQuery, selectedObraId]);
	const sortedAnnotations = useMemo(() => {
		if (!filteredAnnotations) return undefined;
		if (sortBy === "shuffle") {
			return shuffleArray(filteredAnnotations, shuffleSeedRef.current);
		}
		const sorted = [...filteredAnnotations];
		sorted.sort((a, b) => {
			const aTime = a.annotation.capturedAt ?? "";
			const bTime = b.annotation.capturedAt ?? "";
			return sortBy === "oldest"
				? aTime.localeCompare(bTime)
				: bTime.localeCompare(aTime);
		});
		return sorted;
	}, [filteredAnnotations, sortBy]);

	const annotationGroups = useMemo(() => {
		if (!sortedAnnotations) return [];
		if (groupBy === "none") {
			return [{ label: null, annotations: sortedAnnotations }];
		}

		const groups = new Map<
			string,
			{
				label: string;
				annotations: NonNullable<typeof sortedAnnotations>[number][];
			}
		>();
		for (const item of sortedAnnotations) {
			const chapter = item.annotation.chapter?.trim() || "Sin capítulo";
			const documentTitle = item.document?.title ?? "Documento sin título";
			const key = `${item.document?.id}:${chapter}`;
			const group = groups.get(key) ?? {
				label: `${documentTitle} · ${chapter}`,
				annotations: [],
			};
			group.annotations.push(item);
			groups.set(key, group);
		}

		return Array.from(groups.values());
	}, [sortedAnnotations, groupBy]);

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

	const handleOpenAnnotation = (
		id: Id<"readingAnnotations">,
		comment?: string,
		curatedText?: string,
	) => {
		setSelectedAnnotationId(id);
		setCommentDraft(comment ?? "");
		setCuratedDraft(curatedText ?? "");
		setContext(null);
		setCommentMessage(null);
		setMessage(null);
	};

	const handleLoadContext = async () => {
		if (!selectedAnnotation || !authToken) return;
		setIsLoadingContext(true);
		setCommentMessage(null);
		try {
			const response = await fetch("/api/reading/context", {
				method: "POST",
				headers: {
					authorization: `Bearer ${authToken}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					annotationId: selectedAnnotation.annotation._id,
					text:
						selectedAnnotation.annotation.originalText ??
						selectedAnnotation.annotation.text,
				}),
			});
			const payload = await response.json();
			if (!response.ok)
				throw new Error(payload.error ?? "No se pudo buscar contexto.");
			setContext(payload);
		} catch (error) {
			setCommentMessage(
				error instanceof Error ? error.message : "No se pudo buscar contexto.",
			);
		} finally {
			setIsLoadingContext(false);
		}
	};

	const handleSaveComment = async () => {
		if (!selectedAnnotation) return;
		setIsSavingComment(true);
		setCommentMessage(null);
		try {
			await updateAnnotationCuration({
				id: selectedAnnotation.annotation._id,
				curatedText: curatedDraft,
				comment: commentDraft,
			});
			setCommentMessage("Comentario guardado.");
		} catch (error) {
			setCommentMessage(
				error instanceof Error
					? error.message
					: "No se pudo guardar el comentario.",
			);
		} finally {
			setIsSavingComment(false);
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
					onChange={(event) =>
						setGroupBy(event.target.value as "none" | "chapter")
					}
					aria-label="Agrupar anotaciones"
					className="border border-border bg-background px-3 py-2 text-sm"
				>
					<option value="none">Sin agrupar</option>
					<option value="chapter">Agrupar por capítulo</option>
				</select>
				<select
					value={sortBy}
					onChange={(event) =>
						setSortBy(event.target.value as "shuffle" | "recent" | "oldest")
					}
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
						Mostrando {filteredAnnotations?.length ?? 0} de{" "}
						{keptAnnotations.length} anotaciones
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

			{filteredAnnotations === undefined ? (
				<Skeleton className="h-40 w-full rounded-none" />
			) : filteredAnnotations.length === 0 ? (
				<p className="border border-dashed border-border p-6 text-sm text-muted-foreground">
					{keptAnnotations?.length === 0
						? "Todavía no has conservado anotaciones."
						: "No hay anotaciones que coincidan con estos filtros."}
				</p>
			) : (
				<div className="space-y-8">
					{annotationGroups.map(({ label, annotations }) => (
						<div key={label ?? "all"} className="space-y-3">
							{label && (
								<h3 className="font-serif text-xl font-semibold">{label}</h3>
							)}
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
								{annotations.map(({ annotation, document }) => (
									<article
										key={annotation._id}
										className="relative flex h-64 flex-col gap-3 overflow-hidden border border-border bg-card p-5 transition-colors hover:border-primary/60"
									>
										<button
											type="button"
											className="flex min-h-0 flex-1 flex-col gap-5 pr-8 text-left"
											onClick={() =>
												handleOpenAnnotation(
													annotation._id,
													annotation.comment,
													annotation.curatedText ?? annotation.text,
												)
											}
										>
											<div className="flex flex-wrap items-center justify-between gap-3">
												<div>
													<p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
														{document?.title ?? "Documento sin título"}
													</p>
													{document?.obraId && (
														<p className="mt-1 text-xs text-muted-foreground">
															{obraTitles.get(document.obraId) ??
																"Obra vinculada"}
														</p>
													)}
												</div>
												<div className="text-xs text-muted-foreground">
													{annotation.pageNumber
														? `p. ${annotation.pageNumber}`
														: ""}
												</div>
											</div>
											<blockquote className="flex-1 overflow-hidden border-l-2 border-primary pl-4 font-serif text-base leading-relaxed">
												<span className="line-clamp-5">{annotation.text}</span>
											</blockquote>
											{annotation.note && (
												<p className="border-t border-border pt-3 text-sm text-muted-foreground">
													Nota: {annotation.note}
												</p>
											)}
											{annotation.comment && (
												<p className="border-t border-border pt-3 text-sm text-muted-foreground">
													Tu comentario: {annotation.comment}
												</p>
											)}
										</button>
										<DropdownMenu>
											<DropdownMenuTrigger
												render={
													<Button
														type="button"
														variant="ghost"
														size="icon-sm"
														className="absolute top-3 right-3 rounded-none"
													/>
												}
											>
												<MoreHorizontal />
												<span className="sr-only">
													Acciones de la anotación
												</span>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem
													disabled={updatingAnnotationId === annotation._id}
													onClick={() =>
														void handleStatusChange(annotation._id)
													}
												>
													Devolver al inbox
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</article>
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
				open={selectedAnnotation !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedAnnotationId(null);
				}}
			>
				<SheetContent className="h-dvh max-h-dvh w-full max-w-none overflow-hidden border-l-border bg-card p-0 sm:max-w-xl">
					{selectedAnnotation && (
						<>
							<SheetHeader className="border-b border-border bg-card px-5 py-4 pr-12">
								<SheetTitle className="font-serif text-xl">
									{selectedAnnotation.document?.title ?? "Documento sin título"}
								</SheetTitle>
								<SheetDescription>
									Detalle de la anotación conservada.
								</SheetDescription>
							</SheetHeader>

							<div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6">
								<blockquote className="border-l-2 border-primary pl-4 font-serif text-xl leading-relaxed">
									{selectedAnnotation.annotation.text}
								</blockquote>
								<dl className="grid gap-4 border-y border-border py-4 text-sm sm:grid-cols-2">
									<div>
										<dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
											Página
										</dt>
										<dd className="mt-1">
											{selectedAnnotation.annotation.pageNumber
												? `p. ${selectedAnnotation.annotation.pageNumber}`
												: "Sin página"}
										</dd>
									</div>
									{selectedAnnotation.annotation.chapter && (
										<div>
											<dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
												Capítulo
											</dt>
											<dd className="mt-1">
												{selectedAnnotation.annotation.chapter}
											</dd>
										</div>
									)}
									{selectedAnnotation.annotation.deviceLabel && (
										<div>
											<dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
												Dispositivo
											</dt>
											<dd className="mt-1">
												{selectedAnnotation.annotation.deviceLabel}
											</dd>
										</div>
									)}
									{selectedAnnotation.annotation.capturedAt && (
										<div>
											<dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
												Capturada
											</dt>
											<dd className="mt-1 break-words">
												{selectedAnnotation.annotation.capturedAt}
											</dd>
										</div>
									)}
								</dl>
								{selectedAnnotation.annotation.note && (
									<section className="space-y-2">
										<h3 className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
											Nota original de KOReader
										</h3>
										<p className="whitespace-pre-wrap text-sm leading-relaxed">
											{selectedAnnotation.annotation.note}
										</p>
									</section>
								)}
								<section className="space-y-2">
									<h3 className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
										Original inmutable de KOReader
									</h3>
									<p className="whitespace-pre-wrap border border-border bg-background p-3 text-sm leading-relaxed">
										{selectedAnnotation.annotation.originalText ??
											selectedAnnotation.annotation.text}
									</p>
								</section>
								<section className="space-y-2">
									<label
										className="text-sm font-medium"
										htmlFor={`${commentId}-curated`}
									>
										Versión curada
									</label>
									<Textarea
										id={`${commentId}-curated`}
										value={curatedDraft}
										onChange={(event) => setCuratedDraft(event.target.value)}
										className="min-h-32 resize-y rounded-none"
									/>
									{selectedAnnotation.document?.format === "epub" && (
										<Button
											type="button"
											variant="outline"
											className="rounded-none"
											disabled={isLoadingContext || !authToken}
											onClick={() => void handleLoadContext()}
										>
											{isLoadingContext
												? "Buscando contexto…"
												: "Buscar contexto EPUB"}
										</Button>
									)}
									{context && (
										<div className="space-y-3 border-t border-border pt-3">
											<p className="text-xs text-muted-foreground">
												{context.status === "ambiguous"
													? "Hay varias coincidencias. Elige una para usarla como base."
													: context.status === "not-found"
														? "No se encontró una coincidencia segura. Puedes editar sin contexto."
														: "Contexto encontrado."}
											</p>
											{context.candidates.map((candidate) => (
												<button
													key={candidate.id}
													type="button"
													className="block w-full border border-border p-3 text-left text-sm hover:border-primary"
													onClick={() => setCuratedDraft(candidate.passage)}
												>
													<span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
														{candidate.chapter}
													</span>
													{candidate.before && (
														<p className="mt-2 text-muted-foreground">
															{candidate.before}
														</p>
													)}
													<p className="mt-1 font-medium">
														{candidate.passage}
													</p>
													{candidate.after && (
														<p className="mt-2 text-muted-foreground">
															{candidate.after}
														</p>
													)}
												</button>
											))}
										</div>
									)}
								</section>
								<section className="space-y-2">
									<label htmlFor={commentId} className="text-sm font-medium">
										Mi comentario
									</label>
									<Textarea
										id={commentId}
										value={commentDraft}
										onChange={(event) => setCommentDraft(event.target.value)}
										placeholder="¿Qué te hizo conservar este pasaje?"
										className="min-h-32 resize-y rounded-none"
									/>
								</section>
							</div>
							<SheetFooter className="border-t border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
								<p className="text-sm text-muted-foreground" aria-live="polite">
									{commentMessage}
								</p>
								<Button
									onClick={() => void handleSaveComment()}
									disabled={isSavingComment}
									className="rounded-none"
								>
									{isSavingComment ? "Guardando…" : "Guardar comentario"}
								</Button>
							</SheetFooter>
						</>
					)}
				</SheetContent>
			</Sheet>
		</section>
	);
}
