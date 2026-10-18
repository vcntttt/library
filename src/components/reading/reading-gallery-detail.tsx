import { api as convexApi } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { useEffect, useId, useState } from "react";
import type { GalleryEntry } from "@/components/reading/reading-gallery-model";
import { Button } from "@/components/ui/button";
import {
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

interface ContextCandidate {
	id: string;
	chapter: string;
	before: string;
	passage: string;
	after: string;
}

interface ReadingContext {
	status: string;
	candidates: ContextCandidate[];
}

interface AnnotationDetailProps {
	entry: GalleryEntry;
	authToken: string | null;
}

// Detalle de una anotación conservada. Se monta con `key` por anotación: los borradores parten de lo guardado al abrirla.
export function AnnotationDetail({ entry, authToken }: AnnotationDetailProps) {
	const { annotation, document } = entry;
	const updateAnnotationCuration = useMutation(
		convexApi.reading.updateAnnotationCuration,
	);
	const commentId = useId();
	const [commentDraft, setCommentDraft] = useState(annotation.comment ?? "");
	const [curatedDraft, setCuratedDraft] = useState(
		annotation.curatedText ?? annotation.text,
	);
	const [context, setContext] = useState<ReadingContext | null>(null);
	const [contextRequest, setContextRequest] = useState<AbortController | null>(
		null,
	);
	const [isSavingComment, setIsSavingComment] = useState(false);
	const [commentMessage, setCommentMessage] = useState<string | null>(null);

	// Cada petición vive en estado: su ausencia marca el fin de la carga, y cambiarla o desmontar aborta la anterior.
	useEffect(() => () => contextRequest?.abort(), [contextRequest]);

	const handleLoadContext = async () => {
		if (!authToken) return;
		contextRequest?.abort();
		const controller = new AbortController();
		setContextRequest(controller);
		setCommentMessage(null);
		try {
			const response = await fetch("/api/reading/context", {
				method: "POST",
				headers: {
					authorization: `Bearer ${authToken}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					annotationId: annotation._id,
					text: annotation.originalText ?? annotation.text,
				}),
				signal: controller.signal,
			});
			if (!response.ok) {
				const errorPayload = (await response.json().catch(() => null)) as {
					error?: string;
				} | null;
				throw new Error(errorPayload?.error ?? "No se pudo buscar contexto.");
			}
			const nextContext = (await response.json()) as ReadingContext;
			if (controller.signal.aborted) return;
			setContext(nextContext);
		} catch (error) {
			if (controller.signal.aborted) return;
			setCommentMessage(
				error instanceof Error ? error.message : "No se pudo buscar contexto.",
			);
		} finally {
			setContextRequest((current) => (current === controller ? null : current));
		}
	};

	const handleSaveComment = async () => {
		setIsSavingComment(true);
		setCommentMessage(null);
		try {
			await updateAnnotationCuration({
				id: annotation._id,
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
		<>
			<SheetHeader className="border-b border-border bg-card px-5 py-4 pr-12">
				<SheetTitle className="font-serif text-xl">
					{document?.title ?? "Documento sin título"}
				</SheetTitle>
				<SheetDescription>Detalle de la anotación conservada.</SheetDescription>
			</SheetHeader>

			<div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6">
				<blockquote className="border-l-2 border-primary pl-4 font-serif text-xl leading-relaxed">
					{annotation.text}
				</blockquote>
				<AnnotationFacts annotation={annotation} />
				{annotation.note && (
					<section className="space-y-2">
						<h3 className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
							Nota original de KOReader
						</h3>
						<p className="whitespace-pre-wrap text-sm leading-relaxed">
							{annotation.note}
						</p>
					</section>
				)}
				<section className="space-y-2">
					<h3 className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
						Original inmutable de KOReader
					</h3>
					<p className="whitespace-pre-wrap border border-border bg-background p-3 text-sm leading-relaxed">
						{annotation.originalText ?? annotation.text}
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
					{document?.format === "epub" && (
						<Button
							type="button"
							variant="outline"
							className="rounded-none"
							disabled={contextRequest !== null || !authToken}
							onClick={() => void handleLoadContext()}
						>
							{contextRequest !== null
								? "Buscando contexto…"
								: "Buscar contexto EPUB"}
						</Button>
					)}
					{context && (
						<ContextCandidates
							context={context}
							onPick={(passage) => setCuratedDraft(passage)}
						/>
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
	);
}

function AnnotationFacts({
	annotation,
}: {
	annotation: GalleryEntry["annotation"];
}) {
	return (
		<dl className="grid gap-4 border-y border-border py-4 text-sm sm:grid-cols-2">
			<div>
				<dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
					Página
				</dt>
				<dd className="mt-1">
					{annotation.pageNumber ? `p. ${annotation.pageNumber}` : "Sin página"}
				</dd>
			</div>
			{annotation.chapter && (
				<div>
					<dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
						Capítulo
					</dt>
					<dd className="mt-1">{annotation.chapter}</dd>
				</div>
			)}
			{annotation.deviceLabel && (
				<div>
					<dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
						Dispositivo
					</dt>
					<dd className="mt-1">{annotation.deviceLabel}</dd>
				</div>
			)}
			{annotation.capturedAt && (
				<div>
					<dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
						Capturada
					</dt>
					<dd className="mt-1 break-words">{annotation.capturedAt}</dd>
				</div>
			)}
		</dl>
	);
}

function ContextCandidates({
	context,
	onPick,
}: {
	context: ReadingContext;
	onPick: (passage: string) => void;
}) {
	return (
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
					onClick={() => onPick(candidate.passage)}
				>
					<span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
						{candidate.chapter}
					</span>
					{candidate.before && (
						<p className="mt-2 text-muted-foreground">{candidate.before}</p>
					)}
					<p className="mt-1 font-medium">{candidate.passage}</p>
					{candidate.after && (
						<p className="mt-2 text-muted-foreground">{candidate.after}</p>
					)}
				</button>
			))}
		</div>
	);
}
