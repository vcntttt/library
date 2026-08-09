import { api as convexApi } from "@convex/_generated/api";
import { useAuthToken } from "@convex-dev/auth/react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useState } from "react";
import { ReadingGallery } from "@/components/reading/reading-gallery";
import { Button } from "@/components/ui/button";

export function ReadingDashboard() {
	const pendingAnnotations = useQuery(convexApi.reading.listAnnotations, {
		status: "unprocessed",
		limit: 500,
	});
	const documents = useQuery(convexApi.reading.listDocuments, { limit: 500 });
	const syncRuns = useQuery(convexApi.reading.listSyncRuns, { limit: 1 });
	const authToken = useAuthToken();
	const [isSyncing, setIsSyncing] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const unlinkedDocuments = documents?.filter((document) => !document.obraId);

	const handleSync = async () => {
		if (!authToken) {
			setMessage(
				"No se encontró la sesión autenticada. Recarga la página e inténtalo de nuevo.",
			);
			return;
		}
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
			setMessage(
				`Se procesaron ${payload.importedDocuments ?? 0} documentos, ${payload.importedAnnotations ?? 0} anotaciones y ${payload.errors?.length ?? 0} errores.`,
			);
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
			<div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
				<header className="flex flex-col gap-5 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
					<div className="space-y-2">
						<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
							KOReader
						</p>
						<h1 className="font-serif text-4xl font-semibold">Lectura</h1>
						<p className="max-w-2xl text-sm text-muted-foreground">
							Un panel para decidir qué hacer con tus capturas y documentos de
							lectura.
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

				{syncRuns?.[0] && (
					<section className="border border-border bg-card px-4 py-3 text-sm">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<span>
								Última sincronización:{" "}
								{syncRuns[0].status === "completed"
									? "completa"
									: syncRuns[0].status === "partial"
										? "parcial"
										: syncRuns[0].status === "failed"
											? "fallida"
											: "en curso"}
							</span>
							<span className="text-muted-foreground">
								{syncRuns[0].processedDocuments} procesados ·{" "}
								{syncRuns[0].skippedFiles} sin cambios
							</span>
						</div>
						{syncRuns[0].errors.length > 0 && (
							<ul className="mt-2 space-y-1 text-xs text-destructive">
								{syncRuns[0].errors.slice(0, 3).map((error) => (
									<li key={`${error.path}-${error.message}`}>
										{error.path || "sync"}: {error.message}
									</li>
								))}
							</ul>
						)}
					</section>
				)}

				<section className="grid gap-4 md:grid-cols-2">
					<ReadingDashboardCard
						to="/lectura/inbox"
						eyebrow="Inbox"
						count={pendingAnnotations?.length}
						title="Anotaciones nuevas"
						description="Revisa tus capturas recientes y decide cuáles conservar."
					/>
					<ReadingDashboardCard
						to="/lectura/documentos"
						eyebrow="Documentos"
						count={unlinkedDocuments?.length}
						title="Pendientes de enlazar"
						description="Relaciona los libros importados con una obra de tu biblioteca."
					/>
				</section>

				<ReadingGallery />

				<section className="space-y-4 border border-dashed border-border p-6">
					<div>
						<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
							Flujo sugerido
						</p>
						<h2 className="font-serif text-2xl font-semibold">
							De la captura a la colección
						</h2>
					</div>
					<div className="grid gap-3 sm:grid-cols-3">
						<p className="text-sm text-muted-foreground">
							<strong className="font-medium text-foreground">1.</strong> Revisa
							el inbox.
						</p>
						<p className="text-sm text-muted-foreground">
							<strong className="font-medium text-foreground">2.</strong> Enlaza
							tus documentos.
						</p>
						<p className="text-sm text-muted-foreground">
							<strong className="font-medium text-foreground">3.</strong> Vuelve
							a tus pasajes.
						</p>
					</div>
				</section>
			</div>
		</div>
	);
}

function ReadingDashboardCard({
	to,
	eyebrow,
	count,
	title,
	description,
}: {
	to: "/lectura/inbox" | "/lectura/documentos";
	eyebrow: string;
	count: number | undefined;
	title: string;
	description: string;
}) {
	return (
		<Link
			to={to}
			className="group flex min-h-56 flex-col justify-between border border-border bg-card p-5 transition-colors hover:border-primary"
		>
			<div className="flex items-start justify-between gap-4">
				<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
					{eyebrow}
				</p>
				<span className="font-serif text-4xl leading-none">{count ?? "…"}</span>
			</div>
			<div className="space-y-2">
				<h2 className="font-serif text-2xl font-semibold group-hover:text-primary">
					{title}
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					{description}
				</p>
				<p className="pt-2 text-sm underline underline-offset-4">Abrir vista</p>
			</div>
		</Link>
	);
}
