import type { MetadataSource } from "@/lib/metadata/types";

export type ObraType = "book" | "movie" | "series" | "anime" | "manga";

export type ObraStatus = "backlog" | "in-progress" | "finished" | "dropped";

export type MangaChapterSource = "manga-plus" | "mangadex" | "anilist";

export type ObraId = string;

export interface ObraMetadata {
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
	notes?: string;
	obsidianPath?: string;
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
	notes?: string;
	obsidianPath?: string;
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
	notes?: string;
	obsidianPath?: string;
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
