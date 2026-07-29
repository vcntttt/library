import type {
	MetadataDetails,
	MetadataSearchResult,
} from "@/lib/metadata/types";
import type { ObraMetadata } from "@/lib/types";

export function buildMetadataPayload(
	source: MetadataDetails | MetadataSearchResult | null,
	options: {
		initializeNotificationBaseline?: boolean;
		previousMetadata?: ObraMetadata;
	} = {},
): ObraMetadata | undefined {
	if (!source) return undefined;
	const initializeNotificationBaseline =
		options.initializeNotificationBaseline ?? true;

	const payload: ObraMetadata = {
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
		latestSeasonNumber: source.latestSeasonNumber ?? undefined,
		latestEpisodeNumber: source.latestEpisodeNumber ?? undefined,
		nextEpisodeDate: source.nextEpisodeDate ?? undefined,
		latestEpisodeCheckedAt: source.latestEpisodeCheckedAt ?? undefined,
		lastNotifiedEpisode:
			source.lastNotifiedEpisode ??
			(initializeNotificationBaseline
				? source.episodesAired
				: (options.previousMetadata?.lastNotifiedEpisode ??
					options.previousMetadata?.episodesAired ??
					0)),
		status: source.status ?? undefined,
		volumes: source.volumes ?? undefined,
		season: source.season ?? undefined,
		seasonYear: source.seasonYear ?? undefined,
		runtime: source.runtime ?? undefined,
		watchProviders: source.watchProviders ?? undefined,
		latestChapter: source.latestChapter ?? undefined,
		latestChapterSource: source.latestChapterSource ?? undefined,
		latestChapterCheckedAt: source.latestChapterCheckedAt ?? undefined,
		lastNotifiedChapter: initializeNotificationBaseline
			? source.latestChapter
			: (options.previousMetadata?.lastNotifiedChapter ??
				options.previousMetadata?.latestChapter ??
				0),
		mangaPlusTitleId: source.mangaPlusTitleId ?? undefined,
		mangaDexId: source.mangaDexId ?? undefined,
	};

	return Object.values(payload).some((value) => value !== undefined)
		? payload
		: undefined;
}
