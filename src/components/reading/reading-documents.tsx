import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function ReadingDocuments() {
	const documents = useQuery(convexApi.reading.listDocuments, { limit: 100 });
	const obras = useQuery(convexApi.obras.list, { limit: 500 });
	const linkDocument = useMutation(convexApi.reading.linkDocument);
	const [onlyUnlinked, setOnlyUnlinked] = useState(true);
	const [updatingDocumentId, setUpdatingDocumentId] =
		useState<Id<"readingDocuments"> | null>(null);
	const [pendingLink, setPendingLink] = useState<{
		id: Id<"readingDocuments">;
		value: string;
	} | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const visibleDocuments = useMemo(
		() =>
			documents?.filter((document) => !onlyUnlinked || !document.obraId) ?? [],
		[documents, onlyUnlinked],
	);
	const unlinkedCount = documents?.filter(
		(document) => !document.obraId,
	).length;

	const handleLinkDocument = async (
		id: Id<"readingDocuments">,
		value: string,
	) => {
		setUpdatingDocumentId(id);
		setMessage(null);
		try {
			await linkDocument({
				id,
				obraId: value ? (value as Id<"obras">) : null,
			});
			setPendingLink(null);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "No se pudo vincular el documento.",
			);
		} finally {
			setUpdatingDocumentId(null);
		}
	};

	return (
		<section className="space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
						Fuente importada
					</p>
					<h2 className="font-serif text-2xl font-semibold">
						Documentos de lectura
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Relaciona cada archivo importado con una obra de tu biblioteca.
					</p>
				</div>
				<div className="flex items-center gap-3">
					<span className="text-sm text-muted-foreground">
						{unlinkedCount ?? "…"} sin vincular
					</span>
					<Button
						variant="outline"
						size="sm"
						className="rounded-none"
						onClick={() => setOnlyUnlinked((current) => !current)}
					>
						{onlyUnlinked ? "Ver todos" : "Ver solo pendientes"}
					</Button>
				</div>
			</div>

			{message && (
				<p className="border border-border bg-card px-4 py-3 text-sm">
					{message}
				</p>
			)}

			{documents === undefined ? (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{["document-1", "document-2", "document-3"].map((key) => (
						<Skeleton key={key} className="h-40 rounded-none" />
					))}
				</div>
			) : visibleDocuments.length === 0 ? (
				<p className="border border-dashed border-border p-6 text-sm text-muted-foreground">
					No hay documentos pendientes de vincular.
				</p>
			) : (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{visibleDocuments.map((document) => (
						<article
							key={document._id}
							className="space-y-4 border border-border bg-card p-4"
						>
							<div>
								<p className="font-medium">{document.title}</p>
								{document.author && (
									<p className="mt-1 text-sm text-muted-foreground">
										{document.author}
									</p>
								)}
								<p className="mt-1 break-words text-xs text-muted-foreground">
									{document.sourcePath}
								</p>
								<p className="mt-2 text-xs text-muted-foreground">
									{document.sources?.length ?? 0} fuente(s) ·{" "}
									{document.format.toUpperCase()}
								</p>
								{(document.sources?.filter(
									(source) => source.status === "missing",
								).length ?? 0) > 0 && (
									<p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
										Hay fuentes ausentes; sus datos se conservaron.
									</p>
								)}
							</div>
							{document.suggestion && (
								<p className="border-l-2 border-primary pl-3 text-xs text-muted-foreground">
									Sugerencia:{" "}
									<span className="text-foreground">
										{document.suggestion.title}
									</span>{" "}
									({Math.round(document.suggestion.score * 100)}%)
								</p>
							)}
							<label className="block text-xs uppercase tracking-[0.12em] text-muted-foreground">
								Obra relacionada
								<select
									value={
										pendingLink?.id === document._id
											? pendingLink.value
											: (document.obraId ?? "")
									}
									disabled={updatingDocumentId === document._id}
									className="mt-2 w-full border border-border bg-background px-2 py-2 text-sm normal-case tracking-normal disabled:opacity-50"
									onChange={(event) =>
										setPendingLink({
											id: document._id,
											value: event.target.value,
										})
									}
								>
									<option value="">Sin vincular</option>
									{obras?.map((obra) => (
										<option key={obra.id} value={obra.id}>
											{obra.title}
										</option>
									))}
								</select>
								{pendingLink?.id === document._id && (
									<div className="mt-2 flex items-center justify-between gap-2">
										<p className="text-xs normal-case tracking-normal text-muted-foreground">
											Confirma este vínculo para proyectar el progreso.
										</p>
										<Button
											type="button"
											size="sm"
											className="shrink-0 rounded-none"
											disabled={updatingDocumentId === document._id}
											onClick={() =>
												void handleLinkDocument(document._id, pendingLink.value)
											}
										>
											Confirmar
										</Button>
									</div>
								)}
							</label>
						</article>
					))}
				</div>
			)}
		</section>
	);
}
