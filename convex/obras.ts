import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
	mutation,
	query,
	type MutationCtx,
	type QueryCtx,
} from "./_generated/server";
import {
	assertCreateObraInput,
	assertUpdateObraPatch,
	normalizeOptionalString,
	normalizeTags,
	nullableNumber,
	sanitizeExternal,
	sanitizeMetadata,
	sanitizeProgress,
	sanitizeProgressSeasons,
	sanitizeQuotes,
	syncMangaProgressTotal,
} from "./lib/obras";
import {
	createObraFields,
	obraStatusValidator,
	obraTypeValidator,
	updateObraPatchValidator,
} from "./lib/validators";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export const list = query({
	args: {
		status: v.optional(obraStatusValidator),
		type: v.optional(obraTypeValidator),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, input) => {
		const userId = await requireUserId(ctx);
		const limit = normalizeLimit(input.limit);
		let rows: Doc<"obras">[];

		if (input.status) {
			rows = await ctx.db
				.query("obras")
				.withIndex("by_user_status_updatedAt", (q) =>
					(q as any).eq("userId", userId).eq("status", input.status),
				)
				.order("desc")
				.take(limit);
		} else if (input.type) {
			rows = await ctx.db
				.query("obras")
				.withIndex("by_user_type_updatedAt", (q) =>
					(q as any).eq("userId", userId).eq("type", input.type),
				)
				.order("desc")
				.take(limit);
		} else {
			rows = await ctx.db
				.query("obras")
				.withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
				.order("desc")
				.take(limit);
		}

		const filtered = input.status && input.type
			? rows.filter((row) => row.type === input.type)
			: rows;

		return filtered.map((row) => toObra(row));
	},
});

export const get = query({
	args: { id: v.id("obras") },
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		const row = await ctx.db.get(id);
		if (!row || row.userId !== userId) return null;
		const quotes = await listQuotesForObra(ctx, userId, id);
		return toObra(row, quotes);
	},
});

export const create = mutation({
	args: createObraFields,
	handler: async (ctx, rawInput) => {
		const userId = await requireUserId(ctx);
	const input = assertCreateObraInput(rawInput);
	const now = Date.now();
	const progress = sanitizeProgress(input.progress);
	const progressSeasons = sanitizeProgressSeasons(input.progressSeasons);
	const external = sanitizeExternal(input.external);
	const metadata = sanitizeMetadata(input.metadata, input.type);

		let startedAt = nullableNumber(input.startedAt);
		let finishedAt = nullableNumber(input.finishedAt);

		if (input.status === "in-progress" && startedAt == null) {
			startedAt = now;
		}

		if (input.status === "finished") {
			startedAt ??= now;
			finishedAt ??= now;
		}

		if (input.type === "movie") {
			const watchedAt = finishedAt ?? startedAt;
			startedAt = watchedAt;
			finishedAt = watchedAt;
		}

		const id = await ctx.db.insert("obras", {
			userId,
			title: input.title.trim(),
			type: input.type,
			format: input.type === "book" ? input.format : undefined,
			status: input.status,
			review: normalizeOptionalString(input.review),
			tags: normalizeTags(input.tags),
			recommendedBy: normalizeOptionalString(input.recommendedBy),
			readingUrl: normalizeOptionalString(input.readingUrl),
			sourceUrl: normalizeOptionalString(input.sourceUrl),
			externalSource: external?.source,
			externalId: external?.id,
			metadata,
		coverUrl: normalizeOptionalString(input.coverUrl),
		customCoverUrl: normalizeOptionalString(input.customCoverUrl),
		creator: normalizeOptionalString(input.creator),
		customCreator: normalizeOptionalString(input.customCreator),
		year: nullableNumber(input.year),
		customYear: nullableNumber(input.customYear),
		customTitle: normalizeOptionalString(input.customTitle),
		progressCurrent: progress?.current,
		progressTotal: progress?.total,
		progressSeasons,
		startedAt,
		finishedAt,
		createdAt: now,
		updatedAt: now,
	});

		const row = await ctx.db.get(id);
		if (!row) throw new Error("No se pudo crear la obra.");
		return toObra(row);
	},
});

export const update = mutation({
	args: { id: v.id("obras"), patch: updateObraPatchValidator },
	handler: async (ctx, { id, patch: rawPatch }) => {
		const userId = await requireUserId(ctx);
		const patch = assertUpdateObraPatch(rawPatch);
		const existing = await ctx.db.get(id);
		if (!existing || existing.userId !== userId) {
			throw new Error("Obra no encontrada.");
		}

		const now = Date.now();
		const nextPatch: Partial<Doc<"obras">> = { updatedAt: now };

		if (hasOwn(patch, "title") && patch.title != null) {
			nextPatch.title = patch.title.trim();
		}
		if (hasOwn(patch, "type") && patch.type != null) {
			nextPatch.type = patch.type;
		}
		if (hasOwn(patch, "format")) {
			const nextType = nextPatch.type ?? existing.type;
			nextPatch.format =
				nextType === "book" && patch.format != null ? patch.format : undefined;
		}
		if (hasOwn(patch, "status") && patch.status != null) {
			nextPatch.status = patch.status;
		}
		if (hasOwn(patch, "review")) {
			nextPatch.review = normalizeOptionalString(patch.review);
		}
		if (hasOwn(patch, "tags")) {
			nextPatch.tags = normalizeTags(patch.tags);
		}
		if (hasOwn(patch, "recommendedBy")) {
			nextPatch.recommendedBy = normalizeOptionalString(patch.recommendedBy);
		}
		if (hasOwn(patch, "readingUrl")) {
			nextPatch.readingUrl = normalizeOptionalString(patch.readingUrl);
		}
		if (hasOwn(patch, "sourceUrl")) {
			nextPatch.sourceUrl = normalizeOptionalString(patch.sourceUrl);
		}
		if (hasOwn(patch, "external")) {
			const external = sanitizeExternal(patch.external);
			nextPatch.externalSource = external?.source;
			nextPatch.externalId = external?.id;
		}
		if (hasOwn(patch, "metadata")) {
			nextPatch.metadata = sanitizeMetadata(
				patch.metadata,
				patch.type ?? existing.type,
			);
		}
		if (hasOwn(patch, "coverUrl")) {
			nextPatch.coverUrl = normalizeOptionalString(patch.coverUrl);
		}
		if (hasOwn(patch, "customCoverUrl")) {
			nextPatch.customCoverUrl = normalizeOptionalString(patch.customCoverUrl);
		}
		if (hasOwn(patch, "creator")) {
			nextPatch.creator = normalizeOptionalString(patch.creator);
		}
		if (hasOwn(patch, "customCreator")) {
			nextPatch.customCreator = normalizeOptionalString(patch.customCreator);
		}
		if (hasOwn(patch, "year")) {
			nextPatch.year = nullableNumber(patch.year);
		}
		if (hasOwn(patch, "customYear")) {
			nextPatch.customYear = nullableNumber(patch.customYear);
		}
		if (hasOwn(patch, "customTitle")) {
			nextPatch.customTitle = normalizeOptionalString(patch.customTitle);
		}
		if (hasOwn(patch, "progress")) {
			const progress = sanitizeProgress(patch.progress);
			nextPatch.progressCurrent = progress?.current;
			nextPatch.progressTotal = progress?.total;
		}
		if (hasOwn(patch, "progressSeasons")) {
			nextPatch.progressSeasons = sanitizeProgressSeasons(patch.progressSeasons);
		}
		if (hasOwn(patch, "startedAt")) {
			nextPatch.startedAt = nullableNumber(patch.startedAt);
		}
		if (hasOwn(patch, "finishedAt")) {
			nextPatch.finishedAt = nullableNumber(patch.finishedAt);
		}

		if (
			!hasOwn(patch, "progress") &&
			hasOwn(patch, "metadata") &&
			nextPatch.metadata &&
			typeof existing.progressTotal === "number"
		) {
			const syncedTotal = syncMangaProgressTotal(
				existing.progressTotal,
				nextPatch.metadata,
				nextPatch.type ?? existing.type,
			);
			if (syncedTotal !== undefined) {
				nextPatch.progressTotal = syncedTotal;
			}
		}

		const nextStatus = nextPatch.status ?? existing.status;
		const nextType = nextPatch.type ?? existing.type;
		if (nextType !== "book") {
			nextPatch.format = undefined;
		}
		if (
			nextStatus === "in-progress" &&
			existing.startedAt == null &&
			!hasOwn(patch, "startedAt")
		) {
			nextPatch.startedAt = now;
		}

		if (nextStatus === "finished") {
			if (existing.startedAt == null && !hasOwn(patch, "startedAt")) {
				nextPatch.startedAt = now;
			}
			if (existing.finishedAt == null && !hasOwn(patch, "finishedAt")) {
				nextPatch.finishedAt = now;
			}
		}

		if (
			existing.status === "finished" &&
			nextStatus !== "finished" &&
			!hasOwn(patch, "finishedAt")
		) {
			nextPatch.finishedAt = undefined;
		}

		if (nextType === "movie") {
			const watchedAt =
				nextPatch.finishedAt ??
				nextPatch.startedAt ??
				existing.finishedAt ??
				existing.startedAt;
			nextPatch.startedAt = watchedAt;
			nextPatch.finishedAt = watchedAt;
		}

		await ctx.db.patch(id, nextPatch);

		if (hasOwn(patch, "quotes")) {
			await replaceQuotesForObra(
				ctx,
				userId,
				id,
				sanitizeQuotes(patch.quotes ?? []),
				now,
			);
		}

		const row = await ctx.db.get(id);
		if (!row) throw new Error("Obra no encontrada.");
		const quotes = await listQuotesForObra(ctx, userId, id);
		return toObra(row, quotes);
	},
});

export const remove = mutation({
	args: { id: v.id("obras") },
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		const row = await ctx.db.get(id);
		if (!row || row.userId !== userId) {
			throw new Error("Obra no encontrada.");
		}

		const quotes = await listQuotesForObra(ctx, userId, id);
		for (const quote of quotes) {
			await ctx.db.delete(quote._id);
		}
		await ctx.db.delete(id);
		return { id };
	},
});

function toObra(row: Doc<"obras">, quoteRows: Doc<"obraQuotes">[] = []) {
	return {
		id: row._id,
		title: row.customTitle ?? row.title,
		originalTitle: row.title,
		customTitle: row.customTitle,
		type: row.type,
		format: row.format,
		status: row.status,
		review: row.review,
		tags: row.tags,
		quotes: quoteRows.map((quote) => ({
			id: quote._id,
			obraId: quote.obraId,
			content: quote.content,
			characterName: quote.characterName,
			createdAt: quote.createdAt,
			updatedAt: quote.updatedAt,
		})),
		recommendedBy: row.recommendedBy,
		readingUrl: row.readingUrl,
		sourceUrl: row.sourceUrl,
		coverUrl: row.customCoverUrl ?? row.coverUrl,
		originalCoverUrl: row.coverUrl,
		customCoverUrl: row.customCoverUrl,
		creator: row.customCreator ?? row.creator,
		originalCreator: row.creator,
		customCreator: row.customCreator,
		year: row.customYear ?? row.year,
		originalYear: row.year,
		customYear: row.customYear,
		external:
			row.externalSource && row.externalId
				? { source: row.externalSource, id: row.externalId }
				: undefined,
		metadata: row.metadata,
		progress:
			row.progressCurrent != null && row.progressTotal != null
				? {
						current: row.progressCurrent,
						total: row.progressTotal,
					}
				: undefined,
		progressSeasons: row.progressSeasons,
		startedAt: row.startedAt,
		finishedAt: row.finishedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

async function listQuotesForObra(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	obraId: Id<"obras">,
) {
	return await ctx.db
		.query("obraQuotes")
		.withIndex("by_user_obra_createdAt", (q) =>
			q.eq("userId", userId).eq("obraId", obraId),
		)
		.order("asc")
		.collect();
}

async function replaceQuotesForObra(
	ctx: MutationCtx,
	userId: Id<"users">,
	obraId: Id<"obras">,
	quotes: ReturnType<typeof sanitizeQuotes>,
	now: number,
) {
	const existingQuotes = await listQuotesForObra(ctx, userId, obraId);
	const createdAtById = new Map(
		existingQuotes.map((quote) => [quote._id, quote.createdAt]),
	);

	for (const quote of existingQuotes) {
		await ctx.db.delete(quote._id);
	}

	for (const quote of quotes) {
		const id = quote.id;
		await ctx.db.insert("obraQuotes", {
			userId,
			obraId,
			content: quote.content,
			characterName: quote.characterName,
			createdAt: id ? (createdAtById.get(id) ?? now) : now,
			updatedAt: now,
		});
	}
}

async function requireUserId(ctx: QueryCtx | MutationCtx) {
	const userId = await getAuthUserId(ctx);
	if (userId === null) throw new Error("No autorizado.");
	return userId;
}

function normalizeLimit(limit: number | undefined) {
	return Math.max(1, Math.min(Math.floor(limit ?? DEFAULT_LIMIT), MAX_LIMIT));
}

function hasOwn<T extends object, K extends PropertyKey>(
	object: T,
	key: K,
): object is T & Record<K, unknown> {
	return Object.prototype.hasOwnProperty.call(object, key);
}
