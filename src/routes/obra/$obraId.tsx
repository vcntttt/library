import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Minus, Plus } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "@/lib/api/client";
import { api } from "@/lib/api/definitions";
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
		| "latestChapter"
		| "latestChapterSource"
		| "latestChapterCheckedAt"
		| "mangaPlusTitleId"
		| "mangaDexId"
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
		latestChapter: metadata.latestChapter ?? undefined,
		latestChapterSource: metadata.latestChapterSource ?? undefined,
		latestChapterCheckedAt: metadata.latestChapterCheckedAt ?? undefined,
		mangaPlusTitleId: metadata.mangaPlusTitleId ?? undefined,
		mangaDexId: metadata.mangaDexId ?? undefined,
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

const normalizeReadingUrl = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
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
		return <ObraPageSkeleton />;
	}

	if (session === null) {
		return (
			<div className="container mx-auto p-4 md:p-6">
				<div className="max-w-lg rounded-xl border border-border/60 bg-card/70 p-5 shadow-sm space-y-3">
					<p className="text-sm text-muted-foreground">
						Inicia sesión para ver esta obra.
					</p>
					<Link to="/login" className="text-sm underline underline-offset-4">
						Ir a login
					</Link>
				</div>
			</div>
		);
	}

	return <ObraAuthed id={id} navigate={navigate} />;
}

function ObraPageSkeleton() {
	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="container mx-auto space-y-6 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
				<div className="flex items-center justify-between">
					<Skeleton className="h-5 w-20" />
					<Skeleton className="h-8 w-24 rounded-md" />
				</div>

				<div className="rounded-xl border border-border/60 bg-card/70 p-4 md:p-6 shadow-sm space-y-6">
					<div className="flex items-start gap-4">
						<Skeleton className="h-28 w-20 rounded-md" />
						<div className="space-y-2 min-w-0 flex-1">
							<div className="flex gap-2">
								<Skeleton className="h-5 w-16 rounded-full" />
								<Skeleton className="h-5 w-20 rounded-full" />
							</div>
							<Skeleton className="h-8 w-3/5" />
							<Skeleton className="h-4 w-2/5" />
						</div>
					</div>

					<div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-3">
						<div className="flex items-center justify-between">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-3 w-40" />
						</div>
						<div className="grid gap-2 sm:grid-cols-2">
							{["t1", "t2", "t3", "t4"].map((key) => (
								<Skeleton key={key} className="h-4 w-full" />
							))}
						</div>
					</div>

					<div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-4">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-6 w-32" />
						<div className="flex items-center gap-3">
							<Skeleton className="h-9 w-9 rounded-md" />
							<Skeleton className="h-4 flex-1" />
							<Skeleton className="h-9 w-9 rounded-md" />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
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
	const [lastMetadataSearchUrl, setLastMetadataSearchUrl] = useState<
		string | null
	>(null);
	const [isMetadataPreviewOpen, setIsMetadataPreviewOpen] = useState(false);
	const [previewResult, setPreviewResult] =
		useState<MetadataSearchResult | null>(null);
	const [previewDetails, setPreviewDetails] = useState<MetadataDetails | null>(
		null,
	);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [isLoadingPreviewDetails, setIsLoadingPreviewDetails] = useState(false);
	const progressCommitTimeout = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	const form = useForm({
		defaultValues: {
			obsidianPath: "",
			readingUrl: "",
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
				readingUrl: value.readingUrl.trim() || undefined,
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
			readingUrl: doc.readingUrl ?? "",
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
		return <ObraPageSkeleton />;
	}

	if (doc === null) {
		return (
			<div className="container mx-auto p-4 md:p-6">
				<div className="max-w-lg rounded-xl border border-border/60 bg-card/70 p-5 shadow-sm space-y-3">
					<p className="text-sm text-muted-foreground">Obra no encontrada.</p>
					<Link
						to="/biblioteca"
						className="text-sm underline underline-offset-3"
					>
						Volver a la biblioteca
					</Link>
				</div>
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
		if (
			obra.type === "manga" &&
			(metadata.latestChapter || metadata.chapters)
		) {
			metadataItems.push({
				label: "Último capítulo",
				value: (
					metadata.latestChapter ??
					metadata.chapters ??
					0
				).toLocaleString(),
			});
		}
		if (
			obra.type === "manga" &&
			metadata.latestChapter !== undefined &&
			metadata.chapters !== undefined &&
			metadata.chapters !== metadata.latestChapter
		) {
			metadataItems.push({
				label: "Capítulos totales",
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

	const handleStepProgressChange = (nextCurrent: number, nextTotal: number) => {
		if (!Number.isFinite(nextTotal) || nextTotal <= 0) return;
		const safeCurrent = Math.min(Math.max(nextCurrent, 0), nextTotal);
		form.setFieldValue("progressCurrent", safeCurrent);
		scheduleProgressCommit(safeCurrent, nextTotal);
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

	const handleOpenReadingLink = (urlValue: string) => {
		const nextUrl = normalizeReadingUrl(urlValue);
		if (!nextUrl) return;
		window.open(nextUrl, "_blank", "noopener,noreferrer");
	};

	const handleMetadataOpenChange = (nextOpen: boolean) => {
		setIsMetadataOpen(nextOpen);
		if (!nextOpen) {
			setIsMetadataPreviewOpen(false);
			setPreviewResult(null);
			setPreviewDetails(null);
			setPreviewError(null);
		}
		if (nextOpen) {
			setMetadataError(null);
			setMetadataResults([]);
			setMetadataQuery((current) => (current.trim() ? current : obra.title));
			setPreviewError(null);
			setPreviewResult(null);
			setPreviewDetails(null);
			setIsMetadataPreviewOpen(false);
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
			setMetadataError(
				error instanceof Error ? error.message : "No se pudo buscar metadatos.",
			);
		} finally {
			setIsSearchingMetadata(false);
		}
	};

	const handleOpenMetadataPreview = async (result: MetadataSearchResult) => {
		if (isLoadingPreviewDetails) return;

		setIsMetadataPreviewOpen(true);
		setPreviewResult(result);
		setPreviewDetails(null);
		setPreviewError(null);
		setIsLoadingPreviewDetails(true);
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
				setPreviewDetails(
					(payload?.details as MetadataDetails | undefined) ?? null,
				);
			} else {
				const payload = await detailsResponse.json().catch(() => ({}));
				const message =
					payload && typeof payload.error === "string"
						? payload.error
						: "No se pudo cargar metadatos.";
				setPreviewError(message);
				console.error("[metadata/details] request failed", {
					status: detailsResponse.status,
					statusText: detailsResponse.statusText,
					payload,
					url: detailsResponse.url,
				});
			}
		} catch (error) {
			setPreviewError(
				error instanceof Error ? error.message : "No se pudo cargar metadatos.",
			);
		} finally {
			setIsLoadingPreviewDetails(false);
		}
	};

	const handleApplyMetadata = async () => {
		if (isApplyingMetadata || !previewResult) return;

		setIsApplyingMetadata(true);
		setMetadataError(null);
		try {
			const patch: Record<string, unknown> = {
				title: previewDetails?.title ?? previewResult.title,
				external: {
					source: previewResult.source,
					id: previewResult.id,
				},
			};
			const creator = previewDetails?.creator ?? previewResult.creator;
			const year = previewDetails?.year ?? previewResult.year;
			const coverUrl = previewDetails?.coverUrl ?? previewResult.coverUrl;
			const metadataPayload = buildMetadataPayload(
				previewDetails ?? previewResult,
			);
			if (creator) patch.creator = creator;
			if (year) patch.year = year;
			if (coverUrl) patch.coverUrl = coverUrl;
			if (metadataPayload) patch.metadata = metadataPayload;

			await updateObra({ id, patch });
			setIsMetadataPreviewOpen(false);
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
			showLoading: obra.type === "book",
		});
		previewRows.push({
			label: "Temporadas",
			value:
				previewMetadata.seasons !== undefined
					? previewMetadata.seasons.toLocaleString()
					: undefined,
			showLoading: obra.type === "series",
		});
		previewRows.push({
			label: "Episodios",
			value:
				previewMetadata.episodes !== undefined
					? previewMetadata.episodes.toLocaleString()
					: undefined,
			showLoading: obra.type === "series" || obra.type === "anime",
		});
		previewRows.push({
			label: "Episodios emitidos",
			value:
				previewMetadata.episodesAired !== undefined
					? previewMetadata.episodesAired.toLocaleString()
					: undefined,
			showLoading: obra.type === "series" || obra.type === "anime",
		});
		previewRows.push({
			label: "Próximo episodio",
			value:
				previewMetadata.nextEpisodeDate !== undefined
					? new Date(previewMetadata.nextEpisodeDate).toLocaleString()
					: undefined,
			showLoading: obra.type === "series" || obra.type === "anime",
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
			showLoading: obra.type === "manga",
		});
		previewRows.push({
			label: "Volúmenes",
			value:
				previewMetadata.volumes !== undefined
					? previewMetadata.volumes.toLocaleString()
					: undefined,
			showLoading: obra.type === "manga",
		});
		previewRows.push({
			label: "Temporada (raw)",
			value: previewMetadata.season,
			showLoading: obra.type === "anime",
		});
		previewRows.push({
			label: "Año de temporada",
			value:
				previewMetadata.seasonYear !== undefined
					? String(previewMetadata.seasonYear)
					: undefined,
			showLoading: obra.type === "anime",
		});
		previewRows.push({
			label: "Duración",
			value:
				previewMetadata.runtime !== undefined
					? `${previewMetadata.runtime} min`
					: undefined,
			showLoading: obra.type === "movie",
		});
		previewRows.push({
			label: "Plataformas",
			value: previewMetadata.watchProviders?.length
				? previewMetadata.watchProviders.join(", ")
				: undefined,
			showLoading: obra.type === "movie",
		});
	}

	const requestDebugSearch =
		metadataQuery.trim().length > 0
			? `/api/metadata/search?type=${encodeURIComponent(obra.type)}&q=${encodeURIComponent(metadataQuery.trim())}`
			: null;
	const requestDebugDetails = previewResult
		? `/api/metadata/details?source=${encodeURIComponent(previewResult.source)}&id=${encodeURIComponent(previewResult.id)}&type=${encodeURIComponent(obra.type)}`
		: null;

	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="container mx-auto space-y-6 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<Link
						to="/biblioteca"
						className="inline-flex h-10 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4" />
						Volver
					</Link>

					<div className="flex items-center gap-2">
						{obra.readingUrl && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-10 gap-2"
								onClick={() => handleOpenReadingLink(obra.readingUrl ?? "")}
							>
								<ExternalLink className="h-4 w-4" />
								Ir a leer
							</Button>
						)}
						<AlertDialog>
							<AlertDialogTrigger
								render={
									<Button variant="outline" size="sm" className="h-10 gap-2" />
								}
							>
								<Trash2 className="h-4 w-4" />
								Eliminar
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>¿Eliminar obra?</AlertDialogTitle>
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
				</div>

				<div className="rounded-xl border border-border/60 bg-card/70 p-4 md:p-6 shadow-sm space-y-6">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start">
						<div className="flex items-start gap-4 min-w-0">
							{obra.coverUrl && (
								<div className="h-28 w-20 overflow-hidden rounded-md bg-muted/60">
									<img
										src={obra.coverUrl}
										alt={`Portada de ${obra.title}`}
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

					<div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
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
							<section className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-4">
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
																	handleStepProgressChange(
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
																	if (
																		safeTotal > 0 &&
																		nextValue !== undefined
																	) {
																		handleStepProgressChange(
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
																	handleStepProgressChange(
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
						<section className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-4">
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
									<DialogContent className="sm:max-w-lg rounded-xl">
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
																className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-2"
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
																	disabled={isLoadingPreviewDetails}
																	onClick={() =>
																		handleOpenMetadataPreview(result)
																	}
																>
																	Vista previa
																</Button>
															</div>
														);
													})}
												</div>
											)}
											<Dialog
												open={isMetadataPreviewOpen}
												onOpenChange={setIsMetadataPreviewOpen}
											>
												<DialogContent className="sm:max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl">
													<DialogHeader>
														<DialogTitle>Vista previa de metadatos</DialogTitle>
														<DialogDescription>
															Revisa toda la metadata disponible antes de
															aplicarla.
														</DialogDescription>
													</DialogHeader>
													<div className="space-y-4">
														{isLoadingPreviewDetails && (
															<p className="text-sm text-muted-foreground">
																Cargando detalles...
															</p>
														)}
														{previewError && (
															<p className="text-sm text-destructive">
																{previewError}
															</p>
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
																				(isLoadingPreviewDetails &&
																					row.showLoading),
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
																				) : isLoadingPreviewDetails &&
																					row.showLoading ? (
																					<span className="inline-block h-3.5 w-28 animate-pulse rounded bg-muted-foreground/25 align-middle" />
																				) : null}
																			</div>
																		))}
																</div>
																{!isLoadingPreviewDetails &&
																	obra.type === "manga" &&
																	mangaChapterPreview === undefined && (
																		<p className="text-sm text-muted-foreground">
																			Último capítulo: No disponible en el
																			proveedor.
																		</p>
																	)}
																<details>
																	<summary className="cursor-pointer text-sm text-muted-foreground">
																		Request debug
																	</summary>
																	<div className="mt-2 space-y-2">
																		{(lastMetadataSearchUrl ||
																			requestDebugSearch) && (
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
																						variables: {
																							id: Number(previewResult.id),
																						},
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
															disabled={!previewResult || isApplyingMetadata}
															onClick={handleApplyMetadata}
														>
															{isApplyingMetadata
																? "Aplicando..."
																: "Usar metadatos"}
														</Button>
													</DialogFooter>
												</DialogContent>
											</Dialog>
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
							<div className="space-y-2">
								<Label>Lectura personal</Label>
								<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
									<form.Field name="readingUrl">
										{(field) => (
											<Input
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="https://cubari.moe/..."
												className="flex-1"
											/>
										)}
									</form.Field>
									<form.Subscribe selector={(state) => state.values.readingUrl}>
										{(readingUrl) => (
											<Button
												type="button"
												variant="outline"
												disabled={!readingUrl.trim()}
												onClick={() => handleOpenReadingLink(readingUrl)}
											>
												Ir a leer
											</Button>
										)}
									</form.Subscribe>
								</div>
								<p className="text-xs text-muted-foreground">
									Guarda tu link personal del sitio donde lees los capítulos.
								</p>
							</div>
						</section>
						<section className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-4">
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

						<section className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-4">
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
