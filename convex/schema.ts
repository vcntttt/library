import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
	mangaChapterSourceValidator,
	metadataSourceValidator,
	obraFormatValidator,
	obraMetadataValidator,
	obraStatusValidator,
	obraTypeValidator,
} from "./lib/validators";

export default defineSchema({
	...authTables,
	users: defineTable({
		name: v.optional(v.string()),
		image: v.optional(v.string()),
		email: v.optional(v.string()),
		emailVerificationTime: v.optional(v.number()),
		phone: v.optional(v.string()),
		phoneVerificationTime: v.optional(v.number()),
		isAnonymous: v.optional(v.boolean()),
	}).index("email", ["email"]),
	obras: defineTable({
		userId: v.id("users"),
		title: v.string(),
		type: obraTypeValidator,
		format: v.optional(obraFormatValidator),
		status: obraStatusValidator,
		review: v.optional(v.string()),
		tags: v.array(v.string()),
		recommendedBy: v.optional(v.string()),
		readingUrl: v.optional(v.string()),
		sourceUrl: v.optional(v.string()),
		externalSource: v.optional(metadataSourceValidator),
		externalId: v.optional(v.string()),
		metadata: v.optional(obraMetadataValidator),
		coverUrl: v.optional(v.string()),
		customCoverUrl: v.optional(v.string()),
		creator: v.optional(v.string()),
		customCreator: v.optional(v.string()),
		year: v.optional(v.number()),
		customYear: v.optional(v.number()),
		customTitle: v.optional(v.string()),
		progressCurrent: v.optional(v.number()),
		progressTotal: v.optional(v.number()),
		progressSeasons: v.optional(
			v.array(
				v.object({
					seasonNumber: v.number(),
					episodeCount: v.number(),
				}),
			),
		),
		startedAt: v.optional(v.number()),
		finishedAt: v.optional(v.number()),
		createdAt: v.number(),
			updatedAt: v.number(),
		})
		.index("by_user_updatedAt", ["userId", "updatedAt"])
		.index("by_user_createdAt", ["userId", "createdAt"])
		.index("by_user_status_updatedAt", ["userId", "status", "updatedAt"])
		.index("by_user_type_updatedAt", ["userId", "type", "updatedAt"])
		.index("by_manga_tracking", ["type", "status", "externalSource"]),
	obraQuotes: defineTable({
		userId: v.id("users"),
		obraId: v.id("obras"),
		content: v.string(),
		characterName: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_user_obra_createdAt", ["userId", "obraId", "createdAt"])
		.index("by_user_updatedAt", ["userId", "updatedAt"]),
	notificationEvents: defineTable({
		eventType: v.union(
			v.literal("manga.release"),
			v.literal("media.episode.release"),
		),
		eventId: v.string(),
		obraId: v.id("obras"),
		userId: v.optional(v.id("users")),
		anilistId: v.optional(v.string()),
		externalId: v.optional(v.string()),
		title: v.string(),
		chapter: v.optional(v.number()),
		episode: v.optional(v.number()),
		seasonNumber: v.optional(v.number()),
		episodeNumber: v.optional(v.number()),
		source: v.union(mangaChapterSourceValidator, v.literal("tmdb")),
		url: v.optional(v.string()),
		detectedAt: v.number(),
		status: v.union(
			v.literal("pending"),
			v.literal("processing"),
			v.literal("delivered"),
		),
		attempts: v.number(),
		leaseExpiresAt: v.optional(v.number()),
		lastAttemptAt: v.optional(v.number()),
		deliveredAt: v.optional(v.number()),
		lastError: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_eventId", ["eventId"])
		.index("by_status_createdAt", ["status", "createdAt"])
		.index("by_user_status_createdAt", ["userId", "status", "createdAt"]),
	notificationWorkerState: defineTable({
		userId: v.id("users"),
		worker: v.union(
			v.literal("manga"),
			v.literal("episodic"),
			v.literal("legacy-events"),
		),
		cursor: v.optional(v.string()),
		updatedAt: v.number(),
	}).index("by_user_worker", ["userId", "worker"]),
});
