import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
	mutation,
	query,
	type MutationCtx,
	type QueryCtx,
} from "./_generated/server";
import {
	isIntegrationOwner as checkIntegrationOwner,
	requireIntegrationOwner,
} from "../src/lib/reading/integration-owner";
import {
	readingAnnotationStatusValidator,
	readingDocumentInputValidator,
} from "./lib/validators";
import {
	buildAnnotationIdentity,
	compareProgressSource,
	isPossibleDuplicate,
	selectCanonicalProgress,
} from "../src/lib/reading/reconciliation";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const readingSyncErrorValidator = v.object({
	path: v.string(),
	message: v.string(),
});

export const isIntegrationOwner = query({
	args: {},
	handler: async (ctx) => {
		return checkIntegrationOwner(ctx);
	},
});

export const listDocuments = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, { limit }) => {
		const userId = await requireUserId(ctx);
		const rows = await ctx.db
			.query("readingDocuments")
			.withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
			.order("desc")
			.take(normalizeLimit(limit));
		const obras = await ctx.db
			.query("obras")
			.withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
			.collect();

		return Promise.all(
			rows.map(async (document) => {
				const sources = await ctx.db
					.query("readingSources")
					.withIndex("by_document_updatedAt", (q) =>
						q.eq("documentId", document._id),
					)
					.order("desc")
					.collect();
				return toDocumentView(document, sources, obras);
			}),
		);
	},
});

export const listSourceStates = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const sources = await ctx.db
			.query("readingSources")
			.withIndex("by_user_sourceKey", (q) => q.eq("userId", userId))
			.collect();
		return sources
			.filter((source) => source.status !== "missing")
			.map(({ userId: _userId, ...source }) => source);
	},
});

export const getDocument = query({
	args: { id: v.id("readingDocuments") },
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		const document = await ctx.db.get(id);
		if (!document || document.userId !== userId) return null;

		const [progressRows, annotationRows, sourceRows] = await Promise.all([
			ctx.db
				.query("readingProgress")
				.withIndex("by_document_device", (q) => q.eq("documentId", id))
				.collect(),
			ctx.db
				.query("readingAnnotations")
				.withIndex("by_document_sourceKey", (q) => q.eq("documentId", id))
				.order("asc")
				.collect(),
			ctx.db
				.query("readingSources")
				.withIndex("by_document_updatedAt", (q) => q.eq("documentId", id))
				.order("desc")
				.collect(),
		]);

		return {
			document: toDocumentView(document, sourceRows, []),
			progress: progressRows.map(({ userId: _progressUserId, ...progress }) => progress),
			annotations: annotationRows.map(({ userId: _annotationUserId, ...annotation }) => ({
				...annotation,
				text: annotation.curatedText ?? annotation.originalText ?? annotation.text,
			})),
			sources: sourceRows.map(({ userId: _sourceUserId, ...source }) => source),
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
					annotation: {
						...annotation,
						text: annotation.curatedText ?? annotation.originalText ?? annotation.text,
					},
					document: document
						? {
							id: document._id,
							title: document.title,
							obraId: document.obraId,
							sourceKey: document.sourceKey,
							format: document.format,
						}
						: null,
				};
			}),
		);
	},
});

export const getAnnotationContextSource = query({
	args: { id: v.id("readingAnnotations") },
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		const annotation = await ctx.db.get(id);
		if (!annotation || annotation.userId !== userId) return null;
		const document = await ctx.db.get(annotation.documentId);
		if (!document || document.userId !== userId) return null;
		const source = annotation.sourceId ? await ctx.db.get(annotation.sourceId) : null;
		return {
			format: document.format,
			sourcePath: source?.sourcePath ?? document.sourcePath,
			text: annotation.originalText ?? annotation.text,
			chapter: annotation.chapter,
		};
	},
});

export const listSyncRuns = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, { limit }) => {
		const userId = await requireUserId(ctx);
		const rows = await ctx.db
			.query("readingSyncRuns")
			.withIndex("by_user_startedAt", (q) => q.eq("userId", userId))
			.order("desc")
			.take(normalizeLimit(limit));
		return rows.map(({ userId: _userId, ...run }) => run);
	},
});

export const upsertDocument = mutation({
	args: { document: readingDocumentInputValidator },
	handler: async (ctx, { document: input }) => {
		const userId = await requireUserId(ctx);
		return upsertDocumentForUser(ctx, userId, input);
	},
});

export const projectDocumentProgress = mutation({
	args: { id: v.id("readingDocuments") },
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		const document = await ctx.db.get(id);
		if (!document || document.userId !== userId) {
			throw new Error("Documento de lectura no encontrado.");
		}
		await projectProgressForDocument(ctx, document, Date.now());
		return id;
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
			if (!obra || obra.userId !== userId) throw new Error("Obra no encontrada.");
		}

		await ctx.db.patch(id, { obraId: obraId ?? undefined, updatedAt: Date.now() });
		if (document.obraId && document.obraId !== obraId) {
			await clearReadingProjection(ctx, document.obraId, id);
		}
		const linkedDocument = await ctx.db.get(id);
		if (linkedDocument?.obraId) {
			await projectProgressForDocument(ctx, linkedDocument, Date.now());
		}
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
		const annotation = await getOwnedAnnotation(ctx, id, userId);
		const now = Date.now();
		const patch: Partial<Doc<"readingAnnotations">> = {
			status,
			updatedAt: now,
		};
		if (status === "kept") {
			patch.curatedText = annotation.curatedText ?? annotation.originalText ?? annotation.text;
			patch.curatedAt ??= annotation.curatedAt ?? now;
		}
		await ctx.db.patch(id, patch);
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
					curatedText: annotation.curatedText ?? annotation.originalText ?? annotation.text,
					curatedAt: annotation.curatedAt ?? updatedAt,
					updatedAt,
				}),
			),
		);

		return { updated: annotations.length };
	},
});

export const updateAnnotationCuration = mutation({
	args: {
		id: v.id("readingAnnotations"),
		curatedText: v.string(),
		comment: v.string(),
	},
	handler: async (ctx, { id, curatedText, comment }) => {
		const userId = await requireUserId(ctx);
		await getOwnedAnnotation(ctx, id, userId);
		const now = Date.now();
		await ctx.db.patch(id, {
			status: "kept",
			curatedText: curatedText.trim() || undefined,
			curatedAt: now,
			comment: comment.trim() || undefined,
			updatedAt: now,
		});
		return id;
	},
});

export const updateAnnotationComment = mutation({
	args: { id: v.id("readingAnnotations"), comment: v.string() },
	handler: async (ctx, { id, comment }) => {
		const userId = await requireUserId(ctx);
		await getOwnedAnnotation(ctx, id, userId);
		await ctx.db.patch(id, { comment: comment.trim() || undefined, updatedAt: Date.now() });
		return id;
	},
});

export const markMissingSources = mutation({
	args: { sourceKeys: v.array(v.string()) },
	handler: async (ctx, { sourceKeys }) => {
		const userId = await requireUserId(ctx);
		return markMissingSourcesForUser(ctx, userId, sourceKeys);
	},
});

export const markSourceErrors = mutation({
	args: { errors: v.array(readingSyncErrorValidator) },
	handler: async (ctx, { errors }) => {
		const userId = await requireUserId(ctx);
		return markSourceErrorsForUser(ctx, userId, errors);
	},
});

export const beginSyncRun = mutation({
	args: { trigger: v.union(v.literal("manual"), v.literal("automatic")) },
	handler: async (ctx, { trigger }) => {
		const userId = await requireUserId(ctx);
		const now = Date.now();
		return await ctx.db.insert("readingSyncRuns", {
			userId,
			trigger,
			status: "running",
			startedAt: now,
			processedDocuments: 0,
			changedDocuments: 0,
			skippedFiles: 0,
			errors: [],
		});
	},
});

export const finishSyncRun = mutation({
	args: {
		id: v.id("readingSyncRuns"),
		status: v.union(v.literal("completed"), v.literal("partial"), v.literal("failed")),
		processedDocuments: v.number(),
		changedDocuments: v.number(),
		skippedFiles: v.number(),
		errors: v.array(readingSyncErrorValidator),
	},
	handler: async (ctx, input) => {
		const userId = await requireUserId(ctx);
		const run = await ctx.db.get(input.id);
		if (!run || run.userId !== userId) throw new Error("Ejecución de sync no encontrada.");
		const { id: _id, ...patch } = input;
		await ctx.db.patch(_id, { ...patch, finishedAt: Date.now() });
		return input.id;
	},
});

async function upsertDocumentForUser(
	ctx: MutationCtx,
	userId: Id<"users">,
	input: {
		sourceKey: string;
		sourcePath: string;
		title: string;
		format: "epub" | "pdf" | "other";
		documentKey?: string;
		author?: string;
		fileHash?: string;
		fileModifiedAt?: number;
		sidecarModifiedAt?: number;
		annotationsComplete?: boolean;
		progress: Array<{
			deviceId: string;
			deviceLabel?: string;
			filePath?: string;
			page?: number;
			percent?: number;
			maxPercent?: number;
			totalPages?: number;
			revision?: number;
			sourceTimestamp?: number;
			locator?: string;
			completionStatus?: "complete" | "in-progress";
		}>;
		annotations: Array<{
			sourceKey: string;
			text: string;
			note?: string;
			chapter?: string;
			color?: string;
			page?: string;
			pageNumber?: number;
			positionStart?: string;
			positionEnd?: string;
			capturedAt?: string;
			updatedAtSource?: string;
			deviceId?: string;
			deviceLabel?: string;
		}>;
	},
) {
	const now = Date.now();
	const documentKey = input.documentKey ?? input.fileHash ?? input.sourceKey;
	const existing = await findDocument(ctx, userId, documentKey, input);
	const documentId = existing?._id ?? (await ctx.db.insert("readingDocuments", {
		userId,
		sourceKey: input.sourceKey,
		sourcePath: input.sourcePath,
		title: input.title.trim(),
		format: input.format,
		documentKey,
		author: input.author?.trim() || undefined,
		fileHash: input.fileHash,
		fileModifiedAt: input.fileModifiedAt,
		sidecarModifiedAt: input.sidecarModifiedAt,
		lastSyncedAt: now,
		createdAt: now,
		updatedAt: now,
	}));

	if (existing) {
		await ctx.db.patch(existing._id, {
			sourceKey: existing.sourceKey || input.sourceKey,
			sourcePath: input.sourcePath,
			title: input.title.trim(),
			format: input.format,
			documentKey,
			author: input.author?.trim() || existing.author,
			fileHash: input.fileHash,
			fileModifiedAt: input.fileModifiedAt,
			sidecarModifiedAt: input.sidecarModifiedAt,
			lastSyncedAt: now,
			updatedAt: now,
		});
	}

	let source = await ctx.db
		.query("readingSources")
		.withIndex("by_user_sourceKey", (q) =>
			q.eq("userId", userId).eq("sourceKey", input.sourceKey),
		)
		.unique();
	if (source && source.documentId !== documentId) {
		throw new Error("La ruta de lectura ya pertenece a otro documento.");
	}
	if (!source) {
		const sourceId = await ctx.db.insert("readingSources", {
			userId,
			documentId,
			sourceKey: input.sourceKey,
			sourcePath: input.sourcePath,
			fileHash: input.fileHash,
			fileModifiedAt: input.fileModifiedAt,
			sidecarModifiedAt: input.sidecarModifiedAt,
			status: "active",
			lastSeenAt: now,
			lastProcessedAt: now,
			createdAt: now,
			updatedAt: now,
		});
		source = await ctx.db.get(sourceId);
	} else {
		await ctx.db.patch(source._id, {
			sourcePath: input.sourcePath,
			fileHash: input.fileHash,
			fileModifiedAt: input.fileModifiedAt,
			sidecarModifiedAt: input.sidecarModifiedAt,
			status: "active",
			lastSeenAt: now,
			lastProcessedAt: now,
			lastError: undefined,
			updatedAt: now,
		});
		source = await ctx.db.get(source._id);
	}
	if (!source) throw new Error("No se pudo guardar la fuente de lectura.");

	let importedProgress = 0;
	for (const progress of input.progress) {
		const current = await findProgress(ctx, documentId, source._id, progress.deviceId);
		if (current && compareProgressSource(progress, current) < 0) continue;
		const maxPercent = Math.max(
			current?.maxPercent ?? 0,
			current?.percent ?? 0,
			progress.maxPercent ?? 0,
			progress.percent ?? 0,
		);
		const fields = {
			userId,
			documentId,
			sourceId: source._id,
			...progress,
			maxPercent,
			updatedAt: now,
		};
		if (current) await ctx.db.patch(current._id, fields);
		else await ctx.db.insert("readingProgress", { ...fields, createdAt: now });
		importedProgress += 1;
	}

	const seenFingerprints = new Set<string>();
	let importedAnnotations = 0;
	const existingAnnotations = await ctx.db
		.query("readingAnnotations")
		.withIndex("by_document_sourceKey", (q) => q.eq("documentId", documentId))
		.collect();
	for (const [index, annotation] of input.annotations.entries()) {
		const text = annotation.text.trim();
		if (!text) continue;
		const sourceFingerprint = buildAnnotationIdentity(annotation, index);
		seenFingerprints.add(sourceFingerprint);
		const current =
			(existingAnnotations.find(
				(candidate) =>
					candidate.sourceFingerprint === sourceFingerprint ||
					(candidate.sourceKey === annotation.sourceKey &&
						candidate.documentId === documentId),
			) ??
				(await findAnnotationByFingerprint(ctx, documentId, sourceFingerprint)));
		const possibleDuplicateOf = current
			? current.possibleDuplicateOf
			: existingAnnotations.find(
					(candidate) =>
						isPossibleDuplicate(
							candidate.originalText ?? candidate.text,
							text,
						) && candidate.sourceFingerprint !== sourceFingerprint,
					)?._id;
		const fields = {
			userId,
			documentId,
			sourceId: source._id,
			sourceKey: annotation.sourceKey,
			sourceFingerprint,
			sourceIndex: index,
			sourceCreatedAt: annotation.capturedAt,
			text,
			originalText: text,
			note: annotation.note,
			chapter: annotation.chapter,
			color: annotation.color,
			page: annotation.page,
			pageNumber: annotation.pageNumber,
			positionStart: annotation.positionStart,
			positionEnd: annotation.positionEnd,
			capturedAt: annotation.capturedAt,
			updatedAtSource: annotation.updatedAtSource,
			deviceId: annotation.deviceId,
			deviceLabel: annotation.deviceLabel,
			sourceStatus: "active" as const,
			sourceMissingAt: undefined,
			possibleDuplicateOf,
			updatedAt: now,
		};
		if (current) await ctx.db.patch(current._id, fields);
		else {
			await ctx.db.insert("readingAnnotations", {
				...fields,
				status: "unprocessed",
				createdAt: now,
			});
		}
		importedAnnotations += 1;
	}

	if (input.annotationsComplete) {
		for (const annotation of existingAnnotations) {
			if (annotation.sourceId !== source._id) continue;
			if (annotation.sourceFingerprint && seenFingerprints.has(annotation.sourceFingerprint)) {
				continue;
			}
			await ctx.db.patch(annotation._id, {
				sourceStatus: "missing",
				sourceMissingAt: now,
				updatedAt: now,
			});
		}
	}

	const updatedDocument = await ctx.db.get(documentId);
	if (updatedDocument?.obraId) {
		await projectProgressForDocument(ctx, updatedDocument, now);
	}
	return {
		documentId,
		sourceId: source._id,
		importedProgress,
		importedAnnotations,
		changedDocuments: 1,
	};
}

async function findDocument(
	ctx: MutationCtx,
	userId: Id<"users">,
	documentKey: string,
	input: { sourceKey: string; fileHash?: string },
) {
	const byKey = await ctx.db
		.query("readingDocuments")
		.withIndex("by_user_documentKey", (q) =>
			q.eq("userId", userId).eq("documentKey", documentKey),
		)
		.unique();
	if (byKey) return byKey;
	if (input.fileHash) {
		const byHash = await ctx.db
			.query("readingDocuments")
			.withIndex("by_user_fileHash", (q) =>
				q.eq("userId", userId).eq("fileHash", input.fileHash),
			)
			.unique();
		if (byHash) return byHash;
	}
	return await ctx.db
		.query("readingDocuments")
		.withIndex("by_user_sourceKey", (q) =>
			q.eq("userId", userId).eq("sourceKey", input.sourceKey),
		)
		.unique();
}

async function findProgress(
	ctx: MutationCtx,
	documentId: Id<"readingDocuments">,
	sourceId: Id<"readingSources">,
	deviceId: string,
) {
	const rows = await ctx.db
		.query("readingProgress")
		.withIndex("by_document_device", (q) =>
			q.eq("documentId", documentId).eq("deviceId", deviceId),
		)
		.collect();
	return rows.find((row) => row.sourceId === sourceId) ?? rows.find((row) => !row.sourceId);
}

async function findAnnotationByFingerprint(
	ctx: MutationCtx,
	documentId: Id<"readingDocuments">,
	fingerprint: string,
) {
	return await ctx.db
		.query("readingAnnotations")
		.withIndex("by_document_sourceFingerprint", (q) =>
			q.eq("documentId", documentId).eq("sourceFingerprint", fingerprint),
		)
		.unique();
}

async function markMissingSourcesForUser(
	ctx: MutationCtx,
	userId: Id<"users">,
	sourceKeys: string[],
) {
	const observed = new Set(sourceKeys);
	const sources = await ctx.db
		.query("readingSources")
		.withIndex("by_user_sourceKey", (q) => q.eq("userId", userId))
		.collect();
	const now = Date.now();
	let marked = 0;
	for (const source of sources) {
		if (source.status === "missing") continue;
		if (observed.has(source.sourceKey)) continue;
		await ctx.db.patch(source._id, {
			status: "missing",
			updatedAt: now,
		});
		const annotations = await ctx.db
			.query("readingAnnotations")
			.withIndex("by_document_sourceKey", (q) => q.eq("documentId", source.documentId))
			.collect();
		for (const annotation of annotations) {
			if (annotation.sourceId !== source._id) continue;
			await ctx.db.patch(annotation._id, {
				sourceStatus: "missing",
				sourceMissingAt: now,
				updatedAt: now,
			});
		}
		marked += 1;
	}
	return { marked };
}

async function markSourceErrorsForUser(
	ctx: MutationCtx,
	userId: Id<"users">,
	errors: Array<{ path: string; message: string }>,
) {
	const now = Date.now();
	let marked = 0;
	for (const error of errors) {
		if (!error.path) continue;
		const source = await ctx.db
			.query("readingSources")
			.withIndex("by_user_sourceKey", (q) =>
				q.eq("userId", userId).eq("sourceKey", error.path),
			)
			.unique();
		if (!source) continue;
		await ctx.db.patch(source._id, {
			status: "error",
			lastError: error.message,
			updatedAt: now,
		});
		marked += 1;
	}
	return { marked };
}

async function projectProgressForDocument(
	ctx: MutationCtx,
	document: Doc<"readingDocuments">,
	now: number,
) {
	if (!document.obraId) return;
	const obra = await ctx.db.get(document.obraId);
	if (!obra || obra.userId !== document.userId) return;
	const progressRows = await ctx.db
		.query("readingProgress")
		.withIndex("by_document_device", (q) => q.eq("documentId", document._id))
		.collect();
	const selection = selectCanonicalProgress(progressRows);
	if (
		selection.currentPercent === undefined &&
		selection.maxPercent === undefined &&
		selection.completionStatus === undefined
	) {
		return;
	}

	const previousCurrent = obra.readingCurrentPercent ?? 0;
	const fellAfterFinish =
		obra.status === "finished" &&
		selection.currentPercent !== undefined &&
		selection.currentPercent + 0.2 < previousCurrent;
	const patch: Partial<Doc<"obras">> = {
		readingDocumentId: document._id,
		readingProgressPercent: selection.maxPercent,
		readingCurrentPercent: selection.currentPercent,
		readingProgressUpdatedAt: now,
		readingProgressSourceTimestamp: selection.selected?.sourceTimestamp,
		readingProgressRevision: selection.selected?.revision,
		readingProgressStatus: selection.completionStatus,
		updatedAt: now,
	};

	if (selection.currentPercent !== undefined && selection.currentPercent > 0 && obra.status === "backlog") {
		patch.status = "in-progress";
		patch.startedAt ??= now;
	}
	if (selection.completionStatus === "complete" && obra.status !== "finished") {
		patch.status = "finished";
		patch.finishedAt = selection.selected?.sourceTimestamp ?? now;
		if (!obra.reviewStatus && !obra.review) {
			patch.reviewStatus = "pending";
			patch.reviewRequestedAt = now;
		}
	}
	if (fellAfterFinish && !obra.readingRereadSuggestedAt) {
		patch.readingRereadSuggestedAt = now;
	}
	await ctx.db.patch(obra._id, patch);
}

async function clearReadingProjection(
	ctx: MutationCtx,
	obraId: Id<"obras">,
	documentId: Id<"readingDocuments">,
) {
	const obra = await ctx.db.get(obraId);
	if (!obra || obra.readingDocumentId !== documentId) return;
	await ctx.db.patch(obraId, {
		readingDocumentId: undefined,
		readingProgressPercent: undefined,
		readingCurrentPercent: undefined,
		readingProgressUpdatedAt: undefined,
		readingProgressSourceTimestamp: undefined,
		readingProgressRevision: undefined,
		readingProgressStatus: undefined,
		readingRereadSuggestedAt: undefined,
		updatedAt: Date.now(),
	});
}

function toDocumentView(
	document: Doc<"readingDocuments">,
	sources: Doc<"readingSources">[],
	obras: Doc<"obras">[],
) {
	const suggestion = document.obraId
		? undefined
		: findSuggestedObra(document, obras);
	return {
		_id: document._id,
		id: document._id,
		sourceKey: document.sourceKey,
		sourcePath: document.sourcePath,
		title: document.title,
		author: document.author,
		format: document.format,
		documentKey: document.documentKey ?? document.fileHash,
		fileHash: document.fileHash,
		fileModifiedAt: document.fileModifiedAt,
		sidecarModifiedAt: document.sidecarModifiedAt,
		obraId: document.obraId,
		suggestion,
		createdAt: document.createdAt,
		updatedAt: document.updatedAt,
		sources: sources.map(({ userId: _userId, ...source }) => source),
	};
}

function findSuggestedObra(document: Doc<"readingDocuments">, obras: Doc<"obras">[]) {
	const documentTitle = normalizeMatch(document.title);
	const documentAuthor = normalizeMatch(document.author);
	let best: { id: Id<"obras">; score: number; title: string } | undefined;
	for (const obra of obras) {
		if (obra.type !== "book") continue;
		const title = normalizeMatch(obra.customTitle ?? obra.title);
		const author = normalizeMatch(obra.customCreator ?? obra.creator);
		let score = title && (title.includes(documentTitle) || documentTitle.includes(title)) ? 0.7 : 0;
		if (documentAuthor && author && documentAuthor === author) score += 0.3;
		if (score > (best?.score ?? 0)) best = { id: obra._id, score, title: obra.title };
	}
	return best;
}

function normalizeMatch(value: string | undefined) {
	return (value ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

async function getOwnedAnnotation(
	ctx: MutationCtx,
	id: Id<"readingAnnotations">,
	userId: Id<"users">,
) {
	const annotation = await ctx.db.get(id);
	if (!annotation || annotation.userId !== userId) {
		throw new Error("Anotación de lectura no encontrada.");
	}
	return annotation;
}

function normalizeLimit(value: number | undefined) {
	if (!value || !Number.isFinite(value)) return DEFAULT_LIMIT;
	return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value)));
}

async function requireUserId(ctx: QueryCtx | MutationCtx) {
	return requireIntegrationOwner(ctx);
}
