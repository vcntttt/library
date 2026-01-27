export type MetadataSource =
	| "google-books"
	| "open-library"
	| "tmdb"
	| "anilist";

export interface MetadataSearchResult {
	source: MetadataSource;
	id: string;
	title: string;
	creator?: string;
	year?: number;
	coverUrl?: string;
	pages?: number;
	seasons?: number;
	episodes?: number;
	episodesAired?: number;
	nextEpisodeDate?: number;
	status?: string;
	chapters?: number;
	volumes?: number;
	season?: string;
	seasonYear?: number;
	runtime?: number;
	watchProviders?: string[];
}

export interface MetadataDetails {
	source: MetadataSource;
	id: string;
	title?: string;
	creator?: string;
	year?: number;
	coverUrl?: string;
	pages?: number;
	seasons?: number;
	episodes?: number;
	episodesAired?: number;
	nextEpisodeDate?: number;
	status?: string;
	chapters?: number;
	volumes?: number;
	season?: string;
	seasonYear?: number;
	runtime?: number;
	watchProviders?: string[];
}
