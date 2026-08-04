import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function ReadingInbox() {
	const annotations = useQuery(convexApi.reading.listAnnotations, {
		status: "unprocessed",
		limit: 500,
	});
	const setStatus = useMutation(convexApi.reading.setAnnotationStatus);
	const keepAllUnprocessedAnnotations = useMutation(
		convexApi.reading.keepAllUnprocessedAnnotations,
	);
	const [updatingAnnotationId, setUpdatingAnnotationId] =
		useState<Id<"readingAnnotations"> | null>(null);
	const [isKeepingAll, setIsKeepingAll] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const handleStatusChange = async (
		id: Id<"readingAnnotations">,
		status: "kept" | "ignored",
	) => {
		setUpdatingAnnotationId(id);
		setMessage(null);
		try {
			await setStatus({ id, status });
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "No se pudo actualizar la anotación.",
			);
		} finally {
			setUpdatingAnnotationId(null);
		}
	};

	const handleKeepAll = async () => {
		setIsKeepingAll(true);
		setMessage(null);
		try {
			const result = await keepAllUnprocessedAnnotations({});
			setMessage(
				result.updated === 0
					? "No había anotaciones pendientes."
					: result.updated === 1
						? "Se conservó 1 anotación."
						: `Se conservaron ${result.updated} anotaciones.`,
			);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "No se pudieron conservar las anotaciones.",
			);
		} finally {
			setIsKeepingAll(false);
		}
	};

	return (
		<section className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
						Bandeja de entrada
					</p>
					<h2 className="font-serif text-2xl font-semibold">
						Anotaciones pendientes
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Decide qué pasajes conservar y cuáles descartar.
					</p>
				</div>
				{annotations && annotations.length > 0 && (
					<div className="flex flex-wrap items-center gap-3">
						<span className="text-sm text-muted-foreground">
							{annotations.length}
						</span>
						<AlertDialog>
							<AlertDialogTrigger
								render={
									<Button
										variant="outline"
										size="sm"
										className="rounded-none"
										disabled={isKeepingAll || updatingAnnotationId !== null}
									/>
								}
							>
								Conservar todas
							</AlertDialogTrigger>
							<AlertDialogContent className="rounded-none border-border bg-card">
								<AlertDialogHeader>
									<AlertDialogTitle className="font-serif">
										¿Conservar todas las anotaciones?
									</AlertDialogTitle>
									<AlertDialogDescription>
										Se conservarán las {annotations.length} anotaciones
										pendientes y pasarán a la galería.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel className="rounded-none border-border">
										Cancelar
									</AlertDialogCancel>
									<AlertDialogAction
										onClick={() => void handleKeepAll()}
										className="rounded-none"
									>
										Conservar todas
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				)}
			</div>

			{message && (
				<p className="border border-border bg-card px-4 py-3 text-sm">
					{message}
				</p>
			)}

			{annotations === undefined ? (
				<Skeleton className="h-40 w-full rounded-none" />
			) : annotations.length === 0 ? (
				<p className="border border-dashed border-border p-6 text-sm text-muted-foreground">
					El inbox está al día.
				</p>
			) : (
				<div className="space-y-3">
					{annotations.map(({ annotation, document }) => (
						<article
							key={annotation._id}
							className="space-y-4 border border-border bg-card p-5"
						>
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
									{document?.title ?? "Documento sin título"}
								</div>
								<div className="text-xs text-muted-foreground">
									{annotation.pageNumber ? `p. ${annotation.pageNumber}` : ""}
								</div>
							</div>
							<blockquote className="border-l-2 border-primary pl-4 font-serif text-lg leading-relaxed">
								{annotation.text}
							</blockquote>
							{annotation.note && (
								<p className="text-sm text-muted-foreground">
									Nota: {annotation.note}
								</p>
							)}
							<div className="flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									className="rounded-none"
									disabled={
										isKeepingAll || updatingAnnotationId === annotation._id
									}
									onClick={() =>
										void handleStatusChange(annotation._id, "kept")
									}
								>
									Conservar
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="rounded-none"
									disabled={
										isKeepingAll || updatingAnnotationId === annotation._id
									}
									onClick={() =>
										void handleStatusChange(annotation._id, "ignored")
									}
								>
									Ignorar
								</Button>
							</div>
						</article>
					))}
				</div>
			)}
		</section>
	);
}
