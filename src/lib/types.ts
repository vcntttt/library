export type ObraType = "book" | "movie" | "series" | "anime" | "manga";

export type ObraStatus = "backlog" | "in-progress" | "finished" | "dropped";

export type ObraId = import("../../convex/_generated/dataModel").Id<"obras">;

export interface Obra {
	id: ObraId;
	title: string;
	type: ObraType;
	status: ObraStatus;
	rating?: number; // 1-5
	review?: string;
	tags: string[];
	notes?: string; // markdown
	coverUrl?: string;
	creator?: string; // author, director, studio
	year?: number;
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
