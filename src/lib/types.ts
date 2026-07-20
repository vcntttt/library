import type { MangaChapterSource, MetadataSource } from "@/lib/metadata/types";

export type ObraType =
	| "book"
	| "movie"
	| "series"
	| "anime"
	| "manga"
	| "manhwa";

export type ObraStatus =
	| "backlog"
	| "in-progress"
	| "paused"
	| "hiatus"
	| "finished"
	| "dropped";

export type ObraFormat = "physical" | "ebook" | "audiobook";

export type ObraId = string;

export interface ObraSeason {
	seasonNumber: number;
	episodeCount: number;
}

export interface ObraMetadata {
	pages?: number;
	durationMinutes?: number;
	subtitle?: string;
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
	latestChapterSource?: MangaChapterSource;
	latestChapterCheckedAt?: number;
	lastNotifiedChapter?: number;
	mangaPlusTitleId?: string;
	mangaDexId?: string;
}

export interface ObraProgress {
	current: number;
	total: number;
}

export interface ObraSeasonProgress {
	seasons: ObraSeason[];
}

export interface ObraQuote {
	id: string;
	obraId: ObraId;
	content: string;
	characterName?: string;
	createdAt: number;
	updatedAt: number;
}

export interface ObraQuotePatch {
	id?: string;
	content: string;
	characterName?: string;
}

export interface ExternalReference {
	source: MetadataSource;
	id: string;
}

export interface Obra {
	id: ObraId;
	title: string;
	originalTitle?: string;
	customTitle?: string;
	type: ObraType;
	format?: ObraFormat;
	status: ObraStatus;
	review?: string;
	tags: string[];
	quotes: ObraQuote[];
	recommendedBy?: string;
	readingUrl?: string;
	sourceUrl?: string;
	coverUrl?: string;
	originalCoverUrl?: string;
	customCoverUrl?: string;
	creator?: string;
	originalCreator?: string;
	customCreator?: string;
	year?: number;
	originalYear?: number;
	customYear?: number;
	external?: ExternalReference;
	metadata?: ObraMetadata;
	progress?: ObraProgress;
	progressSeasons?: ObraSeason[];
	startedAt?: number;
	finishedAt?: number;
	createdAt: number;
	updatedAt: number;
}

export interface CreateObraInput {
	title: string;
	type: ObraType;
	format?: ObraFormat;
	status: ObraStatus;
	review?: string;
	tags?: string[];
	recommendedBy?: string;
	readingUrl?: string;
	sourceUrl?: string;
	external?: ExternalReference;
	metadata?: ObraMetadata;
	coverUrl?: string;
	customCoverUrl?: string;
	creator?: string;
	customCreator?: string;
	year?: number;
	customYear?: number;
	customTitle?: string;
	progress?: ObraProgress;
	progressSeasons?: ObraSeason[];
	startedAt?: number;
	finishedAt?: number;
}

export interface UpdateObraPatch {
	title?: string;
	type?: ObraType;
	format?: ObraFormat;
	status?: ObraStatus;
	review?: string;
	tags?: string[];
	quotes?: ObraQuotePatch[];
	recommendedBy?: string;
	readingUrl?: string;
	sourceUrl?: string;
	external?: ExternalReference;
	metadata?: ObraMetadata;
	coverUrl?: string;
	customCoverUrl?: string;
	creator?: string;
	customCreator?: string;
	year?: number;
	customYear?: number;
	customTitle?: string;
	progress?: ObraProgress;
	progressSeasons?: ObraSeason[] | null;
	startedAt?: number;
	finishedAt?: number;
}
