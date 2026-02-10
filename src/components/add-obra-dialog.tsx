import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { useEffect, useId, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type {
	MetadataDetails,
	MetadataSearchResult,
} from "@/lib/metadata/types";
import type { ObraStatus, ObraType } from "@/lib/types";
import { api } from "../../convex/_generated/api";
import { Plus } from "./icons";

const obraTypes: { value: ObraType; label: string }[] = [
	{ value: "book", label: "Libro" },
	{ value: "movie", label: "Película" },
	{ value: "series", label: "Serie" },
	{ value: "anime", label: "Anime" },
	{ value: "manga", label: "Manga" },
];

const obraStatuses: { value: ObraStatus; label: string }[] = [
	{ value: "backlog", label: "Pendiente" },
	{ value: "in-progress", label: "En progreso" },
	{ value: "finished", label: "Terminada" },
	{ value: "dropped", label: "Abandonada" },
];

const obraTypeLabels: Record<ObraType, string> = {
	book: "Libro",
	movie: "Película",
	series: "Serie",
	anime: "Anime",
	manga: "Manga",
};

const obraStatusLabels: Record<ObraStatus, string> = {
	backlog: "Pendiente",
	"in-progress": "En progreso",
	finished: "Terminada",
	dropped: "Abandonada",
};

const metadataSourceLabels = {
	"google-books": "Google Books",
	"open-library": "Open Library",
	tmdb: "TMDB",
	anilist: "AniList",
};

const metadataSourceByType: Record<
	ObraType,
	keyof typeof metadataSourceLabels
> = {
	book: "google-books",
	movie: "tmdb",
	series: "tmdb",
	anime: "anilist",
	manga: "anilist",
};

const parseDateInput = (value: string) => {
	if (!value.trim()) return undefined;
	const timestamp = new Date(value).getTime();
	return Number.isNaN(timestamp) ? undefined : timestamp;
};

interface AddObraDialogProps {
	triggerMode?: "default" | "fab";
	className?: string;
}

export function AddObraDialog({
	triggerMode = "default",
	className,
}: AddObraDialogProps = {}) {
	const [open, setOpen] = useState(false);
	const [metadataQuery, setMetadataQuery] = useState("");
	const [metadataResults, setMetadataResults] = useState<
		MetadataSearchResult[]
	>([]);
	const [selectedMetadata, setSelectedMetadata] =
		useState<MetadataSearchResult | null>(null);
	const [metadataDetails, setMetadataDetails] =
		useState<MetadataDetails | null>(null);
	const [metadataError, setMetadataError] = useState<string | null>(null);
	const [isSearchingMetadata, setIsSearchingMetadata] = useState(false);
	const [isLoadingMetadataDetails, setIsLoadingMetadataDetails] =
		useState(false);
	const [isMetadataPreviewOpen, setIsMetadataPreviewOpen] = useState(false);
	const [previewResult, setPreviewResult] =
		useState<MetadataSearchResult | null>(null);
	const [previewDetails, setPreviewDetails] = useState<MetadataDetails | null>(
		null,
	);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [isLoadingPreviewDetails, setIsLoadingPreviewDetails] = useState(false);
	const [lastMetadataSearchUrl, setLastMetadataSearchUrl] = useState<
		string | null
	>(null);
	const [activeType, setActiveType] = useState<ObraType | "">("");
	const metadataAbortRef = useRef<AbortController | null>(null);
	const metadataDebounceRef = useRef<number | null>(null);
	const titleId = useId();
	const typeId = useId();
	const statusId = useId();
	const creatorId = useId();
	const yearId = useId();
	const startedAtId = useId();
	const finishedAtId = useId();
	const readingUrlId = useId();
	const totalId = useId();
	const tagsId = useId();
	const createObra = useMutation(api.obras.create);

	const form = useForm({
		defaultValues: {
			title: "",
			type: "" as ObraType | "",
			status: "backlog" as ObraStatus,
			creator: "",
			year: "",
			startedAt: "",
			finishedAt: "",
			readingUrl: "",
			tags: "",
			totalProgress: "",
		},
		onSubmit: async ({ value }) => {
			if (!value.title.trim()) return;
			if (!value.type) return;

			const parsedTotalProgress = Math.max(
				0,
				Number.parseInt(value.totalProgress, 10) || 0,
			);
			const parsedYear = Number.parseInt(value.year, 10);
			const year = Number.isFinite(parsedYear) ? parsedYear : undefined;
			const startedAt = parseDateInput(value.startedAt);
			const finishedAt = parseDateInput(value.finishedAt);

			await createObra({
				title: value.title.trim(),
				type: value.type as ObraType,
				status: value.status,
				creator: value.creator.trim() || undefined,
				year,
				startedAt,
				finishedAt,
				readingUrl: value.readingUrl.trim() || undefined,
				tags: value.tags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean),
				external: selectedMetadata
					? {
							source: selectedMetadata.source,
							id: selectedMetadata.id,
						}
					: undefined,
				metadata: buildMetadataPayload(),
				coverUrl:
					metadataDetails?.coverUrl ?? selectedMetadata?.coverUrl ?? undefined,
				progress:
					value.type !== "movie" && parsedTotalProgress > 0
						? { current: 0, total: parsedTotalProgress }
						: undefined,
			});

			form.reset();
			setMetadataQuery("");
			setMetadataResults([]);
			setSelectedMetadata(null);
			setMetadataDetails(null);
			setIsMetadataPreviewOpen(false);
			setPreviewResult(null);
			setPreviewDetails(null);
			setPreviewError(null);
			setMetadataError(null);
			setLastMetadataSearchUrl(null);
			setIsSearchingMetadata(false);
			setIsLoadingMetadataDetails(false);
			setActiveType("");
			setOpen(false);
		},
	});

	const metadataSourceLabel = activeType
		? metadataSourceLabels[metadataSourceByType[activeType]]
		: "Selecciona un tipo";

	useEffect(() => {
		if (!open || selectedMetadata || !activeType) return;

		const query = metadataQuery.trim();
		if (query.length < 3) {
			setMetadataResults([]);
			setMetadataError(null);
			setIsSearchingMetadata(false);
			return;
		}

		if (metadataDebounceRef.current) {
			window.clearTimeout(metadataDebounceRef.current);
		}
		metadataAbortRef.current?.abort();

		const controller = new AbortController();
		metadataAbortRef.current = controller;

		metadataDebounceRef.current = window.setTimeout(async () => {
			setIsSearchingMetadata(true);
			setMetadataError(null);
			try {
				const response = await fetch(
					`/api/metadata/search?type=${encodeURIComponent(
						activeType,
					)}&q=${encodeURIComponent(query)}`,
					{ signal: controller.signal },
				);
				setLastMetadataSearchUrl(response.url);
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
				if (error instanceof Error && error.name === "AbortError") {
					return;
				}
				setMetadataError(
					error instanceof Error
						? error.message
						: "No se pudo buscar metadatos.",
				);
			} finally {
				setIsSearchingMetadata(false);
			}
		}, 350);

		return () => {
			controller.abort();
			if (metadataDebounceRef.current) {
				window.clearTimeout(metadataDebounceRef.current);
			}
		};
	}, [open, metadataQuery, activeType, selectedMetadata]);

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			metadataAbortRef.current?.abort();
			if (metadataDebounceRef.current) {
				window.clearTimeout(metadataDebounceRef.current);
			}
			form.reset();
			setMetadataQuery("");
			setMetadataResults([]);
			setSelectedMetadata(null);
			setMetadataDetails(null);
			setIsMetadataPreviewOpen(false);
			setPreviewResult(null);
			setPreviewDetails(null);
			setPreviewError(null);
			setMetadataError(null);
			setLastMetadataSearchUrl(null);
			setIsSearchingMetadata(false);
			setIsLoadingMetadataDetails(false);
			setActiveType("");
		}
	};

	const handleOpenMetadataPreview = async (result: MetadataSearchResult) => {
		setIsMetadataPreviewOpen(true);
		setPreviewResult(result);
		setPreviewDetails(null);
		setPreviewError(null);
		setIsLoadingPreviewDetails(true);
		try {
			const response = await fetch(
				`/api/metadata/details?source=${encodeURIComponent(
					result.source,
				)}&id=${encodeURIComponent(result.id)}&type=${encodeURIComponent(
					activeType,
				)}`,
			);
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				const message =
					payload && typeof payload.error === "string"
						? payload.error
						: "No se pudo cargar metadatos.";
				throw new Error(message);
			}

			const payload = await response.json();
			const details = payload?.details as MetadataDetails | undefined;
			if (details) setPreviewDetails(details);
		} catch (error) {
			setPreviewError(
				error instanceof Error ? error.message : "No se pudo cargar metadatos.",
			);
		} finally {
			setIsLoadingPreviewDetails(false);
		}
	};

	const handleSelectMetadata = () => {
		if (!previewResult) return;

		const nextMetadata = previewDetails ?? previewResult;
		setSelectedMetadata(previewResult);
		setMetadataDetails(previewDetails);
		setMetadataResults([]);
		setMetadataError(null);
		setIsMetadataPreviewOpen(false);
		form.setFieldValue("title", nextMetadata.title ?? previewResult.title);
		setMetadataQuery(nextMetadata.title ?? previewResult.title);
		if (nextMetadata.creator) {
			form.setFieldValue("creator", nextMetadata.creator);
		}
		if (nextMetadata.year) {
			form.setFieldValue("year", String(nextMetadata.year));
		}

		const total = getTotalFromMetadata(nextMetadata);
		if (total) {
			form.setFieldValue("totalProgress", String(total));
		}
	};

	const previewMetadata = previewResult
		? {
				...previewResult,
				...previewDetails,
				title: previewDetails?.title ?? previewResult.title,
			}
		: null;

	const previewRows: Array<{
		label: string;
		value?: string;
		showLoading?: boolean;
	}> = [];
	const mangaChapterPreview = previewMetadata
		? (previewMetadata.latestChapter ?? previewMetadata.chapters)
		: undefined;

	if (previewMetadata) {
		previewRows.push({
			label: "Título",
			value: previewMetadata.title,
			showLoading: true,
		});
		previewRows.push({
			label: "Creador",
			value: previewMetadata.creator,
			showLoading: true,
		});
		previewRows.push({
			label: "Año",
			value: previewMetadata.year ? String(previewMetadata.year) : undefined,
			showLoading: true,
		});
		previewRows.push({
			label: "Páginas",
			value:
				previewMetadata.pages !== undefined
					? previewMetadata.pages.toLocaleString()
					: undefined,
			showLoading: activeType === "book",
		});
		previewRows.push({
			label: "Temporadas",
			value:
				previewMetadata.seasons !== undefined
					? previewMetadata.seasons.toLocaleString()
					: undefined,
			showLoading: activeType === "series",
		});
		previewRows.push({
			label: "Episodios",
			value:
				previewMetadata.episodes !== undefined
					? previewMetadata.episodes.toLocaleString()
					: undefined,
			showLoading: activeType === "series" || activeType === "anime",
		});
		previewRows.push({
			label: "Episodios emitidos",
			value:
				previewMetadata.episodesAired !== undefined
					? previewMetadata.episodesAired.toLocaleString()
					: undefined,
			showLoading: activeType === "series" || activeType === "anime",
		});
		previewRows.push({
			label: "Próximo episodio",
			value:
				previewMetadata.nextEpisodeDate !== undefined
					? new Date(previewMetadata.nextEpisodeDate).toLocaleString()
					: undefined,
			showLoading: activeType === "series" || activeType === "anime",
		});
		previewRows.push({
			label: "Estado",
			value: previewMetadata.status,
			showLoading: true,
		});
		previewRows.push({
			label: "Último capítulo",
			value:
				mangaChapterPreview !== undefined
					? mangaChapterPreview.toLocaleString()
					: undefined,
			showLoading: activeType === "manga",
		});
		previewRows.push({
			label: "Volúmenes",
			value:
				previewMetadata.volumes !== undefined
					? previewMetadata.volumes.toLocaleString()
					: undefined,
			showLoading: activeType === "manga",
		});
		previewRows.push({
			label: "Temporada (raw)",
			value: previewMetadata.season,
			showLoading: activeType === "anime",
		});
		previewRows.push({
			label: "Año de temporada",
			value:
				previewMetadata.seasonYear !== undefined
					? String(previewMetadata.seasonYear)
					: undefined,
			showLoading: activeType === "anime",
		});
		previewRows.push({
			label: "Duración",
			value:
				previewMetadata.runtime !== undefined
					? `${previewMetadata.runtime} min`
					: undefined,
			showLoading: activeType === "movie",
		});
		previewRows.push({
			label: "Plataformas",
			value: previewMetadata.watchProviders?.length
				? previewMetadata.watchProviders.join(", ")
				: undefined,
			showLoading: activeType === "movie",
		});
	}

	const requestDebugSearch =
		activeType && metadataQuery.trim().length >= 3
			? `/api/metadata/search?type=${encodeURIComponent(activeType)}&q=${encodeURIComponent(metadataQuery.trim())}`
			: null;
	const requestDebugDetails = previewResult
		? `/api/metadata/details?source=${encodeURIComponent(previewResult.source)}&id=${encodeURIComponent(previewResult.id)}&type=${encodeURIComponent(activeType || "")}`
		: null;

	const getTotalFromMetadata = (
		metadata: Pick<
			MetadataSearchResult,
			"pages" | "episodes" | "chapters" | "latestChapter"
		> | null,
	) => {
		if (!metadata) return undefined;
		if (activeType === "book") return metadata.pages;
		if (activeType === "manga")
			return metadata.latestChapter ?? metadata.chapters;
		if (activeType === "series" || activeType === "anime")
			return metadata.episodes;
		return undefined;
	};

	const buildMetadataPayload = () => {
		const source = metadataDetails ?? selectedMetadata;
		if (!source) return undefined;

		const payload = {
			pages: source.pages ?? undefined,
			seasons: source.seasons ?? undefined,
			episodes: source.episodes ?? undefined,
			episodesAired: source.episodesAired ?? undefined,
			nextEpisodeDate: source.nextEpisodeDate ?? undefined,
			status: source.status ?? undefined,
			chapters: source.chapters ?? undefined,
			volumes: source.volumes ?? undefined,
			season: source.season ?? undefined,
			seasonYear: source.seasonYear ?? undefined,
			runtime: source.runtime ?? undefined,
			watchProviders: source.watchProviders ?? undefined,
			latestChapter: source.latestChapter ?? undefined,
			latestChapterSource: source.latestChapterSource ?? undefined,
			latestChapterCheckedAt: source.latestChapterCheckedAt ?? undefined,
			mangaPlusTitleId: source.mangaPlusTitleId ?? undefined,
			mangaDexId: source.mangaDexId ?? undefined,
		};

		const hasData = Object.values(payload).some((value) => value !== undefined);
		return hasData ? payload : undefined;
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger
				render={
					triggerMode === "fab" ? (
						<Button
							size="icon-lg"
							className={`group size-14 rounded-full shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 ${className ?? ""}`}
							aria-label="Agregar nueva obra"
						/>
					) : (
						<Button
							size="lg"
							className={`group h-10 gap-2 rounded-full px-4 font-semibold shadow-md shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 ${className ?? ""}`}
							aria-label="Agregar nueva obra"
						/>
					)
				}
			>
				<Plus
					className={
						triggerMode === "fab"
							? "h-5 w-5 transition-transform group-hover:rotate-90"
							: "h-4 w-4 transition-transform group-hover:rotate-90"
					}
				/>
				{triggerMode === "default" ? (
					"Agregar obra"
				) : (
					<span className="sr-only">Agregar obra</span>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg rounded-xl max-h-[calc(100vh-2rem)] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-lg font-semibold font-serif">
						Nueva obra
					</DialogTitle>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						void form.handleSubmit();
					}}
					className="space-y-3"
				>
					<form.Field name="type">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={typeId}>Tipo</Label>
								<Select
									value={field.state.value}
									onValueChange={(v) => {
										const nextType = v as ObraType;
										field.handleChange(nextType);
										setActiveType(nextType);
										setSelectedMetadata(null);
										setMetadataDetails(null);
										setIsLoadingMetadataDetails(false);
										setMetadataResults([]);
										setMetadataError(null);
										setLastMetadataSearchUrl(null);
										setIsMetadataPreviewOpen(false);
										setPreviewResult(null);
										setPreviewDetails(null);
										setPreviewError(null);
									}}
								>
									<SelectTrigger id={typeId}>
										<span className="truncate">
											{field.state.value
												? obraTypeLabels[field.state.value]
												: "Selecciona un tipo"}
										</span>
									</SelectTrigger>
									<SelectContent>
										{obraTypes.map((t) => (
											<SelectItem key={t.value} value={t.value}>
												{t.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									Elige el tipo antes de buscar metadatos.
								</p>
							</div>
						)}
					</form.Field>

					<form.Field name="title">
						{(field) => (
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label htmlFor={titleId}>Título</Label>
									<span className="text-xs text-muted-foreground">
										{activeType
											? `Buscar en ${metadataSourceLabel}`
											: "Selecciona un tipo para buscar"}
									</span>
								</div>
								<Input
									id={titleId}
									value={field.state.value}
									onChange={(e) => {
										const nextValue = e.target.value;
										field.handleChange(nextValue);
										setMetadataQuery(nextValue);
									}}
									placeholder={
										activeType
											? "Escribe un título..."
											: "Selecciona un tipo para buscar"
									}
									disabled={!activeType}
									autoFocus
								/>
							</div>
						)}
					</form.Field>

					<div className="space-y-2">
						{selectedMetadata ? (
							<div className="rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
								<p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
									Seleccionado
								</p>
								<div className="mt-2 flex items-center justify-between gap-3">
									<div className="min-w-0">
										<p className="text-sm font-medium truncate">
											{selectedMetadata.title}
										</p>
										{(selectedMetadata.creator || selectedMetadata.year) && (
											<p className="text-xs text-muted-foreground">
												{[selectedMetadata.creator, selectedMetadata.year]
													.filter(Boolean)
													.join(" • ")}
											</p>
										)}
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											setSelectedMetadata(null);
											setMetadataError(null);
										}}
									>
										Cambiar
									</Button>
								</div>
								{isLoadingMetadataDetails && (
									<p className="mt-2 text-xs text-muted-foreground">
										Cargando detalles...
									</p>
								)}
								{metadataError && (
									<p className="mt-2 text-xs text-destructive">
										{metadataError}
									</p>
								)}
							</div>
						) : (
							<>
								{!activeType && (
									<p className="text-sm text-muted-foreground">
										Selecciona un tipo para empezar.
									</p>
								)}
								{activeType && metadataQuery.trim().length < 3 && (
									<p className="text-sm text-muted-foreground">
										Escribe al menos 3 caracteres para buscar.
									</p>
								)}
								{activeType && isSearchingMetadata && (
									<p className="text-sm text-muted-foreground">Buscando...</p>
								)}
								{activeType && metadataError && (
									<p className="text-sm text-destructive">{metadataError}</p>
								)}
								{activeType && metadataResults.length > 0 && (
									<div className="space-y-2 max-h-64 overflow-y-auto pr-1">
										{metadataResults.map((result) => (
											<button
												type="button"
												key={`${result.source}-${result.id}`}
												className="w-full text-left rounded-xl border border-border/60 bg-muted/40 px-3 py-2 transition hover:bg-muted/60"
												onClick={() => handleOpenMetadataPreview(result)}
											>
												<div className="flex items-center gap-3">
													{result.coverUrl ? (
														<img
															src={result.coverUrl}
															alt={`Portada de ${result.title}`}
															className="h-12 w-9 rounded-md object-cover"
															loading="lazy"
														/>
													) : (
														<div className="h-12 w-9 rounded-md bg-border/40" />
													)}
													<div className="min-w-0">
														<p className="text-sm font-medium truncate">
															{result.title}
														</p>
														{(result.creator || result.year) && (
															<p className="text-xs text-muted-foreground">
																{[result.creator, result.year]
																	.filter(Boolean)
																	.join(" • ")}
															</p>
														)}
													</div>
												</div>
											</button>
										))}
									</div>
								)}
							</>
						)}
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<form.Field name="year">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={yearId}>Año</Label>
									<Input
										id={yearId}
										type="number"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Ej: 2024"
									/>
								</div>
							)}
						</form.Field>
					</div>

					<form.Field name="creator">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={creatorId}>Autor / Director / Estudio</Label>
								<Input
									id={creatorId}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Ej: Christopher Nolan"
								/>
							</div>
						)}
					</form.Field>

					<div className="border-t border-border/60 pt-4 space-y-3">
						<p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
							Datos personales
						</p>
						<form.Field name="status">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={statusId}>Estado</Label>
									<Select
										value={field.state.value}
										onValueChange={(v) => field.handleChange(v as ObraStatus)}
									>
										<SelectTrigger id={statusId}>
											<span className="truncate">
												{obraStatusLabels[field.state.value]}
											</span>
										</SelectTrigger>
										<SelectContent>
											{obraStatuses.map((s) => (
												<SelectItem key={s.value} value={s.value}>
													{s.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
						</form.Field>

						<form.Subscribe selector={(state) => state.values.status}>
							{(status) => {
								if (status !== "in-progress" && status !== "finished") {
									return null;
								}

								return (
									<div className="grid gap-4 sm:grid-cols-2">
										<form.Field name="startedAt">
											{(field) => (
												<div className="space-y-2">
													<Label htmlFor={startedAtId}>Fecha de inicio</Label>
													<Input
														id={startedAtId}
														type="date"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
													/>
												</div>
											)}
										</form.Field>
										{status === "finished" && (
											<form.Field name="finishedAt">
												{(field) => (
													<div className="space-y-2">
														<Label htmlFor={finishedAtId}>
															Fecha de término
														</Label>
														<Input
															id={finishedAtId}
															type="date"
															value={field.state.value}
															onChange={(e) =>
																field.handleChange(e.target.value)
															}
														/>
													</div>
												)}
											</form.Field>
										)}
									</div>
								);
							}}
						</form.Subscribe>

						<form.Subscribe selector={(state) => state.values.type}>
							{(type) =>
								type &&
								type !== "movie" && (
									<form.Field name="totalProgress">
										{(field) => (
											<div className="space-y-2">
												<Label htmlFor={totalId}>
													Total{" "}
													{type === "book"
														? "páginas"
														: type === "manga"
															? "capítulos"
															: "episodios"}
												</Label>
												<Input
													id={totalId}
													type="number"
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													placeholder="Ej: 320"
												/>
											</div>
										)}
									</form.Field>
								)
							}
						</form.Subscribe>

						<form.Field name="tags">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={tagsId}>Etiquetas (separadas por coma)</Label>
									<Textarea
										id={tagsId}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Ej: sci-fi, filosofia, drama"
										rows={2}
									/>
								</div>
							)}
						</form.Field>

						<form.Field name="readingUrl">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={readingUrlId}>Link personal para leer</Label>
									<Input
										id={readingUrlId}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="https://cubari.moe/..."
									/>
									<p className="text-xs text-muted-foreground">
										Se abre tal cual para que sigas leyendo donde prefieras.
									</p>
								</div>
							)}
						</form.Field>
					</div>

					<div className="flex justify-end gap-2 pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
						>
							Cancelar
						</Button>
						<form.Subscribe
							selector={(state) =>
								[
									state.values.title,
									state.values.type,
									state.isSubmitting,
								] as const
							}
						>
							{([title, type, isSubmitting]) => (
								<Button
									type="submit"
									disabled={isSubmitting || !title.trim() || !type}
								>
									Agregar
								</Button>
							)}
						</form.Subscribe>
					</div>
				</form>
				<Dialog
					open={isMetadataPreviewOpen}
					onOpenChange={setIsMetadataPreviewOpen}
				>
					<DialogContent className="sm:max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl">
						<DialogHeader>
							<DialogTitle>Vista previa de metadatos</DialogTitle>
							<DialogDescription>
								Revisa toda la metadata disponible antes de seleccionar la obra.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							{isLoadingPreviewDetails && (
								<p className="text-sm text-muted-foreground">
									Cargando detalles...
								</p>
							)}
							{previewError && (
								<p className="text-sm text-destructive">{previewError}</p>
							)}
							{previewMetadata && (
								<>
									{previewMetadata.coverUrl && (
										<img
											src={previewMetadata.coverUrl}
											alt={`Portada de ${previewMetadata.title}`}
											className="h-44 w-32 rounded-md object-cover"
											loading="lazy"
										/>
									)}
									<div className="grid gap-2 sm:grid-cols-2">
										{previewRows
											.filter(
												(row) =>
													Boolean(row.value) ||
													(isLoadingPreviewDetails && row.showLoading),
											)
											.map((row) => (
												<div
													key={`${row.label}-${row.value}`}
													className="text-sm"
												>
													<span className="text-muted-foreground">
														{row.label}:
													</span>{" "}
													{row.value ? (
														<span>{row.value}</span>
													) : isLoadingPreviewDetails && row.showLoading ? (
														<span className="inline-block h-3.5 w-28 animate-pulse rounded bg-muted-foreground/25 align-middle" />
													) : null}
												</div>
											))}
									</div>
									{!isLoadingPreviewDetails &&
										activeType === "manga" &&
										mangaChapterPreview === undefined && (
											<p className="text-sm text-muted-foreground">
												Último capítulo: No disponible en el proveedor.
											</p>
										)}
									<details>
										<summary className="cursor-pointer text-sm text-muted-foreground">
											Request debug
										</summary>
										<div className="mt-2 space-y-2">
											{(lastMetadataSearchUrl || requestDebugSearch) && (
												<pre className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs overflow-x-auto">
													{`GET ${lastMetadataSearchUrl ?? requestDebugSearch}`}
												</pre>
											)}
											{requestDebugDetails && (
												<pre className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs overflow-x-auto">
													{`GET ${requestDebugDetails}`}
												</pre>
											)}
											{previewResult?.source === "anilist" && (
												<pre className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs overflow-x-auto whitespace-pre-wrap">
													{`POST https://graphql.anilist.co\nContent-Type: application/json\n\n${JSON.stringify(
														{
															query:
																"query ($id: Int) { Media(id: $id) { id idMal title { romaji english native } coverImage { extraLarge large } season seasonYear status episodes chapters volumes nextAiringEpisode { episode airingAt } externalLinks { site url } staff(perPage: 6) { edges { role node { name { full } } } } studios(isMain: true) { nodes { name } } } }",
															variables: { id: Number(previewResult.id) },
														},
														null,
														2,
													)}`}
												</pre>
											)}
										</div>
									</details>
									<details>
										<summary className="cursor-pointer text-sm text-muted-foreground">
											Ver JSON completo
										</summary>
										<pre className="mt-2 rounded-md border border-border/60 bg-muted/40 p-3 text-xs overflow-x-auto whitespace-pre-wrap">
											{JSON.stringify(previewMetadata, null, 2)}
										</pre>
									</details>
								</>
							)}
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsMetadataPreviewOpen(false)}
							>
								Cerrar
							</Button>
							<Button
								type="button"
								disabled={!previewResult || isLoadingPreviewDetails}
								onClick={handleSelectMetadata}
							>
								Usar metadatos
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</DialogContent>
		</Dialog>
	);
}
