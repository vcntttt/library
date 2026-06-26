import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useConvexAuth } from "@convex-dev/auth/react";
import {
	createFileRoute,
	Link,
	useCanGoBack,
	useRouter,
} from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ExternalLink, Pencil } from "lucide-react";
import { useState } from "react";
import { ArrowLeft, Trash2 } from "@/components/icons";
import { ObraEditSheet } from "@/components/obra-edit-sheet";
import { ObraStatusPicker } from "@/components/obra-status-picker";
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
import { Skeleton } from "@/components/ui/skeleton";
import { isMetadataOngoing, isObraUpToDate } from "@/lib/metadata/format";
import type { MangaChapterSource, MetadataSource } from "@/lib/metadata/types";
import { obraFromDoc } from "@/lib/obras";
import type { Obra, ObraId, ObraType } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";

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
	manhwaweb: "ManhwaWeb",
};

const mangaChapterSourceLabels: Record<MangaChapterSource, string> = {
	"manga-plus": "MANGA Plus",
	mangadex: "MangaDex",
	anilist: "AniList",
	manhwaweb: "ManhwaWeb",
	scraping: "Scraping",
};

const metadataSourceByType: Record<ObraType, MetadataSource> = {
	book: "google-books",
	movie: "tmdb",
	series: "tmdb",
	anime: "anilist",
	manga: "anilist",
	manhwa: "manhwaweb",
};

const progressUnitLabels: Record<ObraType, string> = {
	book: "páginas",
	movie: "",
	series: "episodios",
	anime: "episodios",
	manga: "capítulos",
	manhwa: "capítulos",
};

interface DetailItem {
	label: string;
	value: string;
}

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
			<ObraBackButton />

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

function ObraBackButton() {
	const router = useRouter();
	const navigate = Route.useNavigate();
	const canGoBack = useCanGoBack();

	const handleBack = () => {
		if (canGoBack) {
			router.history.back();
			return;
		}

		navigate({ to: "/biblioteca" });
	};

	return (
		<button
			type="button"
			className="inline-flex h-10 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
			onClick={handleBack}
		>
			<ArrowLeft className="h-4 w-4" />
			Volver
		</button>
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
	const shouldKeepTechnicalWithCover =
		Boolean(obra.review) || obra.quotes.length > 0 || obra.tags.length > 0;

	return (
		<div className="grid gap-10 lg:grid-cols-[320px_1fr]">
			<ObraCoverPanel
				obra={obra}
				progressUnitLabel={progressUnitLabel}
				technicalItems={
					shouldKeepTechnicalWithCover ? technicalItems : undefined
				}
			/>
			<div className="space-y-10">
				<ObraHeroInfo
					obra={obra}
					showOngoingBadge={showOngoingBadge}
					showUpToDateBadge={showUpToDateBadge}
				/>
				{!shouldKeepTechnicalWithCover && (
					<TechnicalInfoSection
						items={technicalItems}
						updatedAt={obra.updatedAt}
						layout="wide"
					/>
				)}
				<PersonalNotesSection obra={obra} />
			</div>
		</div>
	);
}

function ObraCoverPanel({
	obra,
	progressUnitLabel,
	technicalItems,
}: {
	obra: Obra;
	progressUnitLabel: string;
	technicalItems?: DetailItem[];
}) {
	const showProgress =
		obra.type !== "movie" && obra.status !== "backlog" && obra.progress;
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
			{technicalItems && (
				<TechnicalInfoSection
					items={technicalItems}
					updatedAt={obra.updatedAt}
					layout="compact"
				/>
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
				<ObraStatusPicker obra={obra}>
					<StatusBadge
						status={obra.status}
						className="cursor-pointer hover:opacity-80 transition-opacity"
					/>
				</ObraStatusPicker>
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
	layout = "compact",
}: {
	items: DetailItem[];
	updatedAt: number;
	layout?: "compact" | "wide";
}) {
	return (
		<section className="border border-border bg-card px-5 py-4">
			<div
				className={
					layout === "wide"
						? "mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
						: "mb-3 flex flex-col gap-1"
				}
			>
				<p className="text-sm font-medium">Ficha técnica</p>
				<p className="text-xs text-muted-foreground">
					Actualizado {formatDateShort(updatedAt)}
				</p>
			</div>
			{items.length > 0 ? (
				<div
					className={
						layout === "wide" ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"
					}
				>
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
	navigate: ReturnType<typeof Route.useNavigate>;
}) {
	const convexId = id as Id<"obras">;
	const doc = useQuery(convexApi.obras.get, { id: convexId });
	const removeObra = useMutation(convexApi.obras.remove);
	const [isEditOpen, setIsEditOpen] = useState(false);

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
	const progressUnitLabel = progressUnitLabels[obra.type];
	const metadataSource =
		obra.external?.source ?? metadataSourceByType[obra.type];
	const metadataSourceLabel = metadataSourceLabels[metadataSource];
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
		if (
			(obra.type === "manga" || obra.type === "manhwa") &&
			metadata.latestChapter
		) {
			metadataItems.push({
				label: "Capítulos totales",
				value: metadata.latestChapter.toLocaleString(),
			});
		}
		if (
			(obra.type === "manga" || obra.type === "manhwa") &&
			metadata.latestChapterSource
		) {
			metadataItems.push({
				label: "Fuente de capítulos",
				value:
					mangaChapterSourceLabels[metadata.latestChapterSource] ??
					metadata.latestChapterSource,
			});
		}
		if (
			(obra.type === "manga" || obra.type === "manhwa") &&
			metadata.latestChapterCheckedAt
		) {
			metadataItems.push({
				label: "Última verificación",
				value: formatDateShort(metadata.latestChapterCheckedAt),
			});
		}
		if ((obra.type === "manga" || obra.type === "manhwa") && metadata.volumes) {
			metadataItems.push({
				label: "Volúmenes",
				value: metadata.volumes.toLocaleString(),
			});
		}
		if ((obra.type === "manga" || obra.type === "manhwa") && statusLabel) {
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

	const handleDelete = async () => {
		await removeObra({ id: convexId });
		navigate({ to: "/biblioteca" });
	};

	const handleOpenReadingLink = (urlValue: string) => {
		const nextUrl = normalizeReadingUrl(urlValue);
		if (!nextUrl) return;
		window.open(nextUrl, "_blank", "noopener,noreferrer");
	};

	const handleOpenEdit = () => {
		setIsEditOpen(true);
	};

	const handleEditOpenChange = (open: boolean) => {
		setIsEditOpen(open);
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

				<ObraEditSheet
					obraId={obra.id}
					open={isEditOpen}
					onOpenChange={handleEditOpenChange}
				/>
			</div>
		</div>
	);
}
