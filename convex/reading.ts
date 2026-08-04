import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
	mutation,
	query,
} from "./_generated/server";
import {
	readingAnnotationStatusValidator,
	readingDocumentInputValidator,
} from "./lib/validators";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export const listDocuments = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, { limit }) => {
		const userId = await requireUserId(ctx);
		const rows = await ctx.db
			.query("readingDocuments")
			.withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
			.order("desc")
			.take(normalizeLimit(limit));

		return rows.map(({ userId: _userId, ...document }) => document);
	},
});

export const getDocument = query({
	args: { id: v.id("readingDocuments") },
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		const document = await ctx.db.get(id);
		if (!document || document.userId !== userId) return null;

		const [progressRows, annotationRows] = await Promise.all([
			ctx.db
				.query("readingProgress")
				.withIndex("by_document_device", (q) => q.eq("documentId", id))
				.collect(),
			ctx.db
				.query("readingAnnotations")
				.withIndex("by_document_sourceKey", (q) => q.eq("documentId", id))
				.order("desc")
				.collect(),
		]);

		const { userId: _userId, ...documentWithoutOwner } = document;
		return {
			document: documentWithoutOwner,
			progress: progressRows.map(({ userId: _progressUserId, ...progress }) => progress),
			annotations: annotationRows.map(
				({ userId: _annotationUserId, ...annotation }) => annotation,
			),
		};
	},
});

export const listAnnotations = query({
	args: {
		status: v.optional(readingAnnotationStatusValidator),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, { status, limit }) => {
		const userId = await requireUserId(ctx);
		const take = normalizeLimit(limit);
		const rows = status
			? await ctx.db
					.query("readingAnnotations")
					.withIndex("by_user_status_updatedAt", (q) =>
						q.eq("userId", userId).eq("status", status),
					)
					.order("desc")
					.take(take)
			: await ctx.db
					.query("readingAnnotations")
					.withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
					.order("desc")
					.take(take);

		return Promise.all(
			rows.map(async ({ userId: _userId, ...annotation }) => {
				const document = await ctx.db.get(annotation.documentId);
				return {
					annotation,
					document: document
						? {
							id: document._id,
							title: document.title,
							obraId: document.obraId,
							sourceKey: document.sourceKey,
						}
						: null,
				};
			}),
		);
	},
});

export const upsertDocument = mutation({
	args: { document: readingDocumentInputValidator },
	handler: async (ctx, { document: input }) => {
		const userId = await requireUserId(ctx);
		const now = Date.now();
		const existing = await ctx.db
			.query("readingDocuments")
			.withIndex("by_user_sourceKey", (q) =>
				q.eq("userId", userId).eq("sourceKey", input.sourceKey),
			)
			.unique();

		const documentId = existing
			? existing._id
			: await ctx.db.insert("readingDocuments", {
					userId,
					sourceKey: input.sourceKey,
					sourcePath: input.sourcePath,
					title: input.title.trim(),
					format: input.format,
					fileHash: input.fileHash,
					fileModifiedAt: input.fileModifiedAt,
					createdAt: now,
					updatedAt: now,
				});

		if (existing) {
			await ctx.db.patch(existing._id, {
				sourcePath: input.sourcePath,
				title: input.title.trim(),
				format: input.format,
				fileHash: input.fileHash,
				fileModifiedAt: input.fileModifiedAt,
				updatedAt: now,
			});
		}

		for (const progress of input.progress) {
			const current = await ctx.db
				.query("readingProgress")
				.withIndex("by_document_device", (q) =>
					q.eq("documentId", documentId).eq("deviceId", progress.deviceId),
				)
				.unique();
			if (current && !isNewerProgress(progress.sourceTimestamp, current.sourceTimestamp)) {
				continue;
			}

			const progressFields = {
				userId,
				documentId,
				...progress,
				updatedAt: now,
			};
			if (current) {
				await ctx.db.patch(current._id, progressFields);
			} else {
				await ctx.db.insert("readingProgress", {
					...progressFields,
					createdAt: now,
				});
			}
		}

		for (const annotation of input.annotations) {
			const text = annotation.text.trim();
			if (!text) continue;

			const current = await ctx.db
				.query("readingAnnotations")
				.withIndex("by_document_sourceKey", (q) =>
					q.eq("documentId", documentId).eq("sourceKey", annotation.sourceKey),
				)
				.unique();
			const annotationFields = {
				...annotation,
				text,
				updatedAt: now,
			};
			if (current) {
				await ctx.db.patch(current._id, annotationFields);
			} else {
				await ctx.db.insert("readingAnnotations", {
					userId,
					documentId,
					...annotationFields,
					status: "unprocessed",
					createdAt: now,
				});
			}
		}

		return documentId;
	},
});

export const linkDocument = mutation({
	args: {
		id: v.id("readingDocuments"),
		obraId: v.union(v.id("obras"), v.null()),
	},
	handler: async (ctx, { id, obraId }) => {
		const userId = await requireUserId(ctx);
		const document = await ctx.db.get(id);
		if (!document || document.userId !== userId) {
			throw new Error("Documento de lectura no encontrado.");
		}
		if (obraId !== null) {
			const obra = await ctx.db.get(obraId);
			if (!obra || obra.userId !== userId) {
				throw new Error("Obra no encontrada.");
			}
		}

		await ctx.db.patch(id, {
			obraId: obraId ?? undefined,
			updatedAt: Date.now(),
		});
		return id;
	},
});

export const setAnnotationStatus = mutation({
	args: {
		id: v.id("readingAnnotations"),
		status: readingAnnotationStatusValidator,
	},
	handler: async (ctx, { id, status }) => {
		const userId = await requireUserId(ctx);
		const annotation = await ctx.db.get(id);
		if (!annotation || annotation.userId !== userId) {
			throw new Error("Anotación de lectura no encontrada.");
		}

		await ctx.db.patch(id, { status, updatedAt: Date.now() });
		return id;
	},
});

export const keepAllUnprocessedAnnotations = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const annotations = await ctx.db
			.query("readingAnnotations")
			.withIndex("by_user_status_updatedAt", (q) =>
				q.eq("userId", userId).eq("status", "unprocessed"),
			)
			.collect();
		const updatedAt = Date.now();

		await Promise.all(
			annotations.map((annotation) =>
				ctx.db.patch(annotation._id, {
					status: "kept",
					updatedAt,
				}),
			),
		);

		return { updated: annotations.length };
	},
});

export const updateAnnotationComment = mutation({
	args: {
		id: v.id("readingAnnotations"),
		comment: v.string(),
	},
	handler: async (ctx, { id, comment }) => {
		const userId = await requireUserId(ctx);
		const annotation = await ctx.db.get(id);
		if (!annotation || annotation.userId !== userId) {
			throw new Error("Anotación de lectura no encontrada.");
		}

		await ctx.db.patch(id, {
			comment: comment.trim() || undefined,
			updatedAt: Date.now(),
		});
		return id;
	},
});

function normalizeLimit(value: number | undefined) {
	if (!value || !Number.isFinite(value)) return DEFAULT_LIMIT;
	return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value)));
}

function isNewerProgress(incoming: number | undefined, current: number | undefined) {
	if (incoming === undefined) return current === undefined;
	if (current === undefined) return true;
	return incoming >= current;
}

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
	const userId = await getAuthUserId(ctx);
	if (!userId) throw new Error("No autorizado.");
	return userId;
}
