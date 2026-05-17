import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
	mangaChapterSourceValidator,
	metadataSourceValidator,
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
		status: obraStatusValidator,
		review: v.optional(v.string()),
		tags: v.array(v.string()),
		recommendedBy: v.optional(v.string()),
		readingUrl: v.optional(v.string()),
		externalSource: v.optional(metadataSourceValidator),
		externalId: v.optional(v.string()),
		metadata: v.optional(obraMetadataValidator),
		coverUrl: v.optional(v.string()),
		creator: v.optional(v.string()),
		year: v.optional(v.number()),
		progressCurrent: v.optional(v.number()),
		progressTotal: v.optional(v.number()),
		startedAt: v.optional(v.number()),
		finishedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_user_updatedAt", ["userId", "updatedAt"])
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
		eventType: v.literal("manga.release"),
		eventId: v.string(),
		obraId: v.id("obras"),
		anilistId: v.string(),
		title: v.string(),
		chapter: v.number(),
		source: mangaChapterSourceValidator,
		url: v.optional(v.string()),
		detectedAt: v.number(),
		status: v.union(v.literal("pending"), v.literal("delivered")),
		attempts: v.number(),
		lastAttemptAt: v.optional(v.number()),
		deliveredAt: v.optional(v.number()),
		lastError: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_eventId", ["eventId"])
		.index("by_status_createdAt", ["status", "createdAt"]),
});
