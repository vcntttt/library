import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	type MutationCtx,
} from "./_generated/server";
import { getMetadataDetails } from "../src/lib/metadata/providers";
import {
	mergeAcknowledgedMangaMetadata,
	mergeMangaMetadata,
	nextReadProgress,
	type MangaReleasePayload,
} from "./lib/notifications";
import { syncMangaProgressTotal } from "./lib/obras";
import { mangaChapterSourceValidator, notificationStatusValidator } from "./lib/validators";

const DEFAULT_POLL_LIMIT = 10;
const MAX_POLL_LIMIT = 50;
const TRACKED_MANGA_TYPES = ["manga", "manhwa"] as const;
const TRACKED_MANGA_STATUSES = [
	"in-progress",
	"backlog",
	"finished",
	"paused",
	"hiatus",
] as const;

export const checkForNewChapters = internalAction({
	args: {},
	handler: async (ctx) => {
		const tracked = await ctx.runQuery(internal.notifications.listTrackedManga, {});
		let checked = 0;
		let updated = 0;
		let enqueued = 0;

		for (const obra of tracked) {
			if (!obra.externalId) continue;
			checked += 1;

			try {
			const details = await getMetadataDetails(
				"anilist",
				obra.externalId,
				obra.type,
			);
				const merged = mergeMangaMetadata(obra.metadata, details);
				const progressTotal = syncMangaProgressTotal(
					obra.progressTotal,
					merged,
					obra.type,
				);
				await ctx.runMutation(internal.notifications.recordMangaCheck, {
					obraId: obra._id,
					metadata: merged,
					progressTotal,
				});
				updated += 1;

				const latestChapter = merged.latestChapter;
				const lastNotifiedChapter = obra.metadata?.lastNotifiedChapter ?? 0;
				if (!latestChapter || latestChapter <= lastNotifiedChapter) continue;
				if (obra.status === "paused") continue;

				const result = await ctx.runMutation(
					internal.notifications.enqueueReleaseNotification,
					{
						payload: {
							type: "manga.release",
							eventId: `${obra._id}:${latestChapter}`,
							obraId: obra._id,
							anilistId: obra.externalId,
							title: obra.title,
							chapter: latestChapter,
							source: merged.latestChapterSource ?? "anilist",
							url: obra.readingUrl,
							detectedAt: Date.now(),
						},
					},
				);
				if (result.enqueued) enqueued += 1;
			} catch (error) {
				console.error("[manga-worker] check failed", {
					obraId: obra._id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return { checked, updated, enqueued };
	},
});

export const pull = mutation({
	args: { secret: v.string(), limit: v.optional(v.number()) },
	handler: async (ctx, { secret, limit }) => {
		assertAlfredSecret(secret);
		const safeLimit = Math.max(
			1,
			Math.min(Math.floor(limit ?? DEFAULT_POLL_LIMIT), MAX_POLL_LIMIT),
		);
		const rows = await ctx.db
			.query("notificationEvents")
			.withIndex("by_status_createdAt", (q) => q.eq("status", "pending"))
			.order("asc")
			.take(safeLimit);

		const now = Date.now();
		const events = [];

		for (const row of rows) {
			const attempts = row.attempts + 1;
			await ctx.db.patch(row._id, {
				attempts,
				lastAttemptAt: now,
				updatedAt: now,
			});
			events.push({
				eventId: row.eventId,
				attempts,
				lastAttemptAt: now,
				payload: toPayload(row),
			});
		}

		return { events };
	},
});

export const ack = mutation({
	args: {
		secret: v.string(),
		eventId: v.string(),
		status: notificationStatusValidator,
		error: v.optional(v.string()),
	},
	handler: async (ctx, { secret, eventId, status, error }) => {
		assertAlfredSecret(secret);
		const event = await findEventByEventId(ctx, eventId);
		if (!event) return { ok: false, reason: "not_found" as const };

		const now = Date.now();
		if (status === "failed") {
			await ctx.db.patch(event._id, {
				status: "pending",
				lastError: error?.trim() || "error-desconocido",
				updatedAt: now,
			});
			return { ok: true, status: "pending" as const };
		}

		await ctx.db.patch(event._id, {
			status: "delivered",
			deliveredAt: now,
			lastError: undefined,
			updatedAt: now,
		});

		const obra = await ctx.db.get(event.obraId);
		if (obra) {
			const metadata = mergeAcknowledgedMangaMetadata(
				obra.metadata,
				event.chapter,
				now,
			);
			const progressTotal = syncMangaProgressTotal(
				obra.progressTotal,
				metadata,
				obra.type,
			);
			await ctx.db.patch(obra._id, {
				metadata,
				progressTotal,
				updatedAt: now,
			});
		}

		return { ok: true, status: "delivered" as const };
	},
});

export const markRead = mutation({
	args: { secret: v.string(), eventId: v.string() },
	handler: async (ctx, { secret, eventId }) => {
		assertAlfredSecret(secret);
		const event = await findEventByEventId(ctx, eventId);
		if (!event) {
			return {
				ok: false,
				reason: "not_found" as const,
				message: "Notificacion no encontrada.",
			};
		}

		const obra = await ctx.db.get(event.obraId);
		if (!obra) {
			return {
				ok: false,
				reason: "obra_not_found" as const,
				message: "Obra no encontrada.",
			};
		}

		if (obra.type !== "manga" && obra.type !== "manhwa") {
			return {
				ok: false,
				reason: "not_manga" as const,
				message: "La obra no es un manga.",
			};
		}

		const progress = nextReadProgress({
			currentProgress: obra.progressCurrent,
			currentTotal: obra.progressTotal,
			chapter: event.chapter,
		});

		await ctx.db.patch(obra._id, {
			progressCurrent: progress.progressCurrent,
			progressTotal: progress.progressTotal,
			updatedAt: Date.now(),
		});

		return {
			ok: true,
			eventId: event.eventId,
			obraId: event.obraId,
			chapter: event.chapter,
			progressCurrent: progress.progressCurrent,
			alreadyRead: progress.alreadyRead,
		};
	},
});

export const listTrackedManga = internalQuery({
	args: {},
	handler: async (ctx) => {
		const tracked = await Promise.all(
			TRACKED_MANGA_TYPES.flatMap((type) =>
				TRACKED_MANGA_STATUSES.map((status) =>
					ctx.db
						.query("obras")
						.withIndex("by_manga_tracking", (q) =>
							(q as any)
								.eq("type", type)
								.eq("status", status)
								.eq("externalSource", "anilist"),
						)
						.collect(),
				),
			),
		);
		return tracked.flat();
	},
});

export const recordMangaCheck = internalMutation({
	args: {
		obraId: v.id("obras"),
		metadata: v.any(),
		progressTotal: v.optional(v.number()),
	},
	handler: async (ctx, { obraId, metadata, progressTotal }) => {
		await ctx.db.patch(obraId, {
			metadata,
			progressTotal,
			updatedAt: Date.now(),
		});
	},
});

export const enqueueReleaseNotification = internalMutation({
	args: {
		payload: v.object({
			type: v.literal("manga.release"),
			eventId: v.string(),
			obraId: v.id("obras"),
			anilistId: v.string(),
			title: v.string(),
			chapter: v.number(),
			source: mangaChapterSourceValidator,
			url: v.optional(v.string()),
			detectedAt: v.number(),
		}),
	},
	handler: async (ctx, { payload }) => {
		const existing = await findEventByEventId(ctx, payload.eventId);
		if (existing) return { enqueued: false, eventId: existing.eventId };

		const now = Date.now();
		await ctx.db.insert("notificationEvents", {
			eventType: payload.type,
			eventId: payload.eventId,
			obraId: payload.obraId,
			anilistId: payload.anilistId,
			title: payload.title,
			chapter: payload.chapter,
			source: payload.source,
			url: payload.url,
			detectedAt: payload.detectedAt,
			status: "pending",
			attempts: 0,
			createdAt: now,
			updatedAt: now,
		});
		return { enqueued: true, eventId: payload.eventId };
	},
});

async function findEventByEventId(ctx: MutationCtx, eventId: string) {
	return await ctx.db
		.query("notificationEvents")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.first();
}

function toPayload(row: Doc<"notificationEvents">): MangaReleasePayload {
	return {
		type: "manga.release",
		eventId: row.eventId,
		obraId: row.obraId,
		anilistId: row.anilistId,
		title: row.title,
		chapter: row.chapter,
		source: row.source,
		url: row.url,
		detectedAt: row.detectedAt,
	};
}

function assertAlfredSecret(secret: string) {
	const expected = process.env.ALFRED_NOTIFY_SECRET;
	if (!expected) throw new Error("Falta ALFRED_NOTIFY_SECRET.");
	if (secret !== expected) throw new Error("No autorizado.");
}
