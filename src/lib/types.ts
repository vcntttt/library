import type { MetadataSource } from "@/lib/metadata/types";

export type ObraType = "book" | "movie" | "series" | "anime" | "manga";

export type ObraStatus = "backlog" | "in-progress" | "finished" | "dropped";

export type ObraId = import("../../convex/_generated/dataModel").Id<"obras">;

export interface Obra {
	id: ObraId;
	title: string;
	type: ObraType;
	status: ObraStatus;
	review?: string;
	tags: string[];
	notes?: string; // markdown
	obsidianPath?: string;
	coverUrl?: string;
	creator?: string; // author, director, studio
	year?: number;
	external?: {
		source: MetadataSource;
		id: string;
	};
	metadata?: {
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
		latestChapterSource?: "manga-plus" | "mangadex" | "anilist";
		latestChapterCheckedAt?: number;
		lastNotifiedChapter?: number;
		mangaPlusTitleId?: string;
		mangaDexId?: string;
	};
	// Progress tracking
	progress?: {
		current: number;
		total: number;
	};
	// Dates
	startedAt?: number;
	finishedAt?: number;
	createdAt: number;
	updatedAt: number;
}
