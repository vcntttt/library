export type MetadataSource =
	| "google-books"
	| "open-library"
	| "apple-books"
	| "tmdb"
	| "anilist";

export interface MetadataSearchResult {
	source: MetadataSource;
	id: string;
	title: string;
	subtitle?: string;
	creator?: string;
	year?: number;
	coverUrl?: string;
	pages?: number;
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
	nextEpisodeDate?: number;
	status?: string;
	volumes?: number;
	season?: string;
	seasonYear?: number;
	runtime?: number;
	watchProviders?: string[];
	latestChapter?: number;
	latestChapterSource?: "manga-plus" | "mangadex" | "anilist";
	latestChapterCheckedAt?: number;
	mangaPlusTitleId?: string;
	mangaDexId?: string;
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
	nextEpisodeDate?: number;
	status?: string;
	volumes?: number;
	season?: string;
	seasonYear?: number;
	runtime?: number;
	watchProviders?: string[];
	latestChapter?: number;
	latestChapterSource?: "manga-plus" | "mangadex" | "anilist";
	latestChapterCheckedAt?: number;
	mangaPlusTitleId?: string;
	mangaDexId?: string;
}
