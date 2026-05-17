import type { MetadataSource } from "@/lib/metadata/types";

export type ObraType = "book" | "movie" | "series" | "anime" | "manga";

export type ObraStatus = "backlog" | "in-progress" | "finished" | "dropped";

export type MangaChapterSource = "manga-plus" | "mangadex" | "anilist";

export type ObraId = string;

export interface ObraMetadata {
	pages?: number;
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
	type: ObraType;
	status: ObraStatus;
	review?: string;
	tags: string[];
	quotes: ObraQuote[];
	recommendedBy?: string;
	readingUrl?: string;
	coverUrl?: string;
	creator?: string;
	year?: number;
	external?: ExternalReference;
	metadata?: ObraMetadata;
	progress?: ObraProgress;
	startedAt?: number;
	finishedAt?: number;
	createdAt: number;
	updatedAt: number;
}

export interface CreateObraInput {
	title: string;
	type: ObraType;
	status: ObraStatus;
	review?: string;
	tags?: string[];
	recommendedBy?: string;
	readingUrl?: string;
	external?: ExternalReference;
	metadata?: ObraMetadata;
	coverUrl?: string;
	creator?: string;
	year?: number;
	progress?: ObraProgress;
	startedAt?: number;
	finishedAt?: number;
}

export interface UpdateObraPatch {
	title?: string;
	type?: ObraType;
	status?: ObraStatus;
	review?: string;
	tags?: string[];
	quotes?: ObraQuotePatch[];
	recommendedBy?: string;
	readingUrl?: string;
	external?: ExternalReference;
	metadata?: ObraMetadata;
	coverUrl?: string;
	creator?: string;
	year?: number;
	progress?: ObraProgress;
	startedAt?: number;
	finishedAt?: number;
}
