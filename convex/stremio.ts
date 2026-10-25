import { getAuthUserId } from "@convex-dev/auth/server";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { getMetadataDetails } from "../src/lib/metadata/providers";
import type { Doc, Id } from "./_generated/dataModel";
import {
	type ActionCtx,
	action,
	internalAction,
	internalMutation,
	internalQuery,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import {
	getImdbId,
	getImportedStatus,
	mergeImportedProgress,
	mergeImportedWatchMetadata,
	parseStremioEntries,
	parseStremioItems,
	sanitizedStremioError,
	shouldImportStremioItem,
	stremioItemHasStarted,
} from "./lib/stremio";
import { countWatchedEpisodes, type StremioVideo } from "./lib/stremioProgress";

const HOUR = 60 * 60 * 1000;
const COOLDOWN = 15 * 60 * 1000;
const CONNECT_FAILURE_COOLDOWN = 30 * 1000;
const LEASE = 12 * 60 * 1000;
const BATCH = 50;
const MAX_ENTRIES = 100;
const mediaPayload = v.object({
	type: v.union(v.literal("movie"), v.literal("series")),
	imdbId: v.string(),
	stremioId: v.string(),
	mtime: v.number(),
	name: v.string(),
	position: v.optional(v.number()),
	videoId: v.optional(v.string()),
	watchedMovie: v.boolean(),
	progressCurrent: v.optional(v.number()),
	progressTotal: v.optional(v.number()),
	progressSeasons: v.optional(
		v.array(v.object({ seasonNumber: v.number(), episodeCount: v.number() })),
	),
	metadata: v.object({
		title: v.string(),
		year: v.optional(v.number()),
		poster: v.optional(v.string()),
		tmdbId: v.string(),
		seasons: v.optional(v.number()),
		episodes: v.optional(v.number()),
		watchProviders: v.array(v.string()),
		status: v.optional(v.string()),
	}),
});

const beginConnectRef = makeFunctionReference<
	"mutation",
	{ userId: Id<"users"> },
	number
>("stremio:beginConnect");
const completeConnectRef = makeFunctionReference<
	"mutation",
	{ userId: Id<"users">; version: number; email: string; authKey: string },
	boolean
>("stremio:completeConnect");
const failConnectRef = makeFunctionReference<
	"mutation",
	{
		userId: Id<"users">;
		version: number;
		message: string;
		retryAfter?: number;
	},
	null
>("stremio:failConnect");
const claimSyncRef = makeFunctionReference<
	"mutation",
	{ userId: Id<"users">; force: boolean; expectedVersion?: number },
	{
		authKey: string;
		version: number;
		checkpointMtime?: number;
		checkpointId?: string;
	} | null
>("stremio:claimSync");
const finishSyncRef = makeFunctionReference<
	"mutation",
	{
		userId: Id<"users">;
		version: number;
		checkpointMtime?: number;
		checkpointId?: string;
		message?: string;
		retryAfter?: number;
	},
	null
>("stremio:finishSync");
const checkpointRef = makeFunctionReference<
	"mutation",
	{ userId: Id<"users">; version: number; mtime: number; stremioId: string },
	null
>("stremio:checkpoint");
type ImportedMedia = {
	type: "movie" | "series";
	imdbId: string;
	stremioId: string;
	mtime: number;
	name: string;
	position?: number;
	videoId?: string;
	watchedMovie: boolean;
	progressCurrent?: number;
	progressTotal?: number;
	progressSeasons?: { seasonNumber: number; episodeCount: number }[];
	metadata: {
		title: string;
		year?: number;
		poster?: string;
		tmdbId: string;
		seasons?: number;
		episodes?: number;
		watchProviders: string[];
		status?: string;
	};
};
const applyItemRef = makeFunctionReference<
	"mutation",
	{ userId: Id<"users">; version: number; item: ImportedMedia },
	boolean
>("stremio:applyItem");
const syncUserRef = makeFunctionReference<
	"action",
	{ userId: Id<"users">; force: boolean; expectedVersion?: number },
	null
>("stremio:syncUser");

const pendingRef = makeFunctionReference<
	"query",
	{ userId: Id<"users">; version: number },
	{ id: string; mtime: number }[]
>("stremio:pendingItems");
const setPendingRef = makeFunctionReference<
	"mutation",
	{
		userId: Id<"users">;
		version: number;
		id: string;
		mtime: number;
		pending: boolean;
	},
	null
>("stremio:setPending");

export const pendingItems = internalQuery({
	args: { userId: v.id("users"), version: v.number() },
	returns: v.array(v.object({ id: v.string(), mtime: v.number() })),
	handler: async (ctx, { userId, version }) => {
		const row = await connection(ctx, userId);
		if (!row?.authKey || row.version !== version) return [];
		const pending = await ctx.db
			.query("stremioPending")
			.withIndex("by_user_email_retry", (q) =>
				q
					.eq("userId", userId)
					.eq("email", row.email)
					.lte("nextRetryAt", Date.now()),
			)
			.take(10);
		return pending.map((item) => ({ id: item.stremioId, mtime: item.mtime }));
	},
});

export const setPending = internalMutation({
	args: {
		userId: v.id("users"),
		version: v.number(),
		id: v.string(),
		mtime: v.number(),
		pending: v.boolean(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const row = await connection(ctx, args.userId);
		if (!row?.authKey || row.version !== args.version) return null;
		const pending = await ctx.db
			.query("stremioPending")
			.withIndex("by_user_email_id", (q) =>
				q
					.eq("userId", args.userId)
					.eq("email", row.email)
					.eq("stremioId", args.id),
			)
			.unique();
		if (!args.pending) {
			if (pending) await ctx.db.delete(pending._id);
		} else {
			const values = { mtime: args.mtime, nextRetryAt: Date.now() + 6 * HOUR };
			if (pending) await ctx.db.patch(pending._id, values);
			else
				await ctx.db.insert("stremioPending", {
					userId: args.userId,
					email: row.email,
					stremioId: args.id,
					...values,
				});
		}
		return null;
	},
});

export const status = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			email: v.string(),
			lastSyncedAt: v.optional(v.number()),
			lastError: v.optional(v.string()),
			nextSyncAt: v.number(),
		}),
	),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const row = await ctx.db
			.query("stremioConnections")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		if (!row?.authKey || row.connecting) return null;
		const pending = await ctx.db
			.query("stremioPending")
			.withIndex("by_user_email_retry", (q) =>
				q.eq("userId", userId).eq("email", row.email),
			)
			.first();
		return {
			email: row.email,
			lastSyncedAt: row.lastSyncedAt,
			lastError:
				row.lastError ??
				(pending
					? "Algunas obras están pendientes de metadatos; volveremos a intentarlo."
					: undefined),
			nextSyncAt: row.nextSyncAt,
		};
	},
});

export const connect = action({
	args: { email: v.string(), password: v.string() },
	returns: v.null(),
	handler: async (ctx, { email, password }) => {
		const userId = await requireUserId(ctx);
		const normalizedEmail = email.trim().toLowerCase();
		if (
			!normalizedEmail ||
			normalizedEmail.length > 254 ||
			password.length < 1 ||
			password.length > 1024
		)
			throw new Error("Credenciales inválidas.");
		const version = await ctx.runMutation(beginConnectRef, { userId });
		try {
			const response = await stremioRequest("login", {
				email: normalizedEmail,
				password,
				type: "Login",
			});
			const result = isRecord(response) ? response.result : undefined;
			if (!isRecord(result) || typeof result.authKey !== "string")
				throw new Error(
					"Stremio rechazó la autenticación. Revisa las credenciales.",
				);
			const accepted = await ctx.runMutation(completeConnectRef, {
				userId,
				version,
				email: normalizedEmail,
				authKey: result.authKey,
			});
			if (accepted)
				await ctx.scheduler.runAfter(0, syncUserRef, {
					userId,
					force: false,
					expectedVersion: version,
				});
			return null;
		} catch (error) {
			const details = error instanceof StremioHttpError ? error : undefined;
			await ctx.runMutation(failConnectRef, {
				userId,
				version,
				message: safeError(error),
				retryAfter: details?.retryAfterMs,
			});
			throw new Error(safeError(error));
		}
	},
});

export const disconnect = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const row = await ctx.db
			.query("stremioConnections")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		if (row) {
			await ctx.db.patch(row._id, {
				authKey: undefined,
				connecting: false,
				leaseUntil: undefined,
				version: row.version + 1,
				nextSyncAt: Number.MAX_SAFE_INTEGER,
				updatedAt: Date.now(),
			});
		}
		return null;
	},
});

export const syncNow = action({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		return await ctx.runAction(syncUserRef, { userId, force: false });
	},
});

export const beginConnect = internalMutation({
	args: { userId: v.id("users") },
	returns: v.number(),
	handler: async (ctx, { userId }) => {
		const row = await connection(ctx, userId);
		const now = Date.now();
		if (row?.connecting && (row.leaseUntil ?? 0) > now)
			throw new Error("Ya hay una conexión con Stremio en curso.");
		if (row && (row.connectRetryAfter ?? 0) > now) {
			throw new Error("Espera antes de volver a conectar con Stremio.");
		}
		const version = (row?.version ?? 0) + 1;
		const values = {
			userId,
			email: row?.email ?? "",
			authKey: undefined,
			connecting: true,
			version,
			nextSyncAt: now + COOLDOWN,
			connectRetryAfter: undefined,
			leaseUntil: now + LEASE,
			updatedAt: now,
		};
		if (row) await ctx.db.patch(row._id, values);
		else await ctx.db.insert("stremioConnections", values);
		return version;
	},
});

export const completeConnect = internalMutation({
	args: {
		userId: v.id("users"),
		version: v.number(),
		email: v.string(),
		authKey: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const row = await connection(ctx, args.userId);
		if (row?.version !== args.version) return false;
		await ctx.db.patch(row._id, {
			email: args.email,
			checkpointMtime:
				row.email === args.email ? row.checkpointMtime : undefined,
			checkpointId: row.email === args.email ? row.checkpointId : undefined,
			authKey: args.authKey,
			connecting: false,
			leaseUntil: undefined,
			lastError: undefined,
			connectRetryAfter: undefined,
			nextSyncAt: Date.now(),
			updatedAt: Date.now(),
		});
		return true;
	},
});

export const failConnect = internalMutation({
	args: {
		userId: v.id("users"),
		version: v.number(),
		message: v.string(),
		retryAfter: v.optional(v.number()),
	},
	returns: v.null(),
	handler: async (ctx, { userId, version, message, retryAfter }) => {
		const row = await connection(ctx, userId);
		if (row?.version === version)
			await ctx.db.patch(row._id, {
				authKey: undefined,
				connecting: false,
				leaseUntil: undefined,
				lastError: message,
				nextSyncAt: Number.MAX_SAFE_INTEGER,
				connectRetryAfter:
					Date.now() + (retryAfter ?? CONNECT_FAILURE_COOLDOWN),
				updatedAt: Date.now(),
			});
		return null;
	},
});

export const claimSync = internalMutation({
	args: {
		userId: v.id("users"),
		force: v.boolean(),
		expectedVersion: v.optional(v.number()),
	},
	returns: v.union(
		v.null(),
		v.object({
			authKey: v.string(),
			version: v.number(),
			checkpointMtime: v.optional(v.number()),
			checkpointId: v.optional(v.string()),
		}),
	),
	handler: async (ctx, { userId, expectedVersion }) => {
		const row = await connection(ctx, userId);
		const now = Date.now();
		if (
			!row?.authKey ||
			row.connecting ||
			(row.leaseUntil ?? 0) > now ||
			row.nextSyncAt > now ||
			(expectedVersion !== undefined && row.version !== expectedVersion)
		)
			return null;
		await ctx.db.patch(row._id, {
			leaseUntil: now + LEASE,
			nextSyncAt: now + COOLDOWN,
			updatedAt: now,
		});
		return {
			authKey: row.authKey,
			version: row.version,
			checkpointMtime: row.checkpointMtime,
			checkpointId: row.checkpointId,
		};
	},
});

export const checkpoint = internalMutation({
	args: {
		userId: v.id("users"),
		version: v.number(),
		mtime: v.number(),
		stremioId: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, { userId, version, mtime, stremioId }) => {
		const row = await connection(ctx, userId);
		if (row?.version === version && (row.checkpointMtime ?? -1) <= mtime)
			await ctx.db.patch(row._id, {
				checkpointMtime: mtime,
				checkpointId: stremioId,
				updatedAt: Date.now(),
			});
		return null;
	},
});

export const finishSync = internalMutation({
	args: {
		userId: v.id("users"),
		version: v.number(),
		checkpointMtime: v.optional(v.number()),
		checkpointId: v.optional(v.string()),
		message: v.optional(v.string()),
		retryAfter: v.optional(v.number()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const row = await connection(ctx, args.userId);
		if (row?.version === args.version)
			await ctx.db.patch(row._id, {
				lastSyncedAt: args.message ? row.lastSyncedAt : Date.now(),
				lastError: args.message,
				checkpointMtime: args.checkpointMtime ?? row.checkpointMtime,
				checkpointId: args.checkpointId ?? row.checkpointId,
				leaseUntil: undefined,
				nextSyncAt: Date.now() + (args.retryAfter ?? HOUR),
				updatedAt: Date.now(),
			});
		return null;
	},
});

export const applyItem = internalMutation({
	args: { userId: v.id("users"), version: v.number(), item: mediaPayload },
	returns: v.boolean(),
	handler: async (ctx, { userId, version, item }) => {
		const connectionRow = await connection(ctx, userId);
		if (!connectionRow?.authKey || connectionRow.version !== version)
			return false;
		const imported = await ctx.db
			.query("stremioImports")
			.withIndex("by_user_type_imdb", (q) =>
				q.eq("userId", userId).eq("type", item.type).eq("imdbId", item.imdbId),
			)
			.unique();
		if (
			!shouldImportStremioItem(
				imported?.accountEmail === connectionRow.email
					? imported.mtime
					: undefined,
				item.mtime,
			)
		)
			return true;
		const linked = imported?.obraId ? await ctx.db.get(imported.obraId) : null;
		const ownedLink =
			linked?.userId === userId &&
			linked.type === item.type &&
			linked.externalSource === "tmdb" &&
			linked.externalId === item.metadata.tmdbId
				? linked
				: null;
		const existing =
			ownedLink ??
			(await ctx.db
				.query("obras")
				.withIndex("by_user_external_source_id_type", (q) =>
					q
						.eq("userId", userId)
						.eq("externalSource", "tmdb")
						.eq("externalId", item.metadata.tmdbId)
						.eq("type", item.type),
				)
				.first());
		let obraId = existing?._id;
		const now = Date.now();
		const canReplaceStatus =
			!existing ||
			(existing.status !== "paused" &&
				existing.status !== "dropped" &&
				existing.status !== "hiatus" &&
				existing.status !== "finished");
		const importedStatus = getImportedStatus(
			item.type,
			item.watchedMovie,
			item.metadata.status,
			item.progressCurrent,
			item.progressTotal,
		);
		const nextStatus =
			canReplaceStatus && importedStatus === "finished"
				? "finished"
				: canReplaceStatus
					? "in-progress"
					: (existing?.status ?? "in-progress");
		const progress = mergeImportedProgress(
			existing?.progressCurrent,
			existing?.progressTotal,
			item.type === "series" ? item.progressCurrent : undefined,
			item.type === "series" ? item.progressTotal : undefined,
		);
		const progressSeasons = mergeProgressSeasons(
			existing?.progressSeasons,
			item.progressSeasons,
		);
		if (existing) {
			const patch: Partial<Doc<"obras">> = {
				stremioMtime: item.mtime,
				stremioPosition: item.position,
				stremioVideoId: item.videoId,
				metadata: mergeImportedWatchMetadata(existing.metadata, item.metadata),
				updatedAt: now,
			};
			if (item.type === "series" && item.progressCurrent !== undefined) {
				patch.progressCurrent = progress.current;
				patch.progressTotal = progress.total;
				patch.progressSeasons = progressSeasons;
			}
			if (canReplaceStatus) {
				patch.status = nextStatus;
				patch.startedAt = existing.startedAt ?? now;
				if (nextStatus === "finished") {
					patch.finishedAt = existing.finishedAt ?? now;
					if (!existing.reviewStatus) {
						patch.reviewStatus = existing.review ? "completed" : "pending";
						if (!existing.review) patch.reviewRequestedAt = now;
					}
				}
			}
			await ctx.db.patch(existing._id, patch);
		} else {
			obraId = await ctx.db.insert("obras", {
				userId,
				title: item.metadata.title,
				type: item.type,
				status: nextStatus,
				tags: [],
				reviewStatus: nextStatus === "finished" ? "pending" : undefined,
				reviewRequestedAt: nextStatus === "finished" ? now : undefined,
				externalSource: "tmdb",
				externalId: item.metadata.tmdbId,
				year: item.metadata.year,
				coverUrl: item.metadata.poster,
				metadata: {
					seasons: item.metadata.seasons,
					episodes: item.metadata.episodes,
					watchProviders: item.metadata.watchProviders,
					status: item.metadata.status,
				},
				progressCurrent: item.type === "series" ? progress.current : undefined,
				progressTotal: item.type === "series" ? progress.total : undefined,
				progressSeasons: item.type === "series" ? progressSeasons : undefined,
				stremioMtime: item.mtime,
				stremioPosition: item.position,
				stremioVideoId: item.videoId,
				startedAt: now,
				finishedAt: nextStatus === "finished" ? now : undefined,
				createdAt: now,
				updatedAt: now,
			});
		}
		const values = {
			accountEmail: connectionRow.email,
			stremioId: item.stremioId,
			mtime: item.mtime,
			obraId,
			updatedAt: Date.now(),
		};
		if (imported) await ctx.db.patch(imported._id, values);
		else
			await ctx.db.insert("stremioImports", {
				userId,
				type: item.type,
				imdbId: item.imdbId,
				...values,
			});
		return true;
	},
});

export const dueConnections = internalQuery({
	args: {},
	returns: v.array(v.id("users")),
	handler: async (ctx) => {
		const rows = await ctx.db
			.query("stremioConnections")
			.withIndex("by_next_sync", (q) => q.lte("nextSyncAt", Date.now()))
			.take(100);
		return rows
			.filter((row) => row.authKey && !row.connecting)
			.map((row) => row.userId);
	},
});

export const syncDue = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const userIds = await ctx.runQuery(
			makeFunctionReference<"query", Record<string, never>, Id<"users">[]>(
				"stremio:dueConnections",
			),
			{},
		);
		await Promise.all(
			userIds.map((userId) =>
				ctx.scheduler.runAfter(0, syncUserRef, { userId, force: false }),
			),
		);
		return null;
	},
});

export const syncUser = internalAction({
	args: {
		userId: v.id("users"),
		force: v.boolean(),
		expectedVersion: v.optional(v.number()),
	},
	returns: v.null(),
	handler: async (ctx, { userId, force, expectedVersion }) => {
		const claim = await ctx.runMutation(claimSyncRef, {
			userId,
			force,
			expectedVersion,
		});
		if (!claim) return null;
		let cursorMtime = claim.checkpointMtime;
		let cursorId = claim.checkpointId;
		try {
			const meta = await stremioRequest("datastoreMeta", {
				authKey: claim.authKey,
				collection: "libraryItem",
			});
			const changed = parseStremioEntries(meta)
				.filter(
					(entry) =>
						entry.mtime > (cursorMtime ?? -1) ||
						(entry.mtime === cursorMtime && entry.id > (cursorId ?? "")),
				)
				.slice(0, MAX_ENTRIES);
			const pending = await ctx.runQuery(pendingRef, {
				userId,
				version: claim.version,
			});
			const entries = [
				...new Map(
					[...pending, ...changed].map((entry) => [entry.id, entry]),
				).values(),
			].sort(
				(a, b) => a.mtime - b.mtime || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
			);
			for (let offset = 0; offset < entries.length; offset += BATCH) {
				const batch = entries.slice(offset, offset + BATCH);
				const response = await stremioRequest("datastoreGet", {
					authKey: claim.authKey,
					collection: "libraryItem",
					ids: batch.map((entry) => entry.id),
					all: false,
				});
				const items = parseStremioItems(response);
				const byId = new Map(items.map((item) => [item._id, item]));
				for (const entry of batch) {
					try {
						const item = byId.get(entry.id);
						if (!item)
							throw new Error("Stremio no devolvió un elemento de biblioteca.");
						if (
							(item.type === "movie" || item.type === "series") &&
							stremioItemHasStarted(item)
						) {
							const imdbId = getImdbId(item._id);
							if (imdbId) {
								const metadata = await resolveTmdb(imdbId, item.type);
								if (!metadata)
									throw new Error(
										"TMDB aún no tiene metadatos para esta obra.",
									);
								const seriesProgress =
									item.type === "series" && item.state?.watched
										? await resolveSeriesProgress(imdbId, item.state.watched)
										: undefined;
								const applied = await ctx.runMutation(applyItemRef, {
									userId,
									version: claim.version,
									item: {
										type: item.type,
										imdbId,
										stremioId: item._id,
										mtime: entry.mtime,
										name: item.name,
										position: item.state?.timeOffset,
										videoId: item.state?.video_id ?? item.state?.videoId,
										watchedMovie:
											item.type === "movie" &&
											((item.state?.flaggedWatched ?? 0) > 0 ||
												(item.state?.timesWatched ?? 0) > 0),
										progressCurrent: seriesProgress?.current,
										progressTotal: seriesProgress?.total,
										metadata,
									},
								});
								if (!applied) return null;
							}
						}
						await ctx.runMutation(setPendingRef, {
							userId,
							version: claim.version,
							id: entry.id,
							mtime: entry.mtime,
							pending: false,
						});
					} catch (error) {
						if (error instanceof StremioHttpError && error.status === 429)
							throw error;
						await ctx.runMutation(setPendingRef, {
							userId,
							version: claim.version,
							id: entry.id,
							mtime: entry.mtime,
							pending: true,
						});
					}
					if (
						cursorMtime === undefined ||
						entry.mtime > cursorMtime ||
						(entry.mtime === cursorMtime && entry.id > (cursorId ?? ""))
					) {
						cursorMtime = entry.mtime;
						cursorId = entry.id;
					}
					await ctx.runMutation(checkpointRef, {
						userId,
						version: claim.version,
						mtime: cursorMtime,
						stremioId: cursorId ?? entry.id,
					});
				}
			}
			await ctx.runMutation(finishSyncRef, {
				userId,
				version: claim.version,
				checkpointMtime: cursorMtime,
				checkpointId: cursorId,
			});
		} catch (error) {
			const details = error instanceof StremioHttpError ? error : undefined;
			await ctx.runMutation(finishSyncRef, {
				userId,
				version: claim.version,
				checkpointMtime: cursorMtime,
				checkpointId: cursorId,
				message: safeError(error),
				retryAfter: details?.retryAfterMs,
			});
		}
		return null;
	},
});

async function requireUserId(
	ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<Id<"users">> {
	const userId = await getAuthUserId(ctx);
	if (!userId) throw new Error("Debes iniciar sesión.");
	return userId;
}

function mergeProgressSeasons(
	existing: Doc<"obras">["progressSeasons"],
	incoming: { seasonNumber: number; episodeCount: number }[] | undefined,
): Doc<"obras">["progressSeasons"] {
	if (!incoming) return existing;
	const counts = new Map(
		(existing ?? []).map(({ seasonNumber, episodeCount }) => [
			seasonNumber,
			episodeCount,
		]),
	);
	for (const { seasonNumber, episodeCount } of incoming) {
		counts.set(
			seasonNumber,
			Math.max(counts.get(seasonNumber) ?? 0, episodeCount),
		);
	}
	return [...counts]
		.map(([seasonNumber, episodeCount]) => ({ seasonNumber, episodeCount }))
		.sort((a, b) => a.seasonNumber - b.seasonNumber);
}

async function connection(
	ctx: Pick<QueryCtx, "db">,
	userId: Id<"users">,
): Promise<Doc<"stremioConnections"> | null> {
	return await ctx.db
		.query("stremioConnections")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.unique();
}

class StremioHttpError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly retryAfterMs?: number,
	) {
		super(message);
	}
}

async function stremioRequest(
	path: string,
	body: Record<string, unknown>,
): Promise<unknown> {
	let response: Response;
	try {
		response = await fetch(`https://api.strem.io/api/${path}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(15_000),
		});
	} catch {
		throw new Error("No se pudo conectar con Stremio.");
	}
	if (!response.ok) {
		const retryHeader = response.headers.get("retry-after");
		const retryAfterMs =
			response.status === 429 ? getRetryAfterMs(retryHeader) : undefined;
		throw new StremioHttpError(
			sanitizedStremioError(response.status, retryHeader),
			response.status,
			retryAfterMs,
		);
	}
	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		throw new Error("Stremio devolvió una respuesta inválida.");
	}
	if (!isRecord(payload) || payload.error)
		throw new Error("Stremio rechazó la solicitud.");
	return payload;
}

async function resolveTmdb(imdbId: string, type: "movie" | "series") {
	const apiKey = process.env.TMDB_API_KEY;
	if (!apiKey) throw new Error("Falta configurar TMDB_API_KEY en el servidor.");
	const findUrl = new URL(
		`https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}`,
	);
	findUrl.searchParams.set("external_source", "imdb_id");
	findUrl.searchParams.set("api_key", apiKey);
	const found = await fetchJson(findUrl);
	const results =
		isRecord(found) &&
		Array.isArray(found[type === "movie" ? "movie_results" : "tv_results"])
			? (found[type === "movie" ? "movie_results" : "tv_results"] as unknown[])
			: [];
	const match = results.find(isRecord);
	if (!match || typeof match.id !== "number") return null;
	const details = await getMetadataDetails("tmdb", String(match.id), type);
	return {
		title: details.title ?? "Sin título",
		year: details.year,
		poster: details.coverUrl,
		tmdbId: String(match.id),
		seasons: details.seasons,
		episodes: details.episodes,
		watchProviders: details.watchProviders ?? [],
		status: details.status,
	};
}

async function resolveSeriesProgress(imdbId: string, serialized: string) {
	const response = await fetchJson(
		new URL(
			`https://v3-cinemeta.strem.io/meta/series/${encodeURIComponent(imdbId)}.json`,
		),
		"Cinemeta",
	);
	if (
		!isRecord(response) ||
		!isRecord(response.meta) ||
		!Array.isArray(response.meta.videos)
	) {
		throw new Error("Cinemeta devolvió una lista de episodios inválida.");
	}
	const videos: StremioVideo[] = response.meta.videos.flatMap((raw) => {
		if (
			!isRecord(raw) ||
			typeof raw.id !== "string" ||
			typeof raw.season !== "number" ||
			typeof raw.episode !== "number"
		)
			return [];
		return [
			{
				id: raw.id,
				season: raw.season,
				episode: raw.episode,
				released: typeof raw.released === "string" ? raw.released : undefined,
			},
		];
	});
	if (videos.length !== response.meta.videos.length) {
		throw new Error("Cinemeta devolvió una lista de episodios inválida.");
	}
	const current = countWatchedEpisodes(serialized, videos);
	const total = videos.filter((video) => video.season > 0).length;
	return { current, total };
}

async function fetchJson(
	url: URL,
	service: "TMDB" | "Cinemeta" = "TMDB",
): Promise<unknown> {
	let response: Response;
	try {
		response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
	} catch {
		throw new Error(`No se pudo conectar con ${service}.`);
	}
	if (!response.ok) {
		if (response.status === 429) {
			const retryAfter = response.headers.get("retry-after");
			throw new StremioHttpError(
				`${service} limitó las solicitudes. Inténtalo más tarde.`,
				429,
				getRetryAfterMs(retryAfter),
			);
		}
		throw new Error(`No se pudieron obtener datos de ${service}.`);
	}
	try {
		return await response.json();
	} catch {
		throw new Error(`${service} devolvió una respuesta inválida.`);
	}
}

function getRetryAfterMs(header: string | null): number {
	if (!header) return HOUR;
	const seconds = Number(header);
	const delay = Number.isFinite(seconds)
		? seconds * 1000
		: Date.parse(header) - Date.now();
	return Math.min(
		24 * HOUR,
		Math.max(1000, Number.isFinite(delay) ? delay : HOUR),
	);
}

function safeError(error: unknown): string {
	if (error instanceof StremioHttpError) return error.message;
	if (error instanceof Error && /TMDB|Stremio|Cinemeta/.test(error.message))
		return error.message.slice(0, 180);
	return "No se pudo sincronizar con Stremio. Inténtalo más tarde.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
