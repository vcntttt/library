import type { MangaChapterSource, MetadataSource } from "@/lib/metadata/types";
import type { Obra, ObraType } from "@/lib/types";
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
	amazon: "Amazon",
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

export interface DetailItem {
	label: string;
	value: string;
}

// Ficha técnica de la obra: año, metadatos según su tipo, fuente y URL.
// Se arma fuera del componente para que las vistas solo muestren los datos.
export function buildTechnicalItems(obra: Obra): DetailItem[] {
	const metadata = obra.metadata;
	const metadataSource =
		obra.external?.source ?? metadataSourceByType[obra.type];
	const metadataSourceLabel = metadataSourceLabels[metadataSource];
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
		if (obra.type === "book" && obra.format === "audiobook") {
			metadataItems.push({
				label: "Formato",
				value: "Audiolibro",
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
			metadata.latestEpisodeNumber
		) {
			metadataItems.push({
				label: "Último episodio",
				value: metadata.latestSeasonNumber
					? `Temporada ${metadata.latestSeasonNumber} · Episodio ${metadata.latestEpisodeNumber}`
					: `Episodio ${metadata.latestEpisodeNumber}`,
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
			(obra.type === "series" || obra.type === "anime") &&
			metadata.latestEpisodeCheckedAt
		) {
			metadataItems.push({
				label: "Última verificación",
				value: formatDateShort(metadata.latestEpisodeCheckedAt),
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
	if (obra.sourceUrl) {
		technicalItems.push({ label: "URL fuente", value: obra.sourceUrl });
	}
	return technicalItems;
}
