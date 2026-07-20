import { useForm } from "@tanstack/react-form";
import { ArrowLeft } from "lucide-react";
import { useEffect, useId } from "react";
import { TypeIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type {
	MetadataDetails,
	MetadataSearchResult,
} from "@/lib/metadata/types";
import type {
	CreateObraInput,
	ObraFormat,
	ObraStatus,
	ObraType,
} from "@/lib/types";
import { formatDateShort, parseDateInput } from "@/lib/utils";

const obraStatusLabels: Record<ObraStatus, string> = {
	backlog: "Pendiente",
	"in-progress": "En progreso",
	paused: "Pausada",
	hiatus: "Hiatus",
	finished: "Terminada",
	dropped: "Abandonada",
};

const obraStatuses: { value: ObraStatus; label: string }[] = [
	{ value: "backlog", label: "Pendiente" },
	{ value: "in-progress", label: "En progreso" },
	{ value: "paused", label: "Pausada" },
	{ value: "hiatus", label: "Hiatus" },
	{ value: "finished", label: "Terminada" },
	{ value: "dropped", label: "Abandonada" },
];

const bookFormats: { value: ObraFormat; label: string }[] = [
	{ value: "physical", label: "Libro físico" },
	{ value: "ebook", label: "Ebook" },
	{ value: "audiobook", label: "Audiolibro" },
];

const getProgressTotalLabel = (type: ObraType, format?: ObraFormat) => {
	if (type === "book") return format === "audiobook" ? "minutos" : "páginas";
	if (type === "manga" || type === "manhwa") return "capítulos";
	return "episodios";
};

const getTotalFromMetadata = (
	metadata: Pick<
		MetadataSearchResult,
		"pages" | "durationMinutes" | "episodes" | "latestChapter"
	> | null,
	type: ObraType,
	format?: ObraFormat,
) => {
	if (!metadata) return undefined;
	if (type === "book" && format === "audiobook") {
		return metadata.durationMinutes;
	}
	if (type === "book") return metadata.pages;
	if (type === "manga" || type === "manhwa") return metadata.latestChapter;
	if (type === "series" || type === "anime") return metadata.episodes;
	return undefined;
};

function getMetadataRows(
	type: ObraType,
	metadata: MetadataDetails | MetadataSearchResult | null,
	isLoading: boolean,
) {
	if (!metadata) return [];
	const rows: Array<{
		label: string;
		value?: string;
		showLoading?: boolean;
	}> = [];
	rows.push({
		label: "Título",
		value: metadata.title,
		showLoading: true,
	});
	rows.push({
		label: "Creador",
		value: metadata.creator,
		showLoading: true,
	});
	rows.push({
		label: "Año",
		value: metadata.year !== undefined ? String(metadata.year) : undefined,
		showLoading: true,
	});

	if (type === "book") {
		rows.push({
			label: "Páginas",
			value:
				typeof metadata.pages === "number"
					? metadata.pages.toLocaleString()
					: undefined,
			showLoading: true,
		});
		rows.push({
			label: "Duración audio",
			value:
				typeof metadata.durationMinutes === "number"
					? `${metadata.durationMinutes.toLocaleString()} min`
					: undefined,
			showLoading: true,
		});
		rows.push({
			label: "ISBN",
			value: metadata.isbn13 ?? metadata.isbn10,
			showLoading: true,
		});
		rows.push({
			label: "Idioma",
			value: metadata.language,
			showLoading: true,
		});
		rows.push({
			label: "Publicado",
			value: metadata.publishedDate,
			showLoading: true,
		});
	}

	if (type === "movie") {
		rows.push({
			label: "Duración",
			value:
				metadata.runtime !== undefined ? `${metadata.runtime} min` : undefined,
			showLoading: true,
		});
		rows.push({
			label: "Plataformas",
			value: metadata.watchProviders?.length
				? metadata.watchProviders.join(", ")
				: undefined,
			showLoading: true,
		});
	}

	if (type === "series" || type === "anime") {
		rows.push({
			label: "Temporadas",
			value:
				typeof metadata.seasons === "number"
					? metadata.seasons.toLocaleString()
					: undefined,
			showLoading: type === "series",
		});
		rows.push({
			label: "Episodios",
			value:
				typeof metadata.episodes === "number"
					? metadata.episodes.toLocaleString()
					: undefined,
			showLoading: true,
		});
		rows.push({
			label: "Episodios emitidos",
			value:
				typeof metadata.episodesAired === "number"
					? metadata.episodesAired.toLocaleString()
					: undefined,
			showLoading: true,
		});
		rows.push({
			label: "Próximo episodio",
			value:
				metadata.nextEpisodeDate !== undefined
					? formatDateShort(metadata.nextEpisodeDate)
					: undefined,
			showLoading: true,
		});
	}

	if (type === "anime") {
		rows.push({
			label: "Temporada",
			value: metadata.season,
			showLoading: true,
		});
		rows.push({
			label: "Año de temporada",
			value:
				metadata.seasonYear !== undefined
					? String(metadata.seasonYear)
					: undefined,
			showLoading: true,
		});
	}

	if (type === "manga" || type === "manhwa") {
		rows.push({
			label: "Capítulos",
			value:
				typeof metadata.latestChapter === "number"
					? metadata.latestChapter.toLocaleString()
					: undefined,
			showLoading: true,
		});
		rows.push({
			label: "Volúmenes",
			value:
				typeof metadata.volumes === "number"
					? metadata.volumes.toLocaleString()
					: undefined,
			showLoading: true,
		});
	}

	rows.push({
		label: "Estado (proveedor)",
		value: metadata.status,
		showLoading: true,
	});

	return rows.filter(
		(row) => Boolean(row.value) || (isLoading && row.showLoading),
	);
}

function buildMetadataPayload(
	source: MetadataDetails | MetadataSearchResult | null,
) {
	if (!source) return undefined;

	const payload = {
		pages: source.pages ?? undefined,
		durationMinutes: source.durationMinutes ?? undefined,
		subtitle: source.subtitle ?? undefined,
		publisher: source.publisher ?? undefined,
		publishedDate: source.publishedDate ?? undefined,
		language: source.language ?? undefined,
		isbn10: source.isbn10 ?? undefined,
		isbn13: source.isbn13 ?? undefined,
		categories: source.categories ?? undefined,
		description: source.description ?? undefined,
		canonicalUrl: source.canonicalUrl ?? undefined,
		seasons: source.seasons ?? undefined,
		episodes: source.episodes ?? undefined,
		episodesAired: source.episodesAired ?? undefined,
		nextEpisodeDate: source.nextEpisodeDate ?? undefined,
		status: source.status ?? undefined,
		volumes: source.volumes ?? undefined,
		season: source.season ?? undefined,
		seasonYear: source.seasonYear ?? undefined,
		runtime: source.runtime ?? undefined,
		watchProviders: source.watchProviders ?? undefined,
		latestChapter: source.latestChapter ?? undefined,
		latestChapterSource: source.latestChapterSource ?? undefined,
		latestChapterCheckedAt: source.latestChapterCheckedAt ?? undefined,
		lastNotifiedChapter: source.latestChapter ?? undefined,
		mangaPlusTitleId: source.mangaPlusTitleId ?? undefined,
		mangaDexId: source.mangaDexId ?? undefined,
	};

	const hasData = Object.values(payload).some((value) => value !== undefined);
	return hasData ? payload : undefined;
}

interface ObraFormProps {
	type: ObraType;
	selectedMetadata: MetadataSearchResult | null;
	metadataDetails: MetadataDetails | null;
	isLoadingDetails: boolean;
	initialReadingUrl?: string;
	initialSourceUrl?: string;
	onBack: () => void;
	onCancel: () => void;
	onSubmit: (input: CreateObraInput) => Promise<void>;
}

export function ObraForm({
	type,
	selectedMetadata,
	metadataDetails,
	isLoadingDetails,
	initialReadingUrl,
	initialSourceUrl,
	onBack,
	onCancel,
	onSubmit,
}: ObraFormProps) {
	const titleId = useId();
	const statusId = useId();
	const formatId = useId();
	const creatorId = useId();
	const yearId = useId();
	const startedAtId = useId();
	const finishedAtId = useId();
	const recommendedById = useId();
	const readingUrlId = useId();
	const totalId = useId();
	const tagsId = useId();

	const form = useForm({
		defaultValues: {
			title: selectedMetadata?.title ?? "",
			type,
			format: "ebook" as ObraFormat,
			status: "backlog" as ObraStatus,
			creator: selectedMetadata?.creator ?? "",
			year: selectedMetadata?.year ? String(selectedMetadata.year) : "",
			startedAt: "",
			finishedAt: "",
			recommendedBy: "",
			readingUrl: initialReadingUrl ?? "",
			tags: "",
			totalProgress:
				getTotalFromMetadata(selectedMetadata, type, "ebook") ?? "",
		},
		onSubmit: async ({ value }) => {
			if (!value.title.trim()) return;

			const parsedTotalProgress = Math.max(
				0,
				Number.parseInt(String(value.totalProgress), 10) || 0,
			);
			const parsedYear = Number.parseInt(value.year, 10);
			const year = Number.isFinite(parsedYear) ? parsedYear : undefined;
			const startedAt = parseDateInput(value.startedAt);
			const finishedAt = parseDateInput(value.finishedAt);
			const movieWatchedAt =
				value.type === "movie" ? (finishedAt ?? startedAt) : undefined;

			const metadataPayload = buildMetadataPayload(
				metadataDetails ?? selectedMetadata,
			);

			const input: CreateObraInput = {
				title: value.title.trim(),
				type: value.type as ObraType,
				format: value.type === "book" ? value.format : undefined,
				status: value.status,
				creator: value.creator.trim() || undefined,
				year,
				startedAt: value.type === "movie" ? movieWatchedAt : startedAt,
				finishedAt: value.type === "movie" ? movieWatchedAt : finishedAt,
				recommendedBy: value.recommendedBy.trim() || undefined,
				readingUrl: value.readingUrl.trim() || undefined,
				sourceUrl:
					(metadataDetails?.canonicalUrl ??
						selectedMetadata?.canonicalUrl ??
						initialSourceUrl ??
						"") ||
					undefined,
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
				metadata: metadataPayload,
				coverUrl:
					metadataDetails?.coverUrl ?? selectedMetadata?.coverUrl ?? undefined,
				progress:
					value.type !== "movie" && parsedTotalProgress > 0
						? { current: 0, total: parsedTotalProgress }
						: undefined,
				progressSeasons:
					value.type === "series" || value.type === "anime"
						? (metadataDetails?.seasonDetails ??
							selectedMetadata?.seasonDetails)
						: undefined,
			};

			await onSubmit(input);
		},
	});

	useEffect(() => {
		if (!metadataDetails) return;
		if (metadataDetails.title) {
			form.setFieldValue("title", metadataDetails.title);
		}
		if (metadataDetails.creator) {
			form.setFieldValue("creator", metadataDetails.creator);
		}
		if (metadataDetails.year !== undefined) {
			form.setFieldValue("year", String(metadataDetails.year));
		}
		const total = getTotalFromMetadata(metadataDetails, type);
		if (total && form.state.values.format !== "audiobook") {
			form.setFieldValue("totalProgress", String(total));
		}
	}, [metadataDetails, form, type]);

	const metadataRows = getMetadataRows(
		type,
		metadataDetails ?? selectedMetadata,
		isLoadingDetails,
	);
	const coverUrl = metadataDetails?.coverUrl ?? selectedMetadata?.coverUrl;
	const Icon = TypeIcons[type];

	return (
		<div className="space-y-4 py-2">
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onBack}
					className="shrink-0"
				>
					<ArrowLeft className="h-4 w-4" />
					<span className="sr-only">Atrás</span>
				</Button>
				<div className="flex items-center gap-2">
					<Icon className="h-5 w-5 text-muted-foreground" />
					<h2 className="text-base font-semibold">Editar obra</h2>
				</div>
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					void form.handleSubmit();
				}}
				className="space-y-4"
			>
				{selectedMetadata && (
					<div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
						<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
							Información del proveedor
						</p>
						<div className="flex items-start gap-4">
							{coverUrl ? (
								<img
									src={coverUrl}
									alt={`Portada de ${selectedMetadata.title}`}
									className="h-40 w-28 rounded-lg object-cover flex-shrink-0"
									loading="lazy"
								/>
							) : (
								<div className="h-40 w-28 rounded-lg bg-border/40 flex-shrink-0" />
							)}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 flex-1 min-w-0">
								{metadataRows.map((row) => (
									<div key={row.label} className="text-sm">
										<span className="text-muted-foreground">{row.label}:</span>{" "}
										{row.value ? (
											<span>{row.value}</span>
										) : isLoadingDetails && row.showLoading ? (
											<Skeleton className="inline-block h-3.5 w-24" />
										) : null}
									</div>
								))}
							</div>
						</div>
						{metadataDetails?.description && (
							<details className="text-sm">
								<summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
									Sinopsis
								</summary>
								<p className="mt-2 text-muted-foreground leading-relaxed">
									{metadataDetails.description}
								</p>
							</details>
						)}
					</div>
				)}

				<div className="space-y-3">
					<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
						Datos de la obra
					</p>

					<form.Field name="title">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={titleId}>Título</Label>
								<Input
									id={titleId}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Título de la obra"
								/>
							</div>
						)}
					</form.Field>

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

					<div className="grid gap-3 sm:grid-cols-2">
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
						<form.Subscribe selector={(state) => state.values.type}>
							{(formType) =>
								formType === "book" && (
									<form.Field name="format">
										{(field) => (
											<div className="space-y-2">
												<Label htmlFor={formatId}>Formato</Label>
												<Select
													value={field.state.value}
													onValueChange={(v) => {
														const nextFormat = v as ObraFormat;
														field.handleChange(nextFormat);
														const total = getTotalFromMetadata(
															metadataDetails ?? selectedMetadata,
															type,
															nextFormat,
														);
														form.setFieldValue(
															"totalProgress",
															total ? String(total) : "",
														);
													}}
												>
													<SelectTrigger id={formatId}>
														<span className="truncate">
															{bookFormats.find(
																(format) => format.value === field.state.value,
															)?.label ?? "Ebook"}
														</span>
													</SelectTrigger>
													<SelectContent>
														{bookFormats.map((format) => (
															<SelectItem
																key={format.value}
																value={format.value}
															>
																{format.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										)}
									</form.Field>
								)
							}
						</form.Subscribe>
					</div>
				</div>

				<div className="space-y-3 border-t border-border/60 pt-4">
					<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
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

					<form.Subscribe
						selector={(state) => ({
							status: state.values.status,
							type: state.values.type,
						})}
					>
						{({ status, type: formType }) => {
							if (status !== "in-progress" && status !== "finished") {
								return null;
							}

							if (formType === "movie") {
								return (
									<div className="grid gap-3 sm:grid-cols-2">
										<form.Field name="finishedAt">
											{(field) => (
												<div className="space-y-2">
													<Label htmlFor={finishedAtId}>Fecha</Label>
													<Input
														id={finishedAtId}
														type="date"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
													/>
												</div>
											)}
										</form.Field>
									</div>
								);
							}

							return (
								<div className="grid gap-3 sm:grid-cols-2">
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
													<Label htmlFor={finishedAtId}>Fecha de término</Label>
													<Input
														id={finishedAtId}
														type="date"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
													/>
												</div>
											)}
										</form.Field>
									)}
								</div>
							);
						}}
					</form.Subscribe>

					<form.Field name="recommendedBy">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={recommendedById}>Recomendado por</Label>
								<Input
									id={recommendedById}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder=""
								/>
							</div>
						)}
					</form.Field>

					<form.Subscribe selector={(state) => state.values.type}>
						{(formType) =>
							formType &&
							formType !== "movie" && (
								<form.Field name="totalProgress">
									{(field) => (
										<div className="space-y-2">
											<form.Subscribe selector={(state) => state.values.format}>
												{(format) => (
													<>
														<Label htmlFor={totalId}>
															Total {getProgressTotalLabel(formType, format)}
														</Label>
														<Input
															id={totalId}
															type="number"
															value={field.state.value}
															onChange={(e) =>
																field.handleChange(e.target.value)
															}
															placeholder={
																formType === "book" && format === "audiobook"
																	? "Ej: 750"
																	: "Ej: 320"
															}
														/>
													</>
												)}
											</form.Subscribe>
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
									placeholder="Ej: sci-fi, filosofía, drama"
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
					<Button type="button" variant="outline" onClick={onCancel}>
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
						{([title, typeValue, isSubmitting]) => (
							<Button
								type="submit"
								disabled={isSubmitting || !title.trim() || !typeValue}
							>
								Agregar
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}
