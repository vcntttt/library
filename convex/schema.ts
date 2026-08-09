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
		reviewStatus: v.optional(
			v.union(
				v.literal("pending"),
				v.literal("completed"),
				v.literal("skipped"),
			),
		),
		reviewRequestedAt: v.optional(v.number()),
		reviewedAt: v.optional(v.number()),
		reviewSkippedAt: v.optional(v.number()),
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
		readingDocumentId: v.optional(v.id("readingDocuments")),
		readingProgressPercent: v.optional(v.number()),
		readingCurrentPercent: v.optional(v.number()),
		readingProgressUpdatedAt: v.optional(v.number()),
		readingProgressSourceTimestamp: v.optional(v.number()),
		readingProgressRevision: v.optional(v.number()),
		readingProgressStatus: v.optional(
			v.union(v.literal("complete"), v.literal("in-progress")),
		),
		readingRereadSuggestedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
		})
		.index("by_user_updatedAt", ["userId", "updatedAt"])
		.index("by_user_createdAt", ["userId", "createdAt"])
		.index("by_user_status_updatedAt", ["userId", "status", "updatedAt"])
		.index("by_user_type_updatedAt", ["userId", "type", "updatedAt"])
		.index("by_user_reviewStatus_updatedAt", [
			"userId",
			"reviewStatus",
			"updatedAt",
		])
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
	readingDocuments: defineTable({
		userId: v.id("users"),
		sourceKey: v.string(),
		sourcePath: v.string(),
		title: v.string(),
		format: v.union(v.literal("epub"), v.literal("pdf"), v.literal("other")),
		documentKey: v.optional(v.string()),
		author: v.optional(v.string()),
		fileHash: v.optional(v.string()),
		fileModifiedAt: v.optional(v.number()),
		sidecarModifiedAt: v.optional(v.number()),
		lastSyncedAt: v.optional(v.number()),
		obraId: v.optional(v.id("obras")),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_user_sourceKey", ["userId", "sourceKey"])
		.index("by_user_documentKey", ["userId", "documentKey"])
		.index("by_user_fileHash", ["userId", "fileHash"])
		.index("by_user_updatedAt", ["userId", "updatedAt"]),
	readingSources: defineTable({
		userId: v.id("users"),
		documentId: v.id("readingDocuments"),
		sourceKey: v.string(),
		sourcePath: v.string(),
		fileHash: v.optional(v.string()),
		fileModifiedAt: v.optional(v.number()),
		sidecarModifiedAt: v.optional(v.number()),
		status: v.union(
			v.literal("active"),
			v.literal("missing"),
			v.literal("error"),
		),
		lastSeenAt: v.optional(v.number()),
		lastProcessedAt: v.optional(v.number()),
		lastError: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_user_sourceKey", ["userId", "sourceKey"])
		.index("by_document_sourceKey", ["documentId", "sourceKey"])
		.index("by_document_updatedAt", ["documentId", "updatedAt"])
		.index("by_user_status_updatedAt", ["userId", "status", "updatedAt"]),
	readingProgress: defineTable({
		userId: v.id("users"),
		documentId: v.id("readingDocuments"),
		sourceId: v.optional(v.id("readingSources")),
		deviceId: v.string(),
		deviceLabel: v.optional(v.string()),
		filePath: v.optional(v.string()),
		page: v.optional(v.number()),
		percent: v.optional(v.number()),
		maxPercent: v.optional(v.number()),
		totalPages: v.optional(v.number()),
		revision: v.optional(v.number()),
		sourceTimestamp: v.optional(v.number()),
		locator: v.optional(v.string()),
		completionStatus: v.optional(
			v.union(v.literal("complete"), v.literal("in-progress")),
		),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_document_device", ["documentId", "deviceId"])
		.index("by_user_updatedAt", ["userId", "updatedAt"]),
	readingAnnotations: defineTable({
		userId: v.id("users"),
		documentId: v.id("readingDocuments"),
		sourceId: v.optional(v.id("readingSources")),
		sourceKey: v.string(),
		sourceFingerprint: v.optional(v.string()),
		sourceIndex: v.optional(v.number()),
		sourceCreatedAt: v.optional(v.string()),
		text: v.string(),
		originalText: v.optional(v.string()),
		curatedText: v.optional(v.string()),
		curatedAt: v.optional(v.number()),
		note: v.optional(v.string()),
		comment: v.optional(v.string()),
		chapter: v.optional(v.string()),
		color: v.optional(v.string()),
		page: v.optional(v.string()),
		pageNumber: v.optional(v.number()),
		positionStart: v.optional(v.string()),
		positionEnd: v.optional(v.string()),
		capturedAt: v.optional(v.string()),
		updatedAtSource: v.optional(v.string()),
		deviceId: v.optional(v.string()),
		deviceLabel: v.optional(v.string()),
		status: v.union(
			v.literal("unprocessed"),
			v.literal("kept"),
			v.literal("ignored"),
			// Estado legado; no se usa desde la interfaz.
			v.literal("discarded"),
		),
		sourceStatus: v.optional(v.union(v.literal("active"), v.literal("missing"))),
		sourceMissingAt: v.optional(v.number()),
		possibleDuplicateOf: v.optional(v.id("readingAnnotations")),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_document_sourceKey", ["documentId", "sourceKey"])
		.index("by_document_sourceFingerprint", ["documentId", "sourceFingerprint"])
		.index("by_user_status_updatedAt", ["userId", "status", "updatedAt"])
		.index("by_user_updatedAt", ["userId", "updatedAt"]),
	readingSyncRuns: defineTable({
		userId: v.id("users"),
		trigger: v.union(v.literal("manual"), v.literal("automatic")),
		status: v.union(
			v.literal("running"),
			v.literal("completed"),
			v.literal("partial"),
			v.literal("failed"),
		),
		startedAt: v.number(),
		finishedAt: v.optional(v.number()),
		processedDocuments: v.number(),
		changedDocuments: v.number(),
		skippedFiles: v.number(),
		errors: v.array(
			v.object({
				path: v.string(),
				message: v.string(),
			}),
		),
	})
		.index("by_user_startedAt", ["userId", "startedAt"])
		.index("by_user_status_startedAt", ["userId", "status", "startedAt"]),
	ideas: defineTable({
		userId: v.id("users"),
		relativePath: v.string(),
		title: v.string(),
		contentHash: v.string(),
		fileModifiedAt: v.optional(v.number()),
		reviewDueAt: v.optional(v.number()),
		reviewedAt: v.optional(v.number()),
		reviewCard: v.optional(
			v.object({
				due: v.number(),
				stability: v.number(),
				difficulty: v.number(),
				elapsedDays: v.number(),
				scheduledDays: v.number(),
				learningSteps: v.number(),
				reps: v.number(),
				lapses: v.number(),
				state: v.number(),
				lastReview: v.optional(v.number()),
			}),
		),
		reviewLogs: v.optional(
			v.array(
				v.object({
					rating: v.number(),
					state: v.number(),
					due: v.number(),
					stability: v.number(),
					difficulty: v.number(),
					elapsedDays: v.number(),
					lastElapsedDays: v.number(),
					scheduledDays: v.number(),
					learningSteps: v.number(),
					review: v.number(),
				}),
			),
		),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_user_path", ["userId", "relativePath"])
		.index("by_user_updatedAt", ["userId", "updatedAt"])
		.index("by_user_reviewDueAt", ["userId", "reviewDueAt"]),
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
