import type { Infer } from "convex/values";
import type {
	createObraValidator,
	externalReferenceValidator,
	obraMetadataValidator,
	obraTypeValidator,
	progressSeasonsValidator,
	progressValidator,
	quotePatchValidator,
	updateObraPatchValidator,
} from "./validators";

export type ObraType = Infer<typeof obraTypeValidator>;
export type ObraMetadata = Infer<typeof obraMetadataValidator>;
export type ExternalReference = Infer<typeof externalReferenceValidator>;
export type ObraProgress = Infer<typeof progressValidator>;
export type ObraProgressSeason = Infer<typeof progressSeasonsValidator>[number];
export type ObraQuotePatch = Infer<typeof quotePatchValidator>;
export type CreateObraInput = Infer<typeof createObraValidator>;
export type UpdateObraPatch = Infer<typeof updateObraPatchValidator> &
	Record<string, unknown>;

export function assertCreateObraInput(input: CreateObraInput) {
	if (!input.title.trim()) throw new Error("El titulo es requerido.");
	if (input.progress) assertProgress(input.progress);
	if (input.progressSeasons) assertProgressSeasons(input.progressSeasons);
	return input;
}

export function assertUpdateObraPatch(patch: UpdateObraPatch) {
	if (patch.title !== undefined && !patch.title.trim()) {
		throw new Error("El titulo es requerido.");
	}
	if (patch.progress) assertProgress(patch.progress);
	if (patch.progressSeasons) assertProgressSeasons(patch.progressSeasons);
	if (patch.quotes) {
		for (const quote of patch.quotes) {
			if (!quote.content.trim()) throw new Error("La cita es requerida.");
		}
	}
	return patch;
}

export function normalizeOptionalString(value: string | null | undefined) {
	if (value == null) return undefined;
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

export function nullableNumber(value: number | null | undefined) {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function normalizeTags(tags: string[] | null | undefined) {
	if (!tags) return [];
	return Array.from(
		new Set(
			tags
				.map((tag) => tag.trim())
				.filter((tag): tag is string => Boolean(tag)),
		),
	);
}

export function sanitizeExternal(
	external: ExternalReference | null | undefined,
): ExternalReference | undefined {
	if (external == null) return undefined;
	const source = external.source.trim();
	const id = external.id.trim();
	if (!source || !id) throw new Error("Metadata invalida.");
	return { source: source as ExternalReference["source"], id };
}

export function sanitizeProgress(
	progress: ObraProgress | null | undefined,
): ObraProgress | undefined {
	if (!progress) return undefined;
	const current = Math.max(0, Math.floor(progress.current));
	const total = Math.max(0, Math.floor(progress.total));
	if (total <= 0) return undefined;
	return { current: Math.min(current, total), total };
}

export function sanitizeProgressSeasons(
	seasons: ObraProgressSeason[] | null | undefined,
): ObraProgressSeason[] | undefined {
	if (!seasons) return undefined;
	const sanitized = seasons
		.map((season) => ({
			seasonNumber: Math.max(0, Math.floor(season.seasonNumber)),
			episodeCount: Math.max(0, Math.floor(season.episodeCount)),
		}))
		.filter((season) => season.seasonNumber > 0 && season.episodeCount > 0);
	const unique = new Map<number, ObraProgressSeason>();
	for (const season of sanitized) {
		unique.set(season.seasonNumber, season);
	}
	const sorted = Array.from(unique.values()).sort(
		(a, b) => a.seasonNumber - b.seasonNumber,
	);
	return sorted.length > 0 ? sorted : undefined;
}

function assertProgressSeasons(seasons: ObraProgressSeason[]) {
	for (const season of seasons) {
		if (
			season.seasonNumber < 0 ||
			season.episodeCount < 0 ||
			!Number.isFinite(season.seasonNumber) ||
			!Number.isFinite(season.episodeCount)
		) {
			throw new Error("Distribución de temporadas invalida.");
		}
	}
}

export function sanitizeMetadata(
	metadata: ObraMetadata | null | undefined,
	obraType?: ObraType,
): ObraMetadata | undefined {
	if (!metadata) return undefined;

	const sanitized: ObraMetadata = {
		pages: nullableNumber(metadata.pages),
		durationMinutes: nullableNumber(metadata.durationMinutes),
		subtitle: normalizeOptionalString(metadata.subtitle),
		publisher: normalizeOptionalString(metadata.publisher),
		publishedDate: normalizeOptionalString(metadata.publishedDate),
		language: normalizeOptionalString(metadata.language),
		isbn10: normalizeOptionalString(metadata.isbn10),
		isbn13: normalizeOptionalString(metadata.isbn13),
		categories: metadata.categories
			?.map((category) => normalizeOptionalString(category))
			.filter((category): category is string => Boolean(category)),
		description: normalizeOptionalString(metadata.description),
		canonicalUrl: normalizeOptionalString(metadata.canonicalUrl),
		seasons: nullableNumber(metadata.seasons),
		episodes: nullableNumber(metadata.episodes),
		episodesAired: nullableNumber(metadata.episodesAired),
		nextEpisodeDate: nullableNumber(metadata.nextEpisodeDate),
		status: normalizeOptionalString(metadata.status),
		volumes: nullableNumber(metadata.volumes),
		season: normalizeOptionalString(metadata.season),
		seasonYear: nullableNumber(metadata.seasonYear),
		runtime: nullableNumber(metadata.runtime),
		watchProviders: metadata.watchProviders
			?.map((provider) => normalizeOptionalString(provider))
			.filter((provider): provider is string => Boolean(provider)),
		latestChapter:
			typeof metadata.latestChapter === "number"
				? metadata.latestChapter
				: undefined,
		latestChapterSource: metadata.latestChapterSource,
		latestChapterCheckedAt: nullableNumber(metadata.latestChapterCheckedAt),
		lastNotifiedChapter: nullableNumber(metadata.lastNotifiedChapter),
		mangaPlusTitleId: normalizeOptionalString(metadata.mangaPlusTitleId),
		mangaDexId: normalizeOptionalString(metadata.mangaDexId),
	};

	if (obraType !== "manga" && obraType !== "manhwa") {
		delete sanitized.latestChapter;
		delete sanitized.latestChapterSource;
		delete sanitized.latestChapterCheckedAt;
		delete sanitized.lastNotifiedChapter;
		delete sanitized.mangaPlusTitleId;
		delete sanitized.mangaDexId;
	}

	if (obraType !== "book") {
		delete sanitized.subtitle;
		delete sanitized.publisher;
		delete sanitized.publishedDate;
		delete sanitized.language;
		delete sanitized.isbn10;
		delete sanitized.isbn13;
		delete sanitized.categories;
		delete sanitized.description;
		delete sanitized.canonicalUrl;
	}

	for (const key of Object.keys(sanitized) as Array<keyof ObraMetadata>) {
		if (sanitized[key] === undefined) delete sanitized[key];
	}

	return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function sanitizeQuotes(quotes: ObraQuotePatch[]) {
	return quotes.map((quote) => ({
		id: quote.id,
		content: quote.content.trim(),
		characterName: normalizeOptionalString(quote.characterName),
	}));
}

export function syncMangaProgressTotal(
	currentTotal: number | undefined,
	metadata: ObraMetadata | undefined,
	obraType: ObraType,
) {
	if (obraType !== "manga" && obraType !== "manhwa") return currentTotal;
	if (typeof currentTotal !== "number") return undefined;
	const latestChapter = metadata?.latestChapter;
	if (typeof latestChapter !== "number") return currentTotal;
	return Math.max(currentTotal, Math.floor(latestChapter));
}

function assertProgress(progress: ObraProgress) {
	if (progress.current < 0 || progress.total < 0) {
		throw new Error("Progreso invalido.");
	}
}
