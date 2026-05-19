import { v } from "convex/values";

export const obraTypeValidator = v.union(
	v.literal("book"),
	v.literal("movie"),
	v.literal("series"),
	v.literal("anime"),
	v.literal("manga"),
);

export const obraStatusValidator = v.union(
	v.literal("backlog"),
	v.literal("in-progress"),
	v.literal("finished"),
	v.literal("dropped"),
);

export const metadataSourceValidator = v.union(
	v.literal("google-books"),
	v.literal("open-library"),
	v.literal("apple-books"),
	v.literal("tmdb"),
	v.literal("anilist"),
);

export const mangaChapterSourceValidator = v.union(
	v.literal("manga-plus"),
	v.literal("mangadex"),
	v.literal("anilist"),
);

export const externalReferenceValidator = v.object({
	source: metadataSourceValidator,
	id: v.string(),
});

export const obraMetadataValidator = v.object({
	pages: v.optional(v.number()),
	subtitle: v.optional(v.string()),
	publisher: v.optional(v.string()),
	publishedDate: v.optional(v.string()),
	language: v.optional(v.string()),
	isbn10: v.optional(v.string()),
	isbn13: v.optional(v.string()),
	categories: v.optional(v.array(v.string())),
	description: v.optional(v.string()),
	canonicalUrl: v.optional(v.string()),
	seasons: v.optional(v.number()),
	episodes: v.optional(v.number()),
	episodesAired: v.optional(v.number()),
	nextEpisodeDate: v.optional(v.number()),
	status: v.optional(v.string()),
	volumes: v.optional(v.number()),
	season: v.optional(v.string()),
	seasonYear: v.optional(v.number()),
	runtime: v.optional(v.number()),
	watchProviders: v.optional(v.array(v.string())),
	latestChapter: v.optional(v.number()),
	latestChapterSource: v.optional(mangaChapterSourceValidator),
	latestChapterCheckedAt: v.optional(v.number()),
	lastNotifiedChapter: v.optional(v.number()),
	mangaPlusTitleId: v.optional(v.string()),
	mangaDexId: v.optional(v.string()),
});

export const progressValidator = v.object({
	current: v.number(),
	total: v.number(),
});

export const quotePatchValidator = v.object({
	id: v.optional(v.id("obraQuotes")),
	content: v.string(),
	characterName: v.optional(v.string()),
});

export const createObraFields = {
	title: v.string(),
	type: obraTypeValidator,
	status: obraStatusValidator,
	review: v.optional(v.string()),
	tags: v.optional(v.array(v.string())),
	recommendedBy: v.optional(v.string()),
	readingUrl: v.optional(v.string()),
	external: v.optional(externalReferenceValidator),
	metadata: v.optional(obraMetadataValidator),
	coverUrl: v.optional(v.string()),
	customCoverUrl: v.optional(v.string()),
	creator: v.optional(v.string()),
	customCreator: v.optional(v.string()),
	year: v.optional(v.number()),
	customYear: v.optional(v.number()),
	customTitle: v.optional(v.string()),
	progress: v.optional(progressValidator),
	startedAt: v.optional(v.number()),
	finishedAt: v.optional(v.number()),
};

export const createObraValidator = v.object(createObraFields);

export const updateObraPatchFields = {
	title: v.optional(v.string()),
	type: v.optional(obraTypeValidator),
	status: v.optional(obraStatusValidator),
	review: v.optional(v.string()),
	tags: v.optional(v.array(v.string())),
	quotes: v.optional(v.array(quotePatchValidator)),
	recommendedBy: v.optional(v.string()),
	readingUrl: v.optional(v.string()),
	external: v.optional(v.union(externalReferenceValidator, v.null())),
	metadata: v.optional(v.union(obraMetadataValidator, v.null())),
	coverUrl: v.optional(v.string()),
	customCoverUrl: v.optional(v.string()),
	creator: v.optional(v.string()),
	customCreator: v.optional(v.string()),
	year: v.optional(v.number()),
	customYear: v.optional(v.number()),
	customTitle: v.optional(v.string()),
	progress: v.optional(v.union(progressValidator, v.null())),
	startedAt: v.optional(v.number()),
	finishedAt: v.optional(v.number()),
};

export const updateObraPatchValidator = v.object(updateObraPatchFields);

export const notificationStatusValidator = v.union(
	v.literal("delivered"),
	v.literal("failed"),
);
