import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Trash2 } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { TypeBadge } from "@/components/type-badge";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { isMetadataOngoing, isObraUpToDate } from "@/lib/metadata/format";
import type {
	MetadataDetails,
	MetadataSearchResult,
	MetadataSource,
} from "@/lib/metadata/types";
import { obraFromDoc } from "@/lib/obras";
import type { ObraId, ObraStatus, ObraType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";

const statusLabels: Record<ObraStatus, string> = {
	backlog: "Pendiente",
	"in-progress": "En progreso",
	finished: "Terminada",
	dropped: "Abandonada",
};

const progressUnitLabels: Record<ObraType, string> = {
	book: "páginas",
	movie: "",
	series: "episodios",
	anime: "episodios",
	manga: "capítulos",
};

const metadataStatusLabels: Record<string, string> = {
	"Returning Series": "En emisión",
	Ended: "Finalizada",
	Canceled: "Cancelada",
	"In Production": "En producción",
	Planned: "Planeada",
	Pilot: "Piloto",
	Released: "Estrenada",
	"Post Production": "Postproducción",
	Rumored: "Rumoreada",
	FINISHED: "Finalizada",
	RELEASING: "En emisión",
	HIATUS: "En pausa",
	NOT_YET_RELEASED: "No estrenada",
	CANCELLED: "Cancelada",
};

const seasonLabels: Record<string, string> = {
	WINTER: "Invierno",
	SPRING: "Primavera",
	SUMMER: "Verano",
	FALL: "Otoño",
};

const metadataSourceLabels: Record<MetadataSource, string> = {
	"google-books": "Google Books",
	"open-library": "Open Library",
	tmdb: "TMDB",
	anilist: "AniList",
};

const metadataSourceByType: Record<ObraType, MetadataSource> = {
	book: "google-books",
	movie: "tmdb",
	series: "tmdb",
	anime: "anilist",
	manga: "anilist",
};

const buildMetadataPayload = (
	metadata: Pick<
		MetadataSearchResult,
		| "pages"
		| "seasons"
		| "episodes"
		| "episodesAired"
		| "nextEpisodeDate"
		| "status"
		| "chapters"
		| "volumes"
		| "season"
		| "seasonYear"
		| "runtime"
		| "watchProviders"
	> | null,
) => {
	if (!metadata) return undefined;

	const payload = {
		pages: metadata.pages ?? undefined,
		seasons: metadata.seasons ?? undefined,
		episodes: metadata.episodes ?? undefined,
		episodesAired: metadata.episodesAired ?? undefined,
		nextEpisodeDate: metadata.nextEpisodeDate ?? undefined,
		status: metadata.status ?? undefined,
		chapters: metadata.chapters ?? undefined,
		volumes: metadata.volumes ?? undefined,
		season: metadata.season ?? undefined,
		seasonYear: metadata.seasonYear ?? undefined,
		runtime: metadata.runtime ?? undefined,
		watchProviders: metadata.watchProviders ?? undefined,
	};

	const hasData = Object.values(payload).some((value) => value !== undefined);
	return hasData ? payload : undefined;
};

const formatDateInput = (value?: number) => {
	if (!value) return "";
	return new Date(value).toISOString().slice(0, 10);
};

const parseDateInput = (value: string) => {
	if (!value.trim()) return undefined;
	const timestamp = new Date(value).getTime();
	return Number.isNaN(timestamp) ? undefined : timestamp;
};

export const Route = createFileRoute("/obra/$obraId")({
	ssr: false,
	component: ObraPage,
});

function ObraPage() {
	const { obraId } = Route.useParams();
	const id = obraId as ObraId;
	const navigate = Route.useNavigate();
	const { data: session, isPending } = authClient.useSession();

	if (isPending || session === undefined) {
		return (
			<div className="container mx-auto p-4 md:p-6">
				<p className="text-sm text-muted-foreground">Cargando...</p>
			</div>
		);
	}

	if (session === null) {
		return (
			<div className="container mx-auto p-4 md:p-6 space-y-3">
				<p className="text-sm text-muted-foreground">
					Inicia sesión para ver esta obra.
				</p>
				<Link to="/login" className="text-sm underline underline-offset-4">
					Ir a login
				</Link>
			</div>
		);
	}

	return <ObraAuthed id={id} navigate={navigate} />;
}

function ObraAuthed({
	id,
	navigate,
}: {
	id: ObraId;
	navigate: (opts: { to: string }) => void;
}) {
	const doc = useQuery(api.obras.get, { id });
	const updateObra = useMutation(api.obras.update);
	const removeObra = useMutation(api.obras.remove);
	const [isOpeningObsidian, setIsOpeningObsidian] = useState(false);
	const [obsidianError, setObsidianError] = useState<string | null>(null);
	const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
	const [isMetadataOpen, setIsMetadataOpen] = useState(false);
	const [metadataQuery, setMetadataQuery] = useState("");
	const [metadataResults, setMetadataResults] = useState<
		MetadataSearchResult[]
	>([]);
	const [metadataError, setMetadataError] = useState<string | null>(null);
	const [isSearchingMetadata, setIsSearchingMetadata] = useState(false);
	const [isApplyingMetadata, setIsApplyingMetadata] = useState(false);
	const progressCommitTimeout = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	const form = useForm({
		defaultValues: {
			obsidianPath: "",
			startedAt: "",
			finishedAt: "",
			review: "",
			notes: "",
			progressCurrent: 0,
			progressTotal: 0,
		},
		onSubmit: async ({ value }) => {
			const hasProgress = doc?.type !== "movie";
			const previousProgress = doc?.progress;
			const progressChanged =
				value.progressCurrent !== (previousProgress?.current ?? 0) ||
				value.progressTotal !== (previousProgress?.total ?? 0);
			const canSaveProgress =
				!hasProgress ||
				(Number.isFinite(value.progressCurrent) &&
					Number.isFinite(value.progressTotal) &&
					value.progressTotal >= 0 &&
					value.progressCurrent >= 0 &&
					(value.progressTotal === 0 ||
						value.progressCurrent <= value.progressTotal));

			if (!canSaveProgress) return;

			const patch: Record<string, unknown> = {
				obsidianPath: value.obsidianPath.trim() || undefined,
				startedAt: parseDateInput(value.startedAt),
				finishedAt: parseDateInput(value.finishedAt),
				review: value.review.trim() || undefined,
				notes: value.notes.trim() || undefined,
			};

			if (hasProgress && value.progressTotal > 0) {
				patch.progress = {
					current: Math.min(value.progressCurrent, value.progressTotal),
					total: value.progressTotal,
				};
			}

			if (
				hasProgress &&
				progressChanged &&
				value.progressCurrent > 0 &&
				doc?.status !== "in-progress"
			) {
				patch.status = "in-progress";
			}

			await updateObra({ id, patch });
		},
	});

	useEffect(() => {
		if (!doc) {
			return;
		}
		form.reset({
			obsidianPath: doc.obsidianPath ?? "",
			startedAt: formatDateInput(doc.startedAt),
			finishedAt: formatDateInput(doc.finishedAt),
			review: doc.review ?? "",
			notes: doc.notes ?? "",
			progressCurrent: doc.progress?.current ?? 0,
			progressTotal: doc.progress?.total ?? 0,
		});
	}, [doc, form]);

	useEffect(() => {
		return () => {
			if (progressCommitTimeout.current) {
				clearTimeout(progressCommitTimeout.current);
			}
		};
	}, []);

	if (doc === undefined) {
		return (
			<div className="container mx-auto p-4 md:p-6">
				<p className="text-sm text-muted-foreground">Cargando...</p>
			</div>
		);
	}

	if (doc === null) {
		return (
			<div className="container mx-auto p-4 md:p-6 space-y-4">
				<p className="text-sm text-muted-foreground">Obra no encontrada.</p>
				<Link to="/biblioteca" className="text-sm underline underline-offset-3">
					Volver a la biblioteca
				</Link>
			</div>
		);
	}

	const obra = obraFromDoc(doc);
	const hasProgress = obra.type !== "movie";
	const progressUnitLabel = progressUnitLabels[obra.type];
	const metadataSource = metadataSourceByType[obra.type];
	const metadataSourceLabel = metadataSourceLabels[metadataSource];
	const canSearchMetadata =
		metadataQuery.trim().length > 0 && !isSearchingMetadata;
	const metadata = obra.metadata;
	const showOngoingBadge =
		(obra.type === "series" || obra.type === "anime") &&
		isMetadataOngoing(metadata?.status);
	const showUpToDateBadge = isObraUpToDate(obra);
	const metadataItems: Array<{ label: string; value: string }> = [];
	if (metadata) {
		const statusLabel = metadata.status
			? (metadataStatusLabels[metadata.status] ?? metadata.status)
			: undefined;
		const seasonLabel = metadata.season
			? (seasonLabels[metadata.season] ?? metadata.season)
			: undefined;
		const seasonText =
			seasonLabel && metadata.seasonYear
				? `${seasonLabel} ${metadata.seasonYear}`
				: seasonLabel;

		if (obra.type === "book" && metadata.pages) {
			metadataItems.push({
				label: "Páginas",
				value: metadata.pages.toLocaleString(),
			});
		}
		if (obra.type === "movie" && metadata.runtime) {
			metadataItems.push({
				label: "Duración",
				value: `${metadata.runtime} min`,
			});
		}
		if (obra.type === "movie" && metadata.watchProviders) {
			metadataItems.push({
				label: "Plataformas en Chile",
				value: metadata.watchProviders.length
					? metadata.watchProviders.join(", ")
					: "Sin plataformas en Chile",
			});
		}
		if (obra.type === "series" && metadata.seasons) {
			metadataItems.push({
				label: "Temporadas",
				value: metadata.seasons.toLocaleString(),
			});
		}
		if (
			(obra.type === "series" || obra.type === "anime") &&
			metadata.episodes
		) {
			metadataItems.push({
				label: "Episodios",
				value: metadata.episodes.toLocaleString(),
			});
		}
		if (obra.type === "anime" && seasonText) {
			metadataItems.push({
				label: "Temporada",
				value: seasonText,
			});
		}
		if (
			(obra.type === "series" || obra.type === "anime") &&
			metadata.episodesAired
		) {
			metadataItems.push({
				label: "Emitidos",
				value: metadata.episodesAired.toLocaleString(),
			});
		}
		if (
			(obra.type === "series" || obra.type === "anime") &&
			metadata.nextEpisodeDate
		) {
			metadataItems.push({
				label: "Próximo episodio",
				value: new Date(metadata.nextEpisodeDate).toLocaleDateString(),
			});
		}
		if (obra.type === "manga" && metadata.chapters) {
			metadataItems.push({
				label: "Capítulos",
				value: metadata.chapters.toLocaleString(),
			});
		}
		if (obra.type === "manga" && metadata.volumes) {
			metadataItems.push({
				label: "Volúmenes",
				value: metadata.volumes.toLocaleString(),
			});
		}
		if (obra.type === "manga" && statusLabel) {
			metadataItems.push({
				label: "Estado de publicación",
				value: statusLabel,
			});
		}
		if ((obra.type === "series" || obra.type === "anime") && statusLabel) {
			metadataItems.push({
				label: "Estado de emisión",
				value: statusLabel,
			});
		}
		if (obra.type === "movie" && statusLabel) {
			metadataItems.push({
				label: "Estado",
				value: statusLabel,
			});
		}
	}
	const technicalItems: Array<{ label: string; value: string }> = [];
	if (obra.year) {
		technicalItems.push({ label: "Año", value: obra.year.toString() });
	}
	technicalItems.push(...metadataItems);
	if (obra.external) {
		technicalItems.push({ label: "Fuente", value: metadataSourceLabel });
	}

	const handleStatusChange = async (status: ObraStatus) => {
		await updateObra({ id, patch: { status } });
	};

	const handleDelete = async () => {
		await removeObra({ id });
		navigate({ to: "/biblioteca" });
	};

	const handleQuickProgressUpdate = async (
		nextCurrent: number,
		nextTotal: number,
		nextStatus?: ObraStatus,
	) => {
		if (isUpdatingProgress) return;
		if (!Number.isFinite(nextTotal) || nextTotal <= 0) return;
		const safeCurrent = Math.min(Math.max(nextCurrent, 0), nextTotal);
		const patch: Record<string, unknown> = {
			progress: {
				current: safeCurrent,
				total: nextTotal,
			},
		};
		const inferredStatus =
			nextStatus ??
			(obra.status !== "in-progress" && safeCurrent > 0
				? "in-progress"
				: undefined);
		if (inferredStatus) patch.status = inferredStatus;

		setIsUpdatingProgress(true);
		try {
			await updateObra({ id, patch });
			form.setFieldValue("progressCurrent", safeCurrent);
			form.setFieldValue("progressTotal", nextTotal);
		} finally {
			setIsUpdatingProgress(false);
		}
	};

	const scheduleProgressCommit = (nextCurrent: number, nextTotal: number) => {
		if (progressCommitTimeout.current) {
			clearTimeout(progressCommitTimeout.current);
		}
		progressCommitTimeout.current = setTimeout(() => {
			progressCommitTimeout.current = null;
			void handleQuickProgressUpdate(nextCurrent, nextTotal);
		}, 600);
	};

	const handleOpenInObsidian = async (pathValue: string) => {
		const trimmedPath = pathValue.trim();
		if (!trimmedPath) return;

		setIsOpeningObsidian(true);
		setObsidianError(null);
		try {
			const response = await fetch(
				`/api/obsidian/open?path=${encodeURIComponent(trimmedPath)}`,
			);
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				const message =
					payload && typeof payload.error === "string"
						? payload.error
						: "No se pudo abrir Obsidian.";
				throw new Error(message);
			}

			const payload = await response.json();
			if (!payload?.url) {
				throw new Error("Respuesta invalida.");
			}

			window.location.assign(payload.url);
		} catch (error) {
			setObsidianError(
				error instanceof Error ? error.message : "No se pudo abrir Obsidian.",
			);
		} finally {
			setIsOpeningObsidian(false);
		}
	};

	const handleMetadataOpenChange = (nextOpen: boolean) => {
		setIsMetadataOpen(nextOpen);
		if (nextOpen) {
			setMetadataError(null);
			setMetadataResults([]);
			setMetadataQuery((current) => (current.trim() ? current : obra.title));
		}
	};

	const handleMetadataSearch = async () => {
		if (!metadataQuery.trim() || isSearchingMetadata) return;

		setIsSearchingMetadata(true);
		setMetadataError(null);
		try {
			const response = await fetch(
				`/api/metadata/search?type=${encodeURIComponent(
					obra.type,
				)}&q=${encodeURIComponent(metadataQuery.trim())}`,
			);
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				console.error("[metadata/search] request failed", {
					status: response.status,
					statusText: response.statusText,
					payload,
					url: response.url,
				});
				const message =
					payload && typeof payload.error === "string"
						? payload.error
						: "No se pudo buscar metadatos.";
				throw new Error(message);
			}

			const payload = await response.json();
			const results = Array.isArray(payload?.results)
				? (payload.results as MetadataSearchResult[])
				: [];
			setMetadataResults(results);
			if (results.length === 0) {
				setMetadataError("No hay resultados.");
			}
		} catch (error) {
			setMetadataError(
				error instanceof Error ? error.message : "No se pudo buscar metadatos.",
			);
		} finally {
			setIsSearchingMetadata(false);
		}
	};

	const handleApplyMetadata = async (result: MetadataSearchResult) => {
		if (isApplyingMetadata) return;

		setIsApplyingMetadata(true);
		setMetadataError(null);
		try {
			let details: MetadataDetails | undefined;
			try {
				const detailsResponse = await fetch(
					`/api/metadata/details?source=${encodeURIComponent(
						result.source,
					)}&id=${encodeURIComponent(result.id)}&type=${encodeURIComponent(
						obra.type,
					)}`,
				);
				if (detailsResponse.ok) {
					const payload = await detailsResponse.json();
					details = payload?.details as MetadataDetails | undefined;
				} else {
					const payload = await detailsResponse.json().catch(() => ({}));
					console.error("[metadata/details] request failed", {
						status: detailsResponse.status,
						statusText: detailsResponse.statusText,
						payload,
						url: detailsResponse.url,
					});
				}
			} catch (error) {
				void error;
			}

			const patch: Record<string, unknown> = {
				title: details?.title ?? result.title,
				external: {
					source: result.source,
					id: result.id,
				},
			};
			const creator = details?.creator ?? result.creator;
			const year = details?.year ?? result.year;
			const coverUrl = details?.coverUrl ?? result.coverUrl;
			const metadataPayload = buildMetadataPayload(details ?? result);
			if (creator) patch.creator = creator;
			if (year) patch.year = year;
			if (coverUrl) patch.coverUrl = coverUrl;
			if (metadataPayload) patch.metadata = metadataPayload;

			await updateObra({
				id,
				patch,
			});
			setIsMetadataOpen(false);
		} catch (error) {
			setMetadataError(
				error instanceof Error
					? error.message
					: "No se pudo aplicar metadatos.",
			);
		} finally {
			setIsApplyingMetadata(false);
		}
	};

	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="container mx-auto space-y-6 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<Link
						to="/biblioteca"
						className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4" />
						Volver
					</Link>

					<AlertDialog>
						<AlertDialogTrigger
							render={<Button variant="outline" size="sm" className="gap-2" />}
						>
							<Trash2 className="h-4 w-4" />
							Eliminar
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Eliminar obra?</AlertDialogTitle>
								<AlertDialogDescription>
									Esto no se puede deshacer.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancelar</AlertDialogCancel>
								<AlertDialogAction onClick={handleDelete}>
									Eliminar
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>

				<div className="rounded-lg border border-border/60 bg-card/70 p-4 md:p-6 shadow-sm space-y-6">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start">
						<div className="flex items-start gap-4 min-w-0">
							{obra.coverUrl && (
								<div className="h-28 w-20 overflow-hidden rounded-lg bg-muted/60">
									<img
										src={obra.coverUrl}
										alt=""
										className="h-full w-full object-cover"
										loading="lazy"
									/>
								</div>
							)}
							<div className="min-w-0 space-y-1">
								<div className="flex flex-wrap items-center gap-2">
									<TypeBadge type={obra.type} />
									<StatusBadge status={obra.status} />
									{showOngoingBadge && (
										<Badge
											variant="outline"
											className="h-4 rounded-full border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-200"
										>
											En emisión
										</Badge>
									)}
									{showUpToDateBadge && (
										<Badge
											variant="outline"
											className="h-4 rounded-full border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200"
										>
											Al día
										</Badge>
									)}
								</div>
								<h1 className="text-2xl font-semibold tracking-tight font-serif">
									{obra.title}
								</h1>
								{obra.creator && (
									<p className="text-sm text-muted-foreground">
										{obra.creator}
									</p>
								)}
							</div>
						</div>
					</div>

					<div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
						<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-sm font-medium">Ficha técnica</p>
							<p className="text-xs text-muted-foreground">
								Actualizado {new Date(obra.updatedAt).toLocaleString()}
							</p>
						</div>
						{technicalItems.length > 0 ? (
							<div className="mt-3 grid gap-2 sm:grid-cols-2">
								{technicalItems.map((item) => (
									<div key={item.label} className="text-sm">
										<span className="text-muted-foreground">{item.label}:</span>{" "}
										<span className="text-foreground">{item.value}</span>
									</div>
								))}
							</div>
						) : (
							<p className="mt-3 text-sm text-muted-foreground">
								Sin datos técnicos.
							</p>
						)}
					</div>

					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							void form.handleSubmit();
						}}
						className="space-y-6"
					>
						{hasProgress && (
							<section className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-4">
								<p className="text-sm font-medium">Progreso</p>
								<div className="grid gap-4 sm:grid-cols-3">
									<div className="space-y-3">
										<Label>
											Progreso
											{progressUnitLabel ? ` (${progressUnitLabel})` : ""}
										</Label>
										<form.Subscribe
											selector={(state) =>
												[
													state.values.progressCurrent,
													state.values.progressTotal,
												] as const
											}
										>
											{([progressCurrent, progressTotal]) => {
												const safeTotal = Math.max(0, progressTotal || 0);
												const safeCurrent = Math.min(
													Math.max(progressCurrent || 0, 0),
													safeTotal,
												);
												const isDisabled = isUpdatingProgress || safeTotal <= 0;

												return (
													<div className="space-y-3">
														<div className="flex items-center justify-between">
															<span className="text-sm text-muted-foreground">
																{safeCurrent} / {safeTotal || "—"}
															</span>
														</div>
														<div className="flex items-center gap-3">
															<Button
																type="button"
																variant="outline"
																size="icon"
																disabled={isDisabled}
																onClick={() =>
																	handleQuickProgressUpdate(
																		safeCurrent - 1,
																		safeTotal,
																	)
																}
															>
																<Minus className="h-4 w-4" />
															</Button>
															<Slider
																min={0}
																max={safeTotal || 1}
																step={1}
																disabled={safeTotal <= 0}
																value={[safeCurrent]}
																onValueChange={(value) => {
																	const nextValue = Array.isArray(value)
																		? value[0]
																		: value;
																	form.setFieldValue(
																		"progressCurrent",
																		nextValue ?? 0,
																	);
																	if (
																		safeTotal > 0 &&
																		nextValue !== undefined
																	) {
																		scheduleProgressCommit(
																			nextValue,
																			safeTotal,
																		);
																	}
																}}
																className="flex-1"
															/>
															<Button
																type="button"
																variant="outline"
																size="icon"
																disabled={isDisabled}
																onClick={() =>
																	handleQuickProgressUpdate(
																		safeCurrent + 1,
																		safeTotal,
																	)
																}
															>
																<Plus className="h-4 w-4" />
															</Button>
														</div>
														{safeTotal <= 0 && (
															<p className="text-xs text-muted-foreground">
																Define un total para usar el slider.
															</p>
														)}
														<div className="space-y-2">
															<Label>
																Total
																{progressUnitLabel
																	? ` (${progressUnitLabel})`
																	: ""}
															</Label>
															<form.Field name="progressTotal">
																{(field) => (
																	<Input
																		type="number"
																		min={0}
																		step={1}
																		value={
																			Number.isFinite(field.state.value)
																				? String(field.state.value)
																				: ""
																		}
																		onChange={(event) => {
																			const rawValue = event.target.value;
																			const nextValue = rawValue
																				? Number(rawValue)
																				: 0;
																			field.handleChange(
																				Number.isNaN(nextValue) ? 0 : nextValue,
																			);
																		}}
																		className="max-w-[140px]"
																	/>
																)}
															</form.Field>
														</div>
													</div>
												);
											}}
										</form.Subscribe>
										<form.Subscribe
											selector={(state) => [state.values.progressTotal]}
										>
											{([progressTotal]) => (
												<div className="flex flex-wrap gap-2">
													<Button
														type="button"
														variant="outline"
														size="sm"
														disabled={isUpdatingProgress || progressTotal <= 0}
														onClick={() =>
															handleQuickProgressUpdate(
																progressTotal,
																progressTotal,
															)
														}
													>
														Al total
													</Button>
													<Button
														type="button"
														size="sm"
														disabled={
															isUpdatingProgress ||
															progressTotal <= 0 ||
															obra.status === "finished"
														}
														onClick={() =>
															handleQuickProgressUpdate(
																progressTotal,
																progressTotal,
																"finished",
															)
														}
													>
														Marcar terminada
													</Button>
												</div>
											)}
										</form.Subscribe>
										<form.Subscribe
											selector={(state) =>
												[
													state.values.progressCurrent,
													state.values.progressTotal,
												] as const
											}
										>
											{([progressCurrent, progressTotal]) => {
												const canSaveProgress =
													Number.isFinite(progressCurrent) &&
													Number.isFinite(progressTotal) &&
													progressTotal >= 0 &&
													progressCurrent >= 0 &&
													(progressTotal === 0 ||
														progressCurrent <= progressTotal);

												if (canSaveProgress) return null;
												return (
													<p className="text-sm text-destructive">
														El progreso no puede superar el total.
													</p>
												);
											}}
										</form.Subscribe>
									</div>
									<div className="sm:col-span-2 flex items-end justify-end">
										<form.Subscribe
											selector={(state) =>
												[
													state.values.progressCurrent,
													state.values.progressTotal,
													state.isSubmitting,
												] as const
											}
										>
											{([progressCurrent, progressTotal, isSubmitting]) => {
												const canSaveProgress =
													Number.isFinite(progressCurrent) &&
													Number.isFinite(progressTotal) &&
													progressTotal >= 0 &&
													progressCurrent >= 0 &&
													(progressTotal === 0 ||
														progressCurrent <= progressTotal);

												return (
													<Button
														type="submit"
														disabled={isSubmitting || !canSaveProgress}
														className={cn(
															!canSaveProgress && "pointer-events-none",
														)}
													>
														{isSubmitting ? "Guardando..." : "Guardar cambios"}
													</Button>
												);
											}}
										</form.Subscribe>
									</div>
								</div>
							</section>
						)}
						<section className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-4">
							<p className="text-sm font-medium">Metadatos y Obsidian</p>
							<div className="space-y-2">
								<Label>Metadatos</Label>
								<Dialog
									open={isMetadataOpen}
									onOpenChange={handleMetadataOpenChange}
								>
									<DialogTrigger
										render={<Button variant="outline" size="sm" />}
									>
										Buscar metadatos
									</DialogTrigger>
									<DialogContent className="sm:max-w-lg rounded-lg">
										<DialogHeader>
											<DialogTitle className="text-lg font-semibold font-serif">
												Buscar metadatos
											</DialogTitle>
											<DialogDescription>
												Proveedor: {metadataSourceLabel}
											</DialogDescription>
										</DialogHeader>
										<div className="space-y-3">
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
												<Input
													value={metadataQuery}
													onChange={(e) => setMetadataQuery(e.target.value)}
													placeholder={`Buscar en ${metadataSourceLabel}`}
												/>
												<Button
													type="button"
													disabled={!canSearchMetadata}
													onClick={handleMetadataSearch}
												>
													{isSearchingMetadata ? "Buscando..." : "Buscar"}
												</Button>
											</div>
											{metadataError && (
												<p className="text-sm text-destructive">
													{metadataError}
												</p>
											)}
											{metadataResults.length === 0 &&
												!metadataError &&
												!isSearchingMetadata && (
													<p className="text-sm text-muted-foreground">
														Ingresa un término para buscar.
													</p>
												)}
											{metadataResults.length > 0 && (
												<div className="space-y-2 max-h-64 overflow-auto">
													{metadataResults.map((result) => {
														const details = [
															result.creator,
															result.year?.toString(),
														]
															.filter(Boolean)
															.join(" • ");
														return (
															<div
																key={`${result.source}-${result.id}`}
																className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2"
															>
																<div className="min-w-0">
																	<p className="text-sm font-medium truncate">
																		{result.title}
																	</p>
																	{details && (
																		<p className="text-xs text-muted-foreground">
																			{details}
																		</p>
																	)}
																</div>
																<Button
																	type="button"
																	size="sm"
																	disabled={isApplyingMetadata}
																	onClick={() => handleApplyMetadata(result)}
																>
																	{isApplyingMetadata
																		? "Aplicando..."
																		: "Aplicar"}
																</Button>
															</div>
														);
													})}
												</div>
											)}
										</div>
										<DialogFooter>
											<Button
												type="button"
												variant="outline"
												onClick={() => setIsMetadataOpen(false)}
											>
												Cerrar
											</Button>
										</DialogFooter>
									</DialogContent>
								</Dialog>
								<p className="text-xs text-muted-foreground">
									Proveedor recomendado: {metadataSourceLabel}.
								</p>
							</div>
							<div className="space-y-2">
								<Label>Obsidian</Label>
								<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
									<form.Field name="obsidianPath">
										{(field) => (
											<Input
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="500-Library/Books/Título.md"
												className="flex-1"
											/>
										)}
									</form.Field>
									<form.Subscribe
										selector={(state) => state.values.obsidianPath}
									>
										{(obsidianPath) => (
											<Button
												type="button"
												variant="outline"
												disabled={!obsidianPath.trim() || isOpeningObsidian}
												onClick={() => handleOpenInObsidian(obsidianPath)}
											>
												{isOpeningObsidian
													? "Abriendo..."
													: "Abrir en Obsidian"}
											</Button>
										)}
									</form.Subscribe>
								</div>
								<p className="text-xs text-muted-foreground">
									Path relativo al vault.
								</p>
								{obsidianError && (
									<p className="text-sm text-destructive">{obsidianError}</p>
								)}
							</div>
						</section>
						<section className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-4">
							<p className="text-sm font-medium">Estado y fechas</p>
							<div className="space-y-2">
								<Label>Estado</Label>
								<Select
									value={obra.status}
									onValueChange={(v) => handleStatusChange(v as ObraStatus)}
								>
									<SelectTrigger>
										<span className="truncate">
											{statusLabels[obra.status]}
										</span>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="backlog">Pendiente</SelectItem>
										<SelectItem value="in-progress">En progreso</SelectItem>
										<SelectItem value="finished">Terminada</SelectItem>
										<SelectItem value="dropped">Abandonada</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label>Fecha de inicio</Label>
									<form.Field name="startedAt">
										{(field) => (
											<Input
												type="date"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
											/>
										)}
									</form.Field>
								</div>
								<div className="space-y-2">
									<Label>Fecha de término</Label>
									<form.Field name="finishedAt">
										{(field) => (
											<Input
												type="date"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
											/>
										)}
									</form.Field>
								</div>
							</div>
						</section>

						<section className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-4">
							<p className="text-sm font-medium">Notas y reseña</p>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label>Reseña</Label>
									<form.Field name="review">
										{(field) => (
											<Textarea
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="Qué te dejó esta obra?"
												rows={4}
											/>
										)}
									</form.Field>
								</div>
								<div className="space-y-2">
									<Label>Notas (Markdown)</Label>
									<form.Field name="notes">
										{(field) => (
											<Textarea
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="Ideas, citas, preguntas..."
												rows={8}
											/>
										)}
									</form.Field>
								</div>
							</div>
						</section>

						{!hasProgress && (
							<div className="flex justify-end">
								<form.Subscribe selector={(state) => state.isSubmitting}>
									{(isSubmitting) => (
										<Button type="submit" disabled={isSubmitting}>
											{isSubmitting ? "Guardando..." : "Guardar cambios"}
										</Button>
									)}
								</form.Subscribe>
							</div>
						)}
					</form>
				</div>
			</div>
		</div>
	);
}
