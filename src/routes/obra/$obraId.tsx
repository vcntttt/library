import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAuthToken, useConvexAuth } from "@convex-dev/auth/react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ExternalLink, Minus, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Trash2 } from "@/components/icons";
import { RecommendationBadge } from "@/components/recommendation-badge";
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
import { isMetadataOngoing, isObraUpToDate } from "@/lib/metadata/format";
import type {
	MetadataDetails,
	MetadataSearchResult,
	MetadataSource,
} from "@/lib/metadata/types";
import { obraFromDoc } from "@/lib/obras";
import { getInitialProgressTotal } from "@/lib/progress";
import type { Obra, ObraId, ObraStatus, ObraType } from "@/lib/types";
import { cn, formatDateShort } from "@/lib/utils";

interface EditableQuote {
	clientId: string;
	id?: string;
	content: string;
	characterName: string;
}

interface EditFormValues {
	readingUrl: string;
	recommendedBy: string;
	startedAt: string;
	finishedAt: string;
	review: string;
	progressCurrent: number;
	progressTotal: number;
}

const emptyEditFormValues: EditFormValues = {
	readingUrl: "",
	recommendedBy: "",
	startedAt: "",
	finishedAt: "",
	review: "",
	progressCurrent: 0,
	progressTotal: 0,
};

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
	"apple-books": "Apple Books",
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

interface DetailItem {
	label: string;
	value: string;
}

const buildMetadataPayload = (
	metadata: Pick<
		MetadataSearchResult,
		| "pages"
		| "subtitle"
		| "publisher"
		| "publishedDate"
		| "language"
		| "isbn10"
		| "isbn13"
		| "categories"
		| "description"
		| "canonicalUrl"
		| "seasons"
		| "episodes"
		| "episodesAired"
		| "nextEpisodeDate"
		| "status"
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
		subtitle: metadata.subtitle ?? undefined,
		publisher: metadata.publisher ?? undefined,
		publishedDate: metadata.publishedDate ?? undefined,
		language: metadata.language ?? undefined,
		isbn10: metadata.isbn10 ?? undefined,
		isbn13: metadata.isbn13 ?? undefined,
		categories: metadata.categories ?? undefined,
		description: metadata.description ?? undefined,
		canonicalUrl: metadata.canonicalUrl ?? undefined,
		seasons: metadata.seasons ?? undefined,
		episodes: metadata.episodes ?? undefined,
		episodesAired: metadata.episodesAired ?? undefined,
		nextEpisodeDate: metadata.nextEpisodeDate ?? undefined,
		status: metadata.status ?? undefined,
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

function getEditFormValues(obra: Obra): EditFormValues {
	return {
		readingUrl: obra.readingUrl ?? "",
		recommendedBy: obra.recommendedBy ?? "",
		startedAt: formatDateInput(
			obra.type === "movie"
				? (obra.finishedAt ?? obra.startedAt)
				: obra.startedAt,
		),
		finishedAt: formatDateInput(
			obra.type === "movie"
				? (obra.finishedAt ?? obra.startedAt)
				: obra.finishedAt,
		),
		review: obra.review ?? "",
		progressCurrent: obra.progress?.current ?? 0,
		progressTotal: getInitialProgressTotal(obra),
	};
}

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
	const { isAuthenticated, isLoading } = useConvexAuth();

	if (isLoading) {
		return <ObraPageSkeleton />;
	}

	if (!isAuthenticated) {
		return (
			<div className="mx-auto max-w-6xl px-6 py-10">
				<div className="max-w-lg border border-border bg-card p-6 space-y-3">
					<p className="text-sm text-muted-foreground">
						Inicia sesión para ver esta obra.
					</p>
					<Link
						to="/login"
						className="text-sm underline underline-offset-4 text-primary"
					>
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
			<div className="mx-auto max-w-6xl px-6 py-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
				<div className="flex items-center justify-between">
					<Skeleton className="h-5 w-20 rounded-none" />
					<Skeleton className="h-8 w-24 rounded-none" />
				</div>

				<div className="border border-border bg-card p-6 space-y-8">
					<div className="flex items-start gap-6">
						<Skeleton className="h-40 w-28 rounded-none shrink-0" />
						<div className="space-y-3 min-w-0 flex-1">
							<div className="flex gap-2">
								<Skeleton className="h-5 w-16 rounded-none" />
								<Skeleton className="h-5 w-20 rounded-none" />
							</div>
							<Skeleton className="h-10 w-3/5 rounded-none" />
							<Skeleton className="h-4 w-2/5 rounded-none" />
						</div>
					</div>

					<div className="border border-border bg-background px-5 py-4 space-y-3">
						<div className="flex items-center justify-between">
							<Skeleton className="h-4 w-24 rounded-none" />
							<Skeleton className="h-3 w-40 rounded-none" />
						</div>
						<div className="grid gap-2 sm:grid-cols-2">
							{["t1", "t2", "t3", "t4"].map((key) => (
								<Skeleton key={key} className="h-4 w-full rounded-none" />
							))}
						</div>
					</div>

					<div className="border border-border bg-card p-5 space-y-4">
						<Skeleton className="h-4 w-20 rounded-none" />
						<Skeleton className="h-6 w-32 rounded-none" />
						<div className="flex items-center gap-3">
							<Skeleton className="h-9 w-9 rounded-none" />
							<Skeleton className="h-4 flex-1 rounded-none" />
							<Skeleton className="h-9 w-9 rounded-none" />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function ObraActionBar({
	obra,
	onDelete,
	onEdit,
	onOpenReadingLink,
}: {
	obra: Obra;
	onDelete: () => Promise<void>;
	onEdit: () => void;
	onOpenReadingLink: (urlValue: string) => void;
}) {
	return (
		<div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
			<Link
				to="/biblioteca"
				className="inline-flex h-10 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
			>
				<ArrowLeft className="h-4 w-4" />
				Volver
			</Link>

			<div className="flex flex-wrap items-center gap-2">
				{obra.readingUrl && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-10 gap-2 rounded-none border-border hover:border-primary hover:text-primary"
						onClick={() => onOpenReadingLink(obra.readingUrl ?? "")}
					>
						<ExternalLink className="h-4 w-4" />
						Ir a leer
					</Button>
				)}
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-10 gap-2 rounded-none border-border hover:border-primary hover:text-primary"
					onClick={onEdit}
				>
					<Pencil className="h-4 w-4" />
					Editar
				</Button>
				<AlertDialog>
					<AlertDialogTrigger
						render={
							<Button
								variant="outline"
								size="sm"
								className="h-10 gap-2 rounded-none border-border hover:border-destructive hover:text-destructive"
							/>
						}
					>
						<Trash2 className="h-4 w-4" />
						Eliminar
					</AlertDialogTrigger>
					<AlertDialogContent className="rounded-none border-border bg-card">
						<AlertDialogHeader>
							<AlertDialogTitle className="font-serif">
								¿Eliminar obra?
							</AlertDialogTitle>
							<AlertDialogDescription>
								Esto no se puede deshacer.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel className="rounded-none border-border">
								Cancelar
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={onDelete}
								className="rounded-none bg-[#9A3B2E] hover:bg-[#9A3B2E]/90"
							>
								Eliminar
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</div>
	);
}

function ObraDetailView({
	obra,
	progressUnitLabel,
	showOngoingBadge,
	showUpToDateBadge,
	technicalItems,
}: {
	obra: Obra;
	progressUnitLabel: string;
	showOngoingBadge: boolean;
	showUpToDateBadge: boolean;
	technicalItems: DetailItem[];
}) {
	return (
		<div className="grid gap-10 lg:grid-cols-[320px_1fr]">
			<ObraCoverPanel obra={obra} progressUnitLabel={progressUnitLabel} />
			<div className="space-y-10">
				<ObraHeroInfo
					obra={obra}
					showOngoingBadge={showOngoingBadge}
					showUpToDateBadge={showUpToDateBadge}
				/>
				<TechnicalInfoSection
					items={technicalItems}
					updatedAt={obra.updatedAt}
				/>
				<PersonalNotesSection obra={obra} />
			</div>
		</div>
	);
}

function ObraCoverPanel({
	obra,
	progressUnitLabel,
}: {
	obra: Obra;
	progressUnitLabel: string;
}) {
	const showProgress = obra.type !== "movie" && obra.progress;
	const progressTotal = obra.progress?.total ?? 0;
	const progressCurrent = obra.progress?.current ?? 0;
	const progressPercent =
		progressTotal > 0
			? Math.min(100, (progressCurrent / progressTotal) * 100)
			: 0;

	return (
		<aside className="space-y-5">
			<div className="aspect-[2/3] w-full overflow-hidden border border-border bg-card">
				{obra.coverUrl ? (
					<img
						src={obra.coverUrl}
						alt={`Portada de ${obra.title}`}
						className="h-full w-full object-cover"
						loading="lazy"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
						Sin portada
					</div>
				)}
			</div>
			{showProgress && (
				<div className="space-y-2">
					<div className="flex justify-between text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
						<span>Progreso</span>
						<span>
							{progressCurrent} / {progressTotal || "—"}
						</span>
					</div>
					<div className="h-1 w-full bg-border">
						<div
							className="h-full bg-primary"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
					{progressUnitLabel && (
						<p className="text-xs text-muted-foreground">
							Avance en {progressUnitLabel}.
						</p>
					)}
				</div>
			)}
		</aside>
	);
}

function ObraHeroInfo({
	obra,
	showOngoingBadge,
	showUpToDateBadge,
}: {
	obra: Obra;
	showOngoingBadge: boolean;
	showUpToDateBadge: boolean;
}) {
	return (
		<section className="space-y-4">
			<div className="flex flex-wrap gap-2">
				<TypeBadge type={obra.type} />
				<StatusBadge status={obra.status} />
				{obra.recommendedBy && <RecommendationBadge />}
				{showOngoingBadge && (
					<Badge
						variant="outline"
						className="h-5 rounded-none border-[#4A4E69]/30 bg-[#4A4E69]/8 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-[#4A4E69] dark:text-[#8A8EA9]"
					>
						En emisión
					</Badge>
				)}
				{showUpToDateBadge && (
					<Badge
						variant="outline"
						className="h-5 rounded-none border-[#3A5A40]/30 bg-[#3A5A40]/8 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-[#3A5A40] dark:text-[#7AA080]"
					>
						Al día
					</Badge>
				)}
			</div>
			<div className="space-y-3">
				<h1 className="font-serif text-5xl leading-[1.05] tracking-tight md:text-6xl">
					{obra.title}
				</h1>
				{obra.creator && (
					<p className="text-lg text-muted-foreground">{obra.creator}</p>
				)}
				<div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
					{obra.year && <span>{obra.year}</span>}
					{obra.recommendedBy && (
						<span>Recomendada por {obra.recommendedBy}</span>
					)}
				</div>
			</div>
		</section>
	);
}

function TechnicalInfoSection({
	items,
	updatedAt,
}: {
	items: DetailItem[];
	updatedAt: number;
}) {
	return (
		<section className="border border-border bg-card px-5 py-4">
			<div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-sm font-medium">Ficha técnica</p>
				<p className="text-xs text-muted-foreground">
					Actualizado {formatDateShort(updatedAt)}
				</p>
			</div>
			{items.length > 0 ? (
				<div className="grid gap-2 sm:grid-cols-2">
					{items.map((item) => (
						<div key={item.label} className="text-sm">
							<span className="text-muted-foreground">{item.label}:</span>{" "}
							<span className="text-card-foreground">{item.value}</span>
						</div>
					))}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">Sin datos técnicos.</p>
			)}
		</section>
	);
}

function PersonalNotesSection({ obra }: { obra: Obra }) {
	const dateItems: DetailItem[] = [];
	if (obra.type === "movie") {
		const watchedAt = obra.finishedAt ?? obra.startedAt;
		if (watchedAt) {
			dateItems.push({
				label: "Fecha",
				value: formatDateShort(watchedAt),
			});
		}
	} else if (obra.startedAt) {
		dateItems.push({
			label: "Fecha de inicio",
			value: formatDateShort(obra.startedAt),
		});
	}
	if (obra.type !== "movie" && obra.finishedAt) {
		dateItems.push({
			label: "Fecha de término",
			value: formatDateShort(obra.finishedAt),
		});
	}

	return (
		<section className="space-y-8">
			{obra.review && (
				<div className="border-l-2 border-primary py-1 pl-6">
					<p className="mb-2 text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
						Reseña
					</p>
					<p className="whitespace-pre-wrap font-serif text-xl leading-relaxed text-foreground">
						{obra.review}
					</p>
				</div>
			)}
			{obra.quotes.length > 0 && (
				<div className="space-y-3">
					<p className="mb-3 text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
						Citas
					</p>
					<div className="grid gap-3 sm:grid-cols-2">
						{obra.quotes.map((quote) => (
							<figure
								key={quote.id}
								className="border border-border bg-card p-4"
							>
								<blockquote className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-foreground">
									{quote.content}
								</blockquote>
								{quote.characterName && (
									<figcaption className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
										{quote.characterName}
									</figcaption>
								)}
							</figure>
						))}
					</div>
				</div>
			)}
			{dateItems.length > 0 && (
				<div className="grid gap-3 sm:grid-cols-2">
					{dateItems.map((item) => (
						<div key={item.label} className="border-l border-border pl-4">
							<p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
								{item.label}
							</p>
							<p className="mt-1 text-sm">{item.value}</p>
						</div>
					))}
				</div>
			)}
			{obra.tags.length > 0 && (
				<div className="space-y-2">
					<p className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
						Etiquetas
					</p>
					<div className="flex flex-wrap gap-2">
						{obra.tags.map((tag) => (
							<span
								key={tag}
								className="border-b border-border pb-0.5 text-xs text-muted-foreground"
							>
								{tag}
							</span>
						))}
					</div>
				</div>
			)}
		</section>
	);
}

function ObraAuthed({
	id,
	navigate,
}: {
	id: ObraId;
	navigate: (opts: { to: string }) => void;
}) {
	const convexId = id as Id<"obras">;
	const doc = useQuery(convexApi.obras.get, { id: convexId });
	const updateObra = useMutation(convexApi.obras.update);
	const removeObra = useMutation(convexApi.obras.remove);
	const authToken = useAuthToken();
	const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
	const [isMetadataOpen, setIsMetadataOpen] = useState(false);
	const [editQuotes, setEditQuotes] = useState<EditableQuote[]>([]);
	const [metadataQuery, setMetadataQuery] = useState("");
	const [metadataResults, setMetadataResults] = useState<
		MetadataSearchResult[]
	>([]);
	const [metadataError, setMetadataError] = useState<string | null>(null);
	const [isSearchingMetadata, setIsSearchingMetadata] = useState(false);
	const [isApplyingMetadata, setIsApplyingMetadata] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
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
	const editDefaultValues = useMemo(
		() => (doc ? getEditFormValues(doc) : emptyEditFormValues),
		[doc],
	);

	const form = useForm({
		defaultValues: editDefaultValues,
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

			const movieWatchedAt =
				doc?.type === "movie"
					? (parseDateInput(value.finishedAt) ??
						parseDateInput(value.startedAt))
					: undefined;
			const patch: Record<string, unknown> = {
				readingUrl: value.readingUrl.trim() || undefined,
				recommendedBy: value.recommendedBy.trim(),
				startedAt:
					doc?.type === "movie"
						? movieWatchedAt
						: parseDateInput(value.startedAt),
				finishedAt:
					doc?.type === "movie"
						? movieWatchedAt
						: parseDateInput(value.finishedAt),
				review: value.review.trim() || undefined,
				quotes: editQuotes
					.map((quote) => ({
						id: quote.id,
						content: quote.content.trim(),
						characterName: quote.characterName.trim() || undefined,
					}))
					.filter((quote) => quote.content),
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

			await updateObra({ id: convexId, patch });
			setIsEditOpen(false);
		},
	});

	const resetEditFormFromDoc = useCallback(
		(nextDoc: Obra) => {
			form.reset(getEditFormValues(nextDoc));
			setEditQuotes(
				nextDoc.quotes.map((quote) => ({
					clientId: quote.id,
					id: quote.id,
					content: quote.content,
					characterName: quote.characterName ?? "",
				})),
			);
		},
		[form],
	);

	useEffect(() => {
		if (!doc) {
			return;
		}
		resetEditFormFromDoc(doc);
	}, [doc, resetEditFormFromDoc]);

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
			<div className="mx-auto max-w-6xl px-6 py-10">
				<div className="max-w-lg border border-border bg-card p-6 space-y-3">
					<p className="text-sm text-muted-foreground">Obra no encontrada.</p>
					<Link
						to="/biblioteca"
						className="text-sm underline underline-offset-3 text-primary"
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
	const metadataSource =
		obra.external?.source ?? metadataSourceByType[obra.type];
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
		if (obra.type === "book" && metadata.publisher) {
			metadataItems.push({
				label: "Editorial",
				value: metadata.publisher,
			});
		}
		if (obra.type === "book" && (metadata.isbn13 || metadata.isbn10)) {
			metadataItems.push({
				label: "ISBN",
				value: metadata.isbn13 ?? metadata.isbn10 ?? "",
			});
		}
		if (obra.type === "book" && metadata.language) {
			metadataItems.push({
				label: "Idioma",
				value: metadata.language,
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
				value: formatDateShort(metadata.nextEpisodeDate),
			});
		}
		if (obra.type === "manga" && metadata.latestChapter) {
			metadataItems.push({
				label: "Capítulos totales",
				value: metadata.latestChapter.toLocaleString(),
			});
		}
		if (obra.type === "manga" && metadata.latestChapterCheckedAt) {
			metadataItems.push({
				label: "Última verificación",
				value: formatDateShort(metadata.latestChapterCheckedAt),
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
		await updateObra({ id: convexId, patch: { status } });
	};

	const handleDelete = async () => {
		await removeObra({ id: convexId });
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
			await updateObra({ id: convexId, patch });
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
				{
					headers: authToken
						? { authorization: `Bearer ${authToken}` }
						: undefined,
				},
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
				{
					headers: authToken
						? { authorization: `Bearer ${authToken}` }
						: undefined,
				},
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

			await updateObra({ id: convexId, patch });
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
		? previewMetadata.latestChapter
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
				typeof previewMetadata.pages === "number"
					? previewMetadata.pages.toLocaleString()
					: undefined,
			showLoading: obra.type === "book",
		});
		previewRows.push({
			label: "Editorial",
			value: previewMetadata.publisher,
			showLoading: obra.type === "book",
		});
		previewRows.push({
			label: "ISBN",
			value: previewMetadata.isbn13 ?? previewMetadata.isbn10,
			showLoading: obra.type === "book",
		});
		previewRows.push({
			label: "Idioma",
			value: previewMetadata.language,
			showLoading: obra.type === "book",
		});
		previewRows.push({
			label: "Temporadas",
			value:
				typeof previewMetadata.seasons === "number"
					? previewMetadata.seasons.toLocaleString()
					: undefined,
			showLoading: obra.type === "series",
		});
		previewRows.push({
			label: "Episodios",
			value:
				typeof previewMetadata.episodes === "number"
					? previewMetadata.episodes.toLocaleString()
					: undefined,
			showLoading: obra.type === "series" || obra.type === "anime",
		});
		previewRows.push({
			label: "Episodios emitidos",
			value:
				typeof previewMetadata.episodesAired === "number"
					? previewMetadata.episodesAired.toLocaleString()
					: undefined,
			showLoading: obra.type === "series" || obra.type === "anime",
		});
		previewRows.push({
			label: "Próximo episodio",
			value:
				typeof previewMetadata.nextEpisodeDate === "number"
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
				typeof mangaChapterPreview === "number"
					? mangaChapterPreview.toLocaleString()
					: undefined,
			showLoading: obra.type === "manga",
		});
		previewRows.push({
			label: "Volúmenes",
			value:
				typeof previewMetadata.volumes === "number"
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

	const handleOpenEdit = () => {
		resetEditFormFromDoc(obra);
		setIsEditOpen(true);
	};

	const handleEditOpenChange = (open: boolean) => {
		if (open) {
			resetEditFormFromDoc(obra);
		}
		setIsEditOpen(open);
	};

	const handleAddQuote = () => {
		setEditQuotes((quotes) => [
			...quotes,
			{
				clientId: `new-${crypto.randomUUID()}`,
				content: "",
				characterName: "",
			},
		]);
	};

	const handleRemoveQuote = (clientId: string) => {
		setEditQuotes((quotes) =>
			quotes.filter((quote) => quote.clientId !== clientId),
		);
	};

	const handleQuoteChange = (
		clientId: string,
		field: "content" | "characterName",
		value: string,
	) => {
		setEditQuotes((quotes) =>
			quotes.map((quote) =>
				quote.clientId === clientId ? { ...quote, [field]: value } : quote,
			),
		);
	};

	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="mx-auto max-w-6xl px-6 py-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
				<ObraActionBar
					obra={obra}
					onDelete={handleDelete}
					onEdit={handleOpenEdit}
					onOpenReadingLink={handleOpenReadingLink}
				/>

				<ObraDetailView
					obra={obra}
					progressUnitLabel={progressUnitLabel}
					showOngoingBadge={showOngoingBadge}
					showUpToDateBadge={showUpToDateBadge}
					technicalItems={technicalItems}
				/>

				<Dialog open={isEditOpen} onOpenChange={handleEditOpenChange}>
					<DialogContent className="left-auto right-0 top-0 h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-y-0 border-r-0 border-l-border bg-card p-0 sm:max-w-xl lg:max-w-2xl">
						<DialogHeader className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4">
							<DialogTitle className="font-serif text-xl">
								Editar obra
							</DialogTitle>
							<DialogDescription>
								Actualiza progreso, estado, metadatos, reseña y citas.
							</DialogDescription>
						</DialogHeader>
						<div className="px-5 py-5">
							<form
								onSubmit={(e) => {
									e.preventDefault();
									e.stopPropagation();
									void form.handleSubmit();
								}}
								className="space-y-8"
							>
								{hasProgress && (
									<section className="border border-border bg-card p-5 space-y-4">
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
														const isDisabled =
															isUpdatingProgress || safeTotal <= 0;

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
																		className="rounded-none border-border hover:border-primary hover:text-primary"
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
																		className="rounded-none border-border hover:border-primary hover:text-primary"
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
																{obra.type === "manga" && (
																	<p className="text-xs text-muted-foreground">
																		En manga, avanza por capítulos y marca
																		terminada al llegar al total.
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
																						Number.isNaN(nextValue)
																							? 0
																							: nextValue,
																					);
																				}}
																				className="max-w-[140px] rounded-none border-border bg-background focus-visible:ring-primary"
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
																disabled={
																	isUpdatingProgress || progressTotal <= 0
																}
																className="rounded-none border-border hover:border-primary hover:text-primary"
																onClick={() =>
																	handleQuickProgressUpdate(
																		progressTotal,
																		progressTotal,
																	)
																}
															>
																Al día
															</Button>
															<Button
																type="button"
																size="sm"
																disabled={
																	isUpdatingProgress ||
																	progressTotal <= 0 ||
																	obra.status === "finished"
																}
																className="rounded-none bg-primary hover:bg-primary/90 text-background"
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
															<p className="text-sm text-[#9A3B2E]">
																El progreso no puede superar el total.
															</p>
														);
													}}
												</form.Subscribe>
											</div>
										</div>
									</section>
								)}
								<section className="border border-border bg-card p-5 space-y-4">
									<p className="text-sm font-medium">Metadatos</p>
									<div className="space-y-2">
										<Label>Metadatos</Label>
										<Dialog
											open={isMetadataOpen}
											onOpenChange={handleMetadataOpenChange}
										>
											<DialogTrigger
												render={
													<Button
														variant="outline"
														size="sm"
														className="rounded-none border-[#D6D0C7] hover:border-[#B85C38] hover:text-[#B85C38]"
													/>
												}
											>
												Buscar metadatos
											</DialogTrigger>
											<DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-lg border-border bg-card p-0 sm:max-w-2xl">
												<DialogHeader>
													<div className="border-b border-border px-5 py-4">
														<DialogTitle className="text-lg font-semibold font-serif">
															Buscar metadatos
														</DialogTitle>
														<DialogDescription className="mt-1">
															Proveedor: {metadataSourceLabel}
														</DialogDescription>
													</div>
												</DialogHeader>
												<div className="flex min-h-0 flex-1 flex-col gap-4 px-5 pb-5">
													<div className="flex flex-col gap-2 sm:flex-row">
														<Input
															value={metadataQuery}
															onChange={(e) => setMetadataQuery(e.target.value)}
															placeholder={`Buscar en ${metadataSourceLabel}`}
															className="h-11 rounded-md border-border bg-background focus-visible:ring-primary"
														/>
														<Button
															type="button"
															disabled={!canSearchMetadata}
															onClick={handleMetadataSearch}
															className="h-11 rounded-md px-5"
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
															<p className="rounded-md border border-dashed border-border bg-background/50 px-4 py-6 text-center text-sm text-muted-foreground">
																Ingresa un término para buscar.
															</p>
														)}
													{metadataResults.length > 0 && (
														<div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
															{metadataResults.map((result) => {
																const details = [
																	result.creator,
																	result.year?.toString(),
																	result.pages
																		? `${result.pages.toLocaleString()} páginas`
																		: undefined,
																]
																	.filter(Boolean)
																	.join(" • ");
																const sourceLabel =
																	metadataSourceLabels[result.source];

																return (
																	<div
																		key={`${result.source}-${result.id}`}
																		className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-md border border-border bg-background/70 p-3 transition-colors hover:border-primary/60 hover:bg-background sm:grid-cols-[48px_minmax(0,1fr)_120px]"
																	>
																		<div className="h-16 w-12 overflow-hidden rounded-sm border border-border bg-muted">
																			{result.coverUrl ? (
																				<img
																					src={result.coverUrl}
																					alt={`Portada de ${result.title}`}
																					className="h-full w-full object-cover"
																					loading="lazy"
																				/>
																			) : null}
																		</div>
																		<div className="min-w-0 space-y-1">
																			<div className="flex flex-wrap items-center gap-2">
																				<p className="min-w-0 truncate text-sm font-medium">
																					{result.title}
																				</p>
																				<Badge
																					variant="outline"
																					className="shrink-0 rounded-sm border-border text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
																				>
																					{sourceLabel}
																				</Badge>
																			</div>
																			{details && (
																				<p className="truncate text-xs text-muted-foreground">
																					{details}
																				</p>
																			)}
																		</div>
																		<Button
																			type="button"
																			variant="outline"
																			size="sm"
																			disabled={isLoadingPreviewDetails}
																			onClick={() =>
																				handleOpenMetadataPreview(result)
																			}
																			className="col-span-2 rounded-md sm:col-span-1 sm:w-full"
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
														<DialogContent className="sm:max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg border-border bg-card">
															<DialogHeader>
																<DialogTitle className="font-serif">
																	Vista previa de metadatos
																</DialogTitle>
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
																				className="h-44 w-32 rounded-md border border-border object-cover"
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
																					<pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs">
																						{`GET ${lastMetadataSearchUrl ?? requestDebugSearch}`}
																					</pre>
																				)}
																				{requestDebugDetails && (
																					<pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs">
																						{`GET ${requestDebugDetails}`}
																					</pre>
																				)}
																				{previewResult?.source ===
																					"anilist" && (
																					<pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-xs">
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
																			<pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-xs">
																				{JSON.stringify(
																					previewMetadata,
																					null,
																					2,
																				)}
																			</pre>
																		</details>
																	</>
																)}
															</div>
															<DialogFooter>
																<Button
																	type="button"
																	variant="outline"
																	onClick={() =>
																		setIsMetadataPreviewOpen(false)
																	}
																	className="rounded-md"
																>
																	Cerrar
																</Button>
																<Button
																	type="button"
																	disabled={
																		!previewResult || isApplyingMetadata
																	}
																	onClick={handleApplyMetadata}
																	className="rounded-md"
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
														className="rounded-md"
													>
														Cerrar
													</Button>
												</DialogFooter>
											</DialogContent>
										</Dialog>
										<p className="text-xs text-[#8C8279]">
											Proveedor recomendado: {metadataSourceLabel}.
										</p>
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
														className="flex-1 rounded-none border-[#D6D0C7] bg-[#F5F2EB] focus-visible:ring-[#B85C38]"
													/>
												)}
											</form.Field>
											<form.Subscribe
												selector={(state) => state.values.readingUrl}
											>
												{(readingUrl) => (
													<Button
														type="button"
														variant="outline"
														disabled={!readingUrl.trim()}
														onClick={() => handleOpenReadingLink(readingUrl)}
														className="rounded-none border-[#D6D0C7] hover:border-[#B85C38] hover:text-[#B85C38]"
													>
														Ir a leer
													</Button>
												)}
											</form.Subscribe>
										</div>
										<p className="text-xs text-[#8C8279]">
											Guarda tu link personal del sitio donde lees los
											capítulos.
										</p>
									</div>
								</section>
								<section className="border border-border bg-card p-5 space-y-4">
									<p className="text-sm font-medium">Estado y fechas</p>
									<div className="space-y-2">
										<Label>Estado</Label>
										<Select
											value={obra.status}
											onValueChange={(v) => handleStatusChange(v as ObraStatus)}
										>
											<SelectTrigger className="rounded-none border-[#D6D0C7] bg-[#F5F2EB] focus:ring-[#B85C38]">
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
										<div className="space-y-2 sm:col-span-2">
											<Label>Recomendado por</Label>
											<form.Field name="recommendedBy">
												{(field) => (
													<Input
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														placeholder=""
														className="rounded-none border-[#D6D0C7] bg-[#F5F2EB] focus-visible:ring-[#B85C38]"
													/>
												)}
											</form.Field>
										</div>
										{obra.type === "movie" ? (
											<div className="space-y-2">
												<Label>Fecha</Label>
												<form.Field name="finishedAt">
													{(field) => (
														<Input
															type="date"
															value={field.state.value}
															onChange={(e) =>
																field.handleChange(e.target.value)
															}
															className="rounded-none border-[#D6D0C7] bg-[#F5F2EB] focus-visible:ring-[#B85C38]"
														/>
													)}
												</form.Field>
											</div>
										) : (
											<>
												<div className="space-y-2">
													<Label>Fecha de inicio</Label>
													<form.Field name="startedAt">
														{(field) => (
															<Input
																type="date"
																value={field.state.value}
																onChange={(e) =>
																	field.handleChange(e.target.value)
																}
																className="rounded-none border-[#D6D0C7] bg-[#F5F2EB] focus-visible:ring-[#B85C38]"
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
																onChange={(e) =>
																	field.handleChange(e.target.value)
																}
																className="rounded-none border-[#D6D0C7] bg-[#F5F2EB] focus-visible:ring-[#B85C38]"
															/>
														)}
													</form.Field>
												</div>
											</>
										)}
									</div>
								</section>

								<section className="border border-border bg-card p-5 space-y-4">
									<p className="text-sm font-medium">Reseña y citas</p>
									<div className="space-y-5">
										<div className="space-y-2">
											<Label>Reseña</Label>
											<form.Field name="review">
												{(field) => (
													<Textarea
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														placeholder="Escribe tu reseña..."
														rows={10}
														className="rounded-none border-[#D6D0C7] bg-[#F5F2EB] focus-visible:ring-[#B85C38]"
													/>
												)}
											</form.Field>
										</div>

										<div className="space-y-3">
											<div className="flex items-center justify-between gap-3">
												<Label>Citas</Label>
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={handleAddQuote}
													className="rounded-none border-border hover:border-primary hover:text-primary"
												>
													<Plus className="mr-2 h-4 w-4" />
													Agregar cita
												</Button>
											</div>
											{editQuotes.length === 0 ? (
												<div className="border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
													Todavía no hay citas para esta obra.
												</div>
											) : (
												<div className="space-y-3">
													{editQuotes.map((quote) => (
														<div
															key={quote.clientId}
															className="space-y-3 border border-border bg-muted/30 p-3"
														>
															<div className="flex items-start gap-2">
																<Textarea
																	value={quote.content}
																	onChange={(e) =>
																		handleQuoteChange(
																			quote.clientId,
																			"content",
																			e.target.value,
																		)
																	}
																	placeholder="Cita"
																	rows={3}
																	className="min-h-24 rounded-none border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
																/>
																<Button
																	type="button"
																	variant="ghost"
																	size="icon"
																	aria-label="Eliminar cita"
																	onClick={() =>
																		handleRemoveQuote(quote.clientId)
																	}
																	className="shrink-0 rounded-none text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
																>
																	<Trash2 className="h-4 w-4" />
																</Button>
															</div>
															<Input
																value={quote.characterName}
																onChange={(e) =>
																	handleQuoteChange(
																		quote.clientId,
																		"characterName",
																		e.target.value,
																	)
																}
																placeholder="Personaje"
																className="rounded-none border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
															/>
														</div>
													))}
												</div>
											)}
										</div>
									</div>
								</section>

								<div className="sticky bottom-0 -mx-5 flex justify-end border-t border-border bg-card px-5 py-4">
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
												!hasProgress ||
												(Number.isFinite(progressCurrent) &&
													Number.isFinite(progressTotal) &&
													progressTotal >= 0 &&
													progressCurrent >= 0 &&
													(progressTotal === 0 ||
														progressCurrent <= progressTotal));

											return (
												<Button
													type="submit"
													disabled={isSubmitting || !canSaveProgress}
													className={cn(
														"rounded-none bg-[#1A1A1A] text-[#F5F2EB] hover:bg-[#1A1A1A]/90",
														!canSaveProgress && "pointer-events-none",
													)}
												>
													{isSubmitting ? "Guardando..." : "Guardar cambios"}
												</Button>
											);
										}}
									</form.Subscribe>
								</div>
							</form>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
