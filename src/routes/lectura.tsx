import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAuthToken, useConvexAuth } from "@convex-dev/auth/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/lectura")({
	ssr: false,
	component: ReadingPage,
});

function ReadingPage() {
	const { isAuthenticated, isLoading } = useConvexAuth();
	if (isLoading) return <ReadingPageSkeleton />;
	if (!isAuthenticated) {
		return (
			<div className="mx-auto max-w-6xl px-6 py-10">
				<div className="max-w-lg border border-border bg-card p-6 space-y-3">
					<h1 className="font-serif text-2xl font-semibold">Lectura</h1>
					<p className="text-sm text-muted-foreground">
						Inicia sesión para sincronizar tus anotaciones.
					</p>
					<Link to="/login" className="text-sm underline underline-offset-4">
						Ir a login
					</Link>
				</div>
			</div>
		);
	}

	return <ReadingPageAuthed />;
}

function ReadingPageSkeleton() {
	return (
		<div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
			<Skeleton className="h-10 w-48 rounded-none" />
			<Skeleton className="h-32 w-full rounded-none" />
		</div>
	);
}

function ReadingPageAuthed() {
	const annotations = useQuery(convexApi.reading.listAnnotations, {
		status: "unprocessed",
		limit: 100,
	});
	const documents = useQuery(convexApi.reading.listDocuments, { limit: 100 });
	const obras = useQuery(convexApi.obras.list, { limit: 500 });
	const setStatus = useMutation(convexApi.reading.setAnnotationStatus);
	const linkDocument = useMutation(convexApi.reading.linkDocument);
	const authToken = useAuthToken();
	const [isSyncing, setIsSyncing] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const handleSync = async () => {
		if (!authToken) return;
		setIsSyncing(true);
		setMessage(null);
		try {
			const response = await fetch("/api/reading/sync", {
				method: "POST",
				headers: { authorization: `Bearer ${authToken}` },
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(
					typeof payload?.error === "string"
						? payload.error
						: "No se pudo sincronizar la lectura.",
				);
			}
			setMessage(`Se importaron ${payload.importedDocuments ?? 0} documentos.`);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "No se pudo sincronizar la lectura.",
			);
		} finally {
			setIsSyncing(false);
		}
	};

	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="mx-auto max-w-6xl space-y-10 px-6 py-10">
				<header className="flex flex-col gap-5 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
					<div className="space-y-2">
						<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
							KOReader
						</p>
						<h1 className="font-serif text-4xl font-semibold">Lectura</h1>
						<p className="max-w-xl text-sm text-muted-foreground">
							Importa progreso y anotaciones para decidir qué conservar como
							cita o idea.
						</p>
					</div>
					<Button
						onClick={handleSync}
						disabled={isSyncing}
						className="rounded-none"
					>
						{isSyncing ? "Sincronizando…" : "Sincronizar ahora"}
					</Button>
				</header>

				{message && (
					<p className="border border-border bg-card px-4 py-3 text-sm">
						{message}
					</p>
				)}

				<section className="space-y-4">
					<div className="flex items-baseline justify-between gap-4">
						<div>
							<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
								Bandeja
							</p>
							<h2 className="font-serif text-2xl font-semibold">
								Anotaciones pendientes
							</h2>
						</div>
						<span className="text-sm text-muted-foreground">
							{annotations?.length ?? "…"}
						</span>
					</div>

					{annotations === undefined ? (
						<Skeleton className="h-40 w-full rounded-none" />
					) : annotations.length === 0 ? (
						<p className="border border-dashed border-border p-6 text-sm text-muted-foreground">
							No hay anotaciones pendientes.
						</p>
					) : (
						<div className="space-y-3">
							{annotations.map(({ annotation, document }) => (
								<article
									key={annotation._id}
									className="border border-border bg-card p-5 space-y-4"
								>
									<div className="flex flex-wrap items-center justify-between gap-3">
										<div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
											{document?.title ?? "Documento sin título"}
										</div>
										<div className="text-xs text-muted-foreground">
											{annotation.pageNumber
												? `p. ${annotation.pageNumber}`
												: ""}
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
											onClick={() =>
												void setStatus({ id: annotation._id, status: "kept" })
											}
										>
											Conservar
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="rounded-none"
											onClick={() =>
												void setStatus({
													id: annotation._id,
													status: "ignored",
												})
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

				<section className="space-y-4">
					<div>
						<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
							Fuente
						</p>
						<h2 className="font-serif text-2xl font-semibold">
							Documentos de lectura
						</h2>
					</div>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{documents?.map((document) => (
							<div key={document._id} className="border border-border p-4">
								<p className="font-medium">{document.title}</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{document.sourcePath}
								</p>
								<label className="mt-3 block text-xs uppercase tracking-[0.12em] text-muted-foreground">
									Obra relacionada
									<select
										value={document.obraId ?? ""}
										className="mt-2 w-full border border-border bg-background px-2 py-2 text-sm normal-case tracking-normal"
										onChange={(event) => {
											const obraId = event.target.value;
											void linkDocument({
												id: document._id,
												obraId: obraId ? (obraId as Id<"obras">) : null,
											});
										}}
									>
										<option value="">Sin vincular</option>
										{obras?.map((obra) => (
											<option key={obra.id} value={obra.id}>
												{obra.title}
											</option>
										))}
									</select>
								</label>
							</div>
						))}
					</div>
				</section>
			</div>
		</div>
	);
}
