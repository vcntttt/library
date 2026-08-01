import { api as convexApi } from "@convex/_generated/api";
import { useAuthToken, useConvexAuth } from "@convex-dev/auth/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMetadataHealth } from "@/lib/metadata/health";
import { buildMetadataPayload } from "@/lib/metadata/payload";
import type { MetadataDetails } from "@/lib/metadata/types";
import { obraFromDoc } from "@/lib/obras";
import type { Obra, ObraType } from "@/lib/types";

export const Route = createFileRoute("/health")({
	ssr: false,
	component: SanidadPage,
});

const typeLabels: Record<ObraType, string> = {
	book: "Libros",
	movie: "Películas",
	series: "Series",
	anime: "Anime",
	manga: "Manga",
	manhwa: "Manhwa",
};

function SanidadPage() {
	const { isAuthenticated, isLoading } = useConvexAuth();
	if (isLoading)
		return <main className="mx-auto max-w-6xl px-6 py-10">Cargando…</main>;
	if (!isAuthenticated)
		return (
			<main className="mx-auto max-w-6xl px-6 py-10">
				Inicia sesión para revisar la sanidad de tu biblioteca.
			</main>
		);
	return <SanidadAuthed />;
}

function SanidadAuthed() {
	const docs = useQuery(convexApi.obras.list, {});
	const updateObra = useMutation(convexApi.obras.update);
	const authToken = useAuthToken();
	const [selected, setSelected] = useState<string[]>([]);
	const [running, setRunning] = useState<string[]>([]);
	const [results, setResults] = useState<Record<string, string>>({});
	const obras = useMemo(() => (docs ?? []).map(obraFromDoc), [docs]);
	const unhealthy = obras.filter(
		(obra) => getMetadataHealth(obra).missing.length > 0,
	);
	const selectable = unhealthy.filter((obra) => obra.external);

	const refresh = async (obra: Obra) => {
		if (!obra.external || running.includes(obra.id)) return;
		setRunning((current) => [...current, obra.id]);
		try {
			const params = new URLSearchParams({
				source: obra.external.source,
				id: obra.external.id,
				type: obra.type,
				refresh: "1",
			});
			const response = await fetch(`/api/metadata/details?${params}`, {
				headers: authToken
					? { authorization: `Bearer ${authToken}` }
					: undefined,
			});
			if (!response.ok) throw new Error("No se pudo consultar el proveedor.");
			const { details } = (await response.json()) as {
				details: MetadataDetails;
			};
			await updateObra({
				id: obra.id as never,
				patch: {
					title: details.title ?? obra.originalTitle ?? obra.title,
					creator: details.creator ?? obra.originalCreator,
					year: details.year ?? obra.originalYear,
					coverUrl: details.coverUrl ?? obra.originalCoverUrl,
					metadata: {
						...(obra.metadata ?? {}),
						...(buildMetadataPayload(details, {
							initializeNotificationBaseline: false,
							previousMetadata: obra.metadata,
						}) ?? {}),
					},
				},
			});
			setResults((current) => ({ ...current, [obra.id]: "Actualizada" }));
		} catch (error) {
			setResults((current) => ({
				...current,
				[obra.id]: error instanceof Error ? error.message : "Error",
			}));
		} finally {
			setRunning((current) => current.filter((id) => id !== obra.id));
		}
	};

	const refreshSelected = () => {
		void Promise.all(
			selectable.filter((obra) => selected.includes(obra.id)).map(refresh),
		);
	};
	const allSelected =
		selectable.length > 0 &&
		selectable.every((obra) => selected.includes(obra.id));

	return (
		<main className="min-h-[calc(100vh-4rem)]">
			<div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
				<div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
							Mantenimiento
						</p>
						<h1 className="font-serif text-4xl font-semibold">
							Sanidad de metadatos
						</h1>
						<p className="mt-2 text-muted-foreground">
							Revisa qué información falta y actualiza las obras vinculadas a un
							proveedor.
						</p>
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={() =>
								setSelected(
									allSelected ? [] : selectable.map((obra) => obra.id),
								)
							}
						>
							{allSelected ? "Quitar selección" : "Seleccionar actualizables"}
						</Button>
						<Button
							disabled={!selected.length || running.length > 0}
							onClick={refreshSelected}
						>
							Actualizar seleccionadas ({selected.length})
						</Button>
					</div>
				</div>
				<div className="grid gap-3 sm:grid-cols-3">
					<Summary label="Obras revisadas" value={obras.length} />
					<Summary label="Con información faltante" value={unhealthy.length} />
					<Summary label="Actualizables" value={selectable.length} />
				</div>
				{docs === undefined ? (
					<p>Cargando obras…</p>
				) : unhealthy.length === 0 ? (
					<div className="border border-border bg-card p-8 text-center">
						<p className="font-medium">Tu biblioteca está completa.</p>
						<p className="mt-1 text-sm text-muted-foreground">
							No detectamos campos esenciales faltantes.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{unhealthy.map((obra) => {
							const health = getMetadataHealth(obra);
							const canUpdate = Boolean(obra.external);
							return (
								<article
									key={obra.id}
									className="flex flex-col gap-4 border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="flex min-w-0 items-start gap-3">
										{canUpdate && (
											<input
												type="checkbox"
												checked={selected.includes(obra.id)}
												onChange={(event) =>
													setSelected((current) =>
														event.target.checked
															? [...new Set([...current, obra.id])]
															: current.filter((id) => id !== obra.id),
													)
												}
												aria-label={`Seleccionar ${obra.title}`}
												className="mt-1 size-4 accent-primary"
											/>
										)}
										<div className="min-w-0">
											<Link
												to="/obra/$obraId"
												params={{ obraId: obra.id }}
												className="font-medium hover:underline"
											>
												{obra.title}
											</Link>
											<p className="text-xs text-muted-foreground">
												{typeLabels[obra.type]} · Falta:{" "}
												{health.missing.join(", ")}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-2">
										{results[obra.id] && (
											<span className="text-xs text-muted-foreground">
												{results[obra.id]}
											</span>
										)}
										{!canUpdate ? (
											<Badge variant="outline">Sin fuente externa</Badge>
										) : (
											<Button
												size="sm"
												variant="outline"
												disabled={running.includes(obra.id)}
												onClick={() => void refresh(obra)}
											>
												{running.includes(obra.id)
													? "Actualizando…"
													: "Actualizar"}
											</Button>
										)}
									</div>
								</article>
							);
						})}
					</div>
				)}
			</div>
		</main>
	);
}

function Summary({ label, value }: { label: string; value: number }) {
	return (
		<div className="border border-border bg-card p-4">
			<p className="text-xs uppercase tracking-wider text-muted-foreground">
				{label}
			</p>
			<p className="mt-1 text-3xl font-semibold">{value}</p>
		</div>
	);
}
