import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	type ActionCtx,
	type MutationCtx,
} from "./_generated/server";
import {
	getMangaReadingUrlDetails,
	getMetadataDetails,
} from "../src/lib/metadata/providers";
import {
	getNewEpisodeRelease,
	mergeAcknowledgedEpisodeMetadata,
	mergeAcknowledgedMangaMetadata,
	mergeEpisodicMetadata,
	mergeMangaMetadata,
	nextReadProgress,
	type ReleasePayload,
} from "./lib/notifications";
import {
	shouldReopenFinishedProgress,
	syncMangaProgressTotal,
	syncProgressTotal,
} from "./lib/obras";
import {
	mangaChapterSourceValidator,
	notificationStatusValidator,
} from "./lib/validators";
import { mergeSeasons } from "../src/lib/season-progress";

const DEFAULT_POLL_LIMIT = 10;
const MAX_POLL_LIMIT = 50;
const EVENT_LEASE_MS = 2 * 60 * 1000;
const TRACKING_BATCH_SIZE = 50;
const LEGACY_BACKFILL_BATCH_SIZE = 50;
const TRACKED_MANGA_TYPES = ["manga", "manhwa"] as const;
const TRACKED_MANGA_STATUSES = [
	"in-progress",
	"backlog",
	"finished",
	"paused",
	"hiatus",
] as const;
const TRACKED_METADATA_SOURCES = ["anilist", "manhwaweb"] as const;
type TrackedMetadataSource = (typeof TRACKED_METADATA_SOURCES)[number];
const TRACKED_EPISODIC_TYPES = ["series", "anime"] as const;
const TRACKED_EPISODIC_STATUSES = TRACKED_MANGA_STATUSES;
type NotificationWorker = "manga" | "episodic" | "legacy-events";

export const checkForNewChapters = internalAction({
	args: {},
	handler: async (ctx) => {
		const notificationUser = await resolveNotificationUser(ctx);
		if (!notificationUser) {
			return { checked: 0, updated: 0, enqueued: 0, disabled: true };
		}
		const tracked = await ctx.runMutation(
			internal.notifications.takeTrackedBatch,
			{ userId: notificationUser._id, worker: "manga" },
		);
		let checked = 0;
		let updated = 0;
		let enqueued = 0;

		for (const obra of tracked) {
			if (!obra.externalId) continue;
			if (obra.type !== "manga" && obra.type !== "manhwa") continue;
			checked += 1;

			try {
				const source = getTrackedMetadataSource(obra.externalSource);
				const details =
					(await getMangaReadingUrlDetails(
						obra.sourceUrl ?? obra.readingUrl,
						obra.type,
					)) ?? (await getMetadataDetails(source, obra.externalId, obra.type));
				const recorded = await ctx.runMutation(
					internal.notifications.recordMangaCheck,
					{
						obraId: obra._id,
						expectedExternalId: obra.externalId,
						expectedType: obra.type,
						expectedExternalSource: getTrackedMetadataSource(
							obra.externalSource,
						),
						details,
					},
				);
				if (!recorded.recorded) continue;
				updated += 1;

				const latestChapter = recorded.metadata.latestChapter;
				const lastNotifiedChapter = recorded.lastNotifiedChapter;
				if (!latestChapter || latestChapter <= lastNotifiedChapter) continue;
				if (recorded.status === "paused") continue;

				const result = await ctx.runMutation(
					internal.notifications.enqueueReleaseNotification,
					{
						expectedType: obra.type,
						expectedExternalSource: getTrackedMetadataSource(
							obra.externalSource,
						),
						payload: {
							type: "manga.release",
							eventId: `${obra._id}:${latestChapter}`,
							obraId: obra._id,
							anilistId: obra.externalId,
							title: obra.title,
							chapter: latestChapter,
							source: recorded.metadata.latestChapterSource ?? source,
							url:
								obra.readingUrl ??
								obra.sourceUrl ??
								recorded.metadata.canonicalUrl,
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

export const checkForNewEpisodes = internalAction({
	args: {},
	handler: async (ctx) => {
		const notificationUser = await resolveNotificationUser(ctx);
		if (!notificationUser) {
			return { checked: 0, updated: 0, enqueued: 0, disabled: true };
		}
		const tracked = await ctx.runMutation(
			internal.notifications.takeTrackedBatch,
			{ userId: notificationUser._id, worker: "episodic" },
		);
		let checked = 0;
		let updated = 0;
		let enqueued = 0;

		for (const obra of tracked) {
			if (!obra.externalId) continue;
			if (obra.type !== "series" && obra.type !== "anime") continue;
			checked += 1;

			try {
				const source = obra.type === "series" ? "tmdb" : "anilist";
				const details = await getMetadataDetails(
					source,
					obra.externalId,
					obra.type,
					true,
				);
				const recorded = await ctx.runMutation(
					internal.notifications.recordEpisodicCheck,
					{
						obraId: obra._id,
						expectedExternalId: obra.externalId,
						expectedType: obra.type,
						expectedExternalSource: source,
						details,
					},
				);
				if (!recorded.recorded) continue;
				updated += 1;

				const releasedEpisode = recorded.releasedEpisode;
				if (!releasedEpisode || recorded.status === "paused") continue;
				const result = await ctx.runMutation(
					internal.notifications.enqueueReleaseNotification,
					{
						expectedType: obra.type,
						expectedExternalSource: source,
						payload: {
							type: "media.episode.release",
							eventId: `${obra._id}:episode:${releasedEpisode}`,
							obraId: obra._id,
							externalId: obra.externalId,
							title: obra.title,
							episode: releasedEpisode,
							seasonNumber: recorded.metadata.latestSeasonNumber,
							episodeNumber: recorded.metadata.latestEpisodeNumber,
							source,
							url: obra.sourceUrl ?? obra.readingUrl,
							detectedAt: Date.now(),
						},
					},
				);
				if (result.enqueued) enqueued += 1;
			} catch (error) {
				console.error("[episode-worker] check failed", {
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
		const notificationUserId = await requireNotificationUserId(ctx);
		const safeLimit = Math.max(
			1,
			Math.min(Math.floor(limit ?? DEFAULT_POLL_LIMIT), MAX_POLL_LIMIT),
		);
		await backfillLegacyEventOwners(ctx, notificationUserId);
		const now = Date.now();
		const processingRows = await ctx.db
			.query("notificationEvents")
			.withIndex("by_user_status_createdAt", (q) =>
				q.eq("userId", notificationUserId).eq("status", "processing"),
			)
			.order("asc")
			.take(MAX_POLL_LIMIT * 4);
		for (const row of processingRows) {
			if ((row.leaseExpiresAt ?? 0) <= now) {
				await ctx.db.patch(row._id, {
					status: "pending",
					leaseExpiresAt: undefined,
					updatedAt: now,
				});
			}
		}

		const candidates = await ctx.db
			.query("notificationEvents")
			.withIndex("by_user_status_createdAt", (q) =>
				q.eq("userId", notificationUserId).eq("status", "pending"),
			)
			.order("asc")
			.take(safeLimit);

		const events = [];

		for (const row of candidates) {
			const attempts = row.attempts + 1;
			await ctx.db.patch(row._id, {
				status: "processing",
				attempts,
				lastAttemptAt: now,
				leaseExpiresAt: now + EVENT_LEASE_MS,
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
		const notificationUserId = await requireNotificationUserId(ctx);
		if (!(await eventBelongsToUser(ctx, event, notificationUserId))) {
			return { ok: false, reason: "not_found" as const };
		}

		const now = Date.now();
		if (status === "failed") {
			await ctx.db.patch(event._id, {
				status: "pending",
				leaseExpiresAt: undefined,
				lastError: error?.trim() || "error-desconocido",
				updatedAt: now,
			});
			return { ok: true, status: "pending" as const };
		}

		await ctx.db.patch(event._id, {
			status: "delivered",
			leaseExpiresAt: undefined,
			deliveredAt: now,
			lastError: undefined,
			updatedAt: now,
		});

		const obra = await ctx.db.get(event.obraId);
		if (obra) {
			const metadata =
				event.eventType === "media.episode.release" &&
				event.episode !== undefined
					? mergeAcknowledgedEpisodeMetadata(
							obra.metadata,
							event.episode,
							now,
						)
					: mergeAcknowledgedMangaMetadata(
							obra.metadata,
							event.chapter ?? 0,
							now,
						);
			const progressTotal =
				event.eventType === "manga.release"
					? syncMangaProgressTotal(
							obra.progressTotal,
							metadata,
							obra.type,
						)
					: obra.progressTotal;
			const shouldReopen = shouldReopenFinishedProgress({
				status: obra.status,
				explicitlyFinishing: false,
				trackingChanged: true,
				progress:
					progressTotal === undefined
						? undefined
						: {
								current: obra.progressCurrent ?? 0,
								total: progressTotal,
							},
			});
			await ctx.db.patch(obra._id, {
				metadata,
				progressTotal,
				status: shouldReopen ? "in-progress" : obra.status,
				finishedAt: shouldReopen ? undefined : obra.finishedAt,
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
		const notificationUserId = await requireNotificationUserId(ctx);
		if (!(await eventBelongsToUser(ctx, event, notificationUserId))) {
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

		if (
			event.eventType !== "manga.release" ||
			(obra.type !== "manga" && obra.type !== "manhwa") ||
			event.chapter === undefined
		) {
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

export const takeTrackedBatch = internalMutation({
	args: {
		userId: v.id("users"),
		worker: v.union(v.literal("manga"), v.literal("episodic")),
	},
	handler: async (ctx, { userId, worker }) => {
		const state = await findWorkerState(ctx, userId, worker);
		const result = await ctx.db
			.query("obras")
			.withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
			.order("asc")
			.paginate({
				cursor: state?.cursor ?? null,
				numItems: TRACKING_BATCH_SIZE,
			});
		await saveWorkerCursor(
			ctx,
			userId,
			worker,
			result.isDone ? undefined : result.continueCursor,
		);
		return result.page.filter((obra) =>
			worker === "manga"
				? isTrackedManga(obra)
				: isTrackedEpisodic(obra),
		);
	},
});

export const getNotificationUserByEmail = internalQuery({
	args: { email: v.string() },
	handler: async (ctx, { email }) => {
		return await ctx.db
			.query("users")
			.withIndex("email", (q) => q.eq("email", email))
			.first();
	},
});

export const recordMangaCheck = internalMutation({
	args: {
		obraId: v.id("obras"),
		expectedExternalId: v.string(),
		expectedType: v.union(v.literal("manga"), v.literal("manhwa")),
		expectedExternalSource: v.union(
			v.literal("anilist"),
			v.literal("manhwaweb"),
		),
		details: v.any(),
	},
	handler: async (
		ctx,
		{
			obraId,
			expectedExternalId,
			expectedType,
			expectedExternalSource,
			details,
		},
	) => {
		const obra = await ctx.db.get(obraId);
		if (!obra) throw new Error("Obra no encontrada.");
		if (
			obra.externalId !== expectedExternalId ||
			obra.type !== expectedType ||
			obra.externalSource !== expectedExternalSource
		) {
			return { recorded: false as const, status: obra.status };
		}
		const lastNotifiedChapter = obra.metadata?.lastNotifiedChapter ?? 0;
		const metadata = mergeMangaMetadata(obra.metadata, details);
		const progressTotal = syncMangaProgressTotal(
			obra.progressTotal,
			metadata,
			obra.type,
		);
		const shouldReopen = shouldReopenFinishedProgress({
			status: obra.status,
			explicitlyFinishing: false,
			trackingChanged: true,
			progress:
				progressTotal === undefined
					? undefined
					: {
							current: obra.progressCurrent ?? 0,
							total: progressTotal,
						},
		});
		await ctx.db.patch(obraId, {
			metadata,
			progressTotal,
			status: shouldReopen ? "in-progress" : obra.status,
			finishedAt: shouldReopen ? undefined : obra.finishedAt,
			updatedAt: Date.now(),
		});
		return {
			recorded: true as const,
			status: obra.status,
			metadata,
			progressTotal,
			lastNotifiedChapter,
		};
	},
});

export const recordEpisodicCheck = internalMutation({
	args: {
		obraId: v.id("obras"),
		expectedExternalId: v.string(),
		expectedType: v.union(v.literal("series"), v.literal("anime")),
		expectedExternalSource: v.union(
			v.literal("tmdb"),
			v.literal("anilist"),
		),
		details: v.any(),
	},
	handler: async (
		ctx,
		{
			obraId,
			expectedExternalId,
			expectedType,
			expectedExternalSource,
			details,
		},
	) => {
		const obra = await ctx.db.get(obraId);
		if (!obra) throw new Error("Obra no encontrada.");
		if (
			obra.externalId !== expectedExternalId ||
			obra.type !== expectedType ||
			obra.externalSource !== expectedExternalSource
		) {
			return { recorded: false as const, status: obra.status };
		}
		const metadata = mergeEpisodicMetadata(obra.metadata, details);
		const releasedEpisode = getNewEpisodeRelease(obra.metadata, metadata);
		const progressSeasons = mergeSeasons(
			obra.progressSeasons ?? [],
			details.seasonDetails ?? [],
		);
		const progressTotal = syncProgressTotal(
			obra.progressTotal,
			metadata,
			obra.type,
			{ progressSeasons },
		);
		const shouldReopen = shouldReopenFinishedProgress({
			status: obra.status,
			explicitlyFinishing: false,
			trackingChanged: true,
			progress:
				progressTotal === undefined
					? undefined
					: {
							current: obra.progressCurrent ?? 0,
							total: progressTotal,
						},
		});
		await ctx.db.patch(obraId, {
			metadata,
			progressTotal,
			progressSeasons:
				progressSeasons.length > 0 ? progressSeasons : obra.progressSeasons,
			status: shouldReopen ? "in-progress" : obra.status,
			finishedAt: shouldReopen ? undefined : obra.finishedAt,
			updatedAt: Date.now(),
		});
		return {
			recorded: true as const,
			status: obra.status,
			metadata,
			progressTotal,
			progressSeasons,
			releasedEpisode,
		};
	},
});

export const enqueueReleaseNotification = internalMutation({
	args: {
		expectedType: v.union(
			v.literal("manga"),
			v.literal("manhwa"),
			v.literal("series"),
			v.literal("anime"),
		),
		expectedExternalSource: v.union(
			v.literal("anilist"),
			v.literal("manhwaweb"),
			v.literal("tmdb"),
		),
		payload: v.union(
			v.object({
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
			v.object({
				type: v.literal("media.episode.release"),
				eventId: v.string(),
				obraId: v.id("obras"),
				externalId: v.string(),
				title: v.string(),
				episode: v.number(),
				seasonNumber: v.optional(v.number()),
				episodeNumber: v.optional(v.number()),
				source: v.union(v.literal("tmdb"), v.literal("anilist")),
				url: v.optional(v.string()),
				detectedAt: v.number(),
			}),
		),
	},
	handler: async (
		ctx,
		{ expectedType, expectedExternalSource, payload },
	) => {
		const existing = await findEventByEventId(ctx, payload.eventId);
		if (existing) return { enqueued: false, eventId: existing.eventId };
		const obra = await ctx.db.get(payload.obraId);
		if (!obra) throw new Error("Obra no encontrada.");
		const expectedExternalId =
			payload.type === "media.episode.release"
				? payload.externalId
				: payload.anilistId;
		if (
			obra.status === "paused" ||
			obra.type !== expectedType ||
			obra.externalId !== expectedExternalId ||
			obra.externalSource !== expectedExternalSource
		) {
			return { enqueued: false, eventId: payload.eventId };
		}

		const now = Date.now();
		await ctx.db.insert("notificationEvents", {
			eventType: payload.type,
			eventId: payload.eventId,
			obraId: payload.obraId,
			userId: obra.userId,
			anilistId:
				payload.type === "manga.release" ? payload.anilistId : undefined,
			externalId:
				payload.type === "media.episode.release"
					? payload.externalId
					: undefined,
			title: obra.title,
			chapter:
				payload.type === "manga.release" ? payload.chapter : undefined,
			episode:
				payload.type === "media.episode.release"
					? payload.episode
					: undefined,
			seasonNumber:
				payload.type === "media.episode.release"
					? payload.seasonNumber
					: undefined,
			episodeNumber:
				payload.type === "media.episode.release"
					? payload.episodeNumber
					: undefined,
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

function toPayload(row: Doc<"notificationEvents">): ReleasePayload {
	if (row.eventType === "media.episode.release") {
		if (!row.externalId || row.episode === undefined) {
			throw new Error("Evento de episodio inválido.");
		}
		return {
			type: row.eventType,
			eventId: row.eventId,
			obraId: row.obraId,
			externalId: row.externalId,
			title: row.title,
			episode: row.episode,
			seasonNumber: row.seasonNumber,
			episodeNumber: row.episodeNumber,
			source: row.source === "tmdb" ? "tmdb" : "anilist",
			url: row.url,
			detectedAt: row.detectedAt,
		};
	}
	if (!row.anilistId || row.chapter === undefined || row.source === "tmdb") {
		throw new Error("Evento de manga inválido.");
	}
	return {
		type: row.eventType,
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

function getTrackedMetadataSource(
	source: Doc<"obras">["externalSource"],
): TrackedMetadataSource {
	return source === "manhwaweb" ? "manhwaweb" : "anilist";
}

function isTrackedManga(obra: Doc<"obras">) {
	return (
		TRACKED_MANGA_TYPES.some((type) => type === obra.type) &&
		TRACKED_MANGA_STATUSES.some((status) => status === obra.status) &&
		TRACKED_METADATA_SOURCES.some(
			(source) => source === obra.externalSource,
		)
	);
}

function isTrackedEpisodic(obra: Doc<"obras">) {
	return (
		TRACKED_EPISODIC_TYPES.some((type) => type === obra.type) &&
		TRACKED_EPISODIC_STATUSES.some((status) => status === obra.status) &&
		((obra.type === "series" && obra.externalSource === "tmdb") ||
			(obra.type === "anime" && obra.externalSource === "anilist"))
	);
}

async function findWorkerState(
	ctx: MutationCtx,
	userId: Id<"users">,
	worker: NotificationWorker,
) {
	return await ctx.db
		.query("notificationWorkerState")
		.withIndex("by_user_worker", (q) =>
			q.eq("userId", userId).eq("worker", worker),
		)
		.unique();
}

async function saveWorkerCursor(
	ctx: MutationCtx,
	userId: Id<"users">,
	worker: NotificationWorker,
	cursor: string | undefined,
) {
	const state = await findWorkerState(ctx, userId, worker);
	const patch = { cursor, updatedAt: Date.now() };
	if (state) {
		await ctx.db.patch(state._id, patch);
		return;
	}
	await ctx.db.insert("notificationWorkerState", {
		userId,
		worker,
		...patch,
	});
}

async function backfillLegacyEventOwners(
	ctx: MutationCtx,
	userId: Id<"users">,
) {
	const state = await findWorkerState(ctx, userId, "legacy-events");
	const result = await ctx.db
		.query("notificationEvents")
		.order("asc")
		.paginate({
			cursor: state?.cursor ?? null,
			numItems: LEGACY_BACKFILL_BATCH_SIZE,
		});
	for (const event of result.page) {
		if (event.userId) continue;
		const obra = await ctx.db.get(event.obraId);
		if (obra) await ctx.db.patch(event._id, { userId: obra.userId });
	}
	await saveWorkerCursor(
		ctx,
		userId,
		"legacy-events",
		result.isDone ? undefined : result.continueCursor,
	);
}

async function requireNotificationUserId(ctx: MutationCtx) {
	const email = process.env.ALFRED_NOTIFY_USER_EMAIL?.trim();
	if (!email) {
		throw new Error("Falta ALFRED_NOTIFY_USER_EMAIL.");
	}
	const user = await ctx.db
		.query("users")
		.withIndex("email", (q) => q.eq("email", email))
		.first();
	if (!user) throw new Error("Usuario de notificaciones no encontrado.");
	return user._id;
}

async function eventBelongsToUser(
	ctx: MutationCtx,
	event: Doc<"notificationEvents">,
	userId: Id<"users">,
) {
	if (event.userId) return event.userId === userId;
	const obra = await ctx.db.get(event.obraId);
	return obra?.userId === userId;
}

async function resolveNotificationUser(ctx: ActionCtx) {
	const email = process.env.ALFRED_NOTIFY_USER_EMAIL?.trim();
	if (!email) {
		console.error(
			"[release-worker] ALFRED_NOTIFY_USER_EMAIL no está configurado; se omiten notificaciones para proteger datos multiusuario.",
		);
		return null;
	}
	const user = await ctx.runQuery(
		internal.notifications.getNotificationUserByEmail,
		{ email },
	);
	if (!user) {
		console.error("[release-worker] usuario de notificaciones no encontrado", {
			email,
		});
		return null;
	}
	return user;
}
