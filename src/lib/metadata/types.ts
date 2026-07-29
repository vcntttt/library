export type MetadataSource =
	| "google-books"
	| "open-library"
	| "apple-books"
	| "amazon"
	| "tmdb"
	| "anilist"
	| "manhwaweb";

export type MangaChapterSource =
	| "manga-plus"
	| "mangadex"
	| "anilist"
	| "manhwaweb"
	| "scraping";

export interface MetadataDirectUrlFallback {
	url: string;
	label: string;
	identifier?: string;
	reason: string;
}

export interface MetadataSeason {
	seasonNumber: number;
	episodeCount: number;
}

export interface MetadataSearchResult {
	source: MetadataSource;
	id: string;
	title: string;
	subtitle?: string;
	creator?: string;
	year?: number;
	coverUrl?: string;
	pages?: number;
	durationMinutes?: number;
	publisher?: string;
	publishedDate?: string;
	language?: string;
	isbn10?: string;
	isbn13?: string;
	categories?: string[];
	description?: string;
	canonicalUrl?: string;
	seasons?: number;
	episodes?: number;
	episodesAired?: number;
	latestSeasonNumber?: number;
	latestEpisodeNumber?: number;
	nextEpisodeDate?: number;
	latestEpisodeCheckedAt?: number;
	lastNotifiedEpisode?: number;
	status?: string;
	volumes?: number;
	season?: string;
	seasonYear?: number;
	runtime?: number;
	watchProviders?: string[];
	latestChapter?: number;
	latestChapterSource?: MangaChapterSource;
	latestChapterCheckedAt?: number;
	mangaPlusTitleId?: string;
	mangaDexId?: string;
	seasonDetails?: MetadataSeason[];
}

export interface MetadataDetails {
	source: MetadataSource;
	id: string;
	title?: string;
	subtitle?: string;
	creator?: string;
	year?: number;
	coverUrl?: string;
	pages?: number;
	durationMinutes?: number;
	publisher?: string;
	publishedDate?: string;
	language?: string;
	isbn10?: string;
	isbn13?: string;
	categories?: string[];
	description?: string;
	canonicalUrl?: string;
	seasons?: number;
	episodes?: number;
	episodesAired?: number;
	latestSeasonNumber?: number;
	latestEpisodeNumber?: number;
	nextEpisodeDate?: number;
	latestEpisodeCheckedAt?: number;
	lastNotifiedEpisode?: number;
	status?: string;
	volumes?: number;
	season?: string;
	seasonYear?: number;
	runtime?: number;
	watchProviders?: string[];
	latestChapter?: number;
	latestChapterSource?: MangaChapterSource;
	latestChapterCheckedAt?: number;
	mangaPlusTitleId?: string;
	mangaDexId?: string;
	seasonDetails?: MetadataSeason[];
}
