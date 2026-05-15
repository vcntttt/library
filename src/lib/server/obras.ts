import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { obraQuotes, obras } from "@/db/schema";
import type {
	CreateObraInput,
	ExternalReference,
	Obra,
	ObraMetadata,
	ObraProgress,
	ObraQuote,
	ObraQuotePatch,
	ObraStatus,
	ObraType,
	UpdateObraPatch,
} from "@/lib/types";

const obraTypes = ["book", "movie", "series", "anime", "manga"] as const;
const obraStatuses = ["backlog", "in-progress", "finished", "dropped"] as const;
const chapterSources = ["manga-plus", "mangadex", "anilist"] as const;

const externalSchema = z.object({
	source: z.enum(["google-books", "open-library", "tmdb", "anilist"]),
	id: z.string().min(1),
});

const metadataSchema = z.object({
	pages: z.number().int().nonnegative().nullish(),
	seasons: z.number().int().nonnegative().nullish(),
	episodes: z.number().int().nonnegative().nullish(),
	episodesAired: z.number().int().nonnegative().nullish(),
	nextEpisodeDate: z.number().int().nonnegative().nullish(),
	status: z.string().nullish(),
	volumes: z.number().int().nonnegative().nullish(),
	season: z.string().nullish(),
	seasonYear: z.number().int().nonnegative().nullish(),
	runtime: z.number().int().nonnegative().nullish(),
	watchProviders: z.array(z.string().nullish()).nullish(),
	latestChapter: z.number().nonnegative().nullish(),
	latestChapterSource: z.enum(chapterSources).nullish(),
	latestChapterCheckedAt: z.number().int().nonnegative().nullish(),
	lastNotifiedChapter: z.number().nonnegative().nullish(),
	mangaPlusTitleId: z.string().nullish(),
	mangaDexId: z.string().nullish(),
});

const progressSchema = z.object({
	current: z.number().int().nonnegative(),
	total: z.number().int().nonnegative(),
});

const quotePatchSchema = z.object({
	id: z.string().min(1).nullish(),
	content: z.string().trim().min(1),
	characterName: z.string().nullish(),
});

const createObraSchema = z.object({
	title: z.string().min(1),
	type: z.enum(obraTypes),
	status: z.enum(obraStatuses),
	review: z.string().nullish(),
	tags: z.array(z.string()).nullish(),
	recommendedBy: z.string().nullish(),
	readingUrl: z.string().nullish(),
	external: externalSchema.nullish(),
	metadata: metadataSchema.nullish(),
	coverUrl: z.string().nullish(),
	creator: z.string().nullish(),
	year: z.number().int().nullish(),
	progress: progressSchema.nullish(),
	startedAt: z.number().int().nonnegative().nullish(),
	finishedAt: z.number().int().nonnegative().nullish(),
});

const updatePatchSchema = z.object({
	title: z.string().min(1).nullish(),
	type: z.enum(obraTypes).nullish(),
	status: z.enum(obraStatuses).nullish(),
	review: z.string().nullish(),
	tags: z.array(z.string()).nullish(),
	quotes: z.array(quotePatchSchema).nullish(),
	recommendedBy: z.string().nullish(),
	readingUrl: z.string().nullish(),
	external: externalSchema.nullish(),
	metadata: metadataSchema.nullish(),
	coverUrl: z.string().nullish(),
	creator: z.string().nullish(),
	year: z.number().int().nullish(),
	progress: progressSchema.nullish(),
	startedAt: z.number().int().nonnegative().nullish(),
	finishedAt: z.number().int().nonnegative().nullish(),
});

export interface ListObrasInput {
	status?: ObraStatus;
	type?: ObraType;
	limit?: number;
}

type ObraRow = typeof obras.$inferSelect;
type ObraQuoteRow = typeof obraQuotes.$inferSelect;

export function parseCreateObraInput(input: unknown) {
	return createObraSchema.parse(input) as CreateObraInput;
}

export function parseUpdateObraPatch(input: unknown) {
	return updatePatchSchema.parse(input) as UpdateObraPatch &
		Record<string, unknown>;
}

export async function listObras(userId: string, input: ListObrasInput = {}) {
	const conditions = [eq(obras.userId, userId)];
	if (input.status) {
		conditions.push(eq(obras.status, input.status));
	}
	if (input.type) {
		conditions.push(eq(obras.type, input.type));
	}

	const limit = Math.max(1, Math.min(input.limit ?? 200, 500));
	const rows = await db
		.select()
		.from(obras)
		.where(and(...conditions))
		.orderBy(desc(obras.updatedAt))
		.limit(limit);

	return rows.map((row) => toObra(row));
}

export async function getObra(userId: string, id: string) {
	const row = await db.query.obras.findFirst({
		where: and(eq(obras.id, id), eq(obras.userId, userId)),
	});

	if (!row) {
		return null;
	}

	const quotes = await listQuotesForObra(db, userId, id);
	return toObra(row, quotes);
}

export async function createObra(userId: string, rawInput: unknown) {
	const input = parseCreateObraInput(rawInput);
	const now = Date.now();
	const progress = sanitizeProgress(input.progress);
	const external = sanitizeExternal(input.external);
	const metadata = sanitizeMetadata(input.metadata, input.type);

	let startedAt = nullableNumber(input.startedAt);
	let finishedAt = nullableNumber(input.finishedAt);

	if (input.status === "in-progress" && startedAt == null) {
		startedAt = now;
	}

	if (input.status === "finished") {
		if (startedAt == null) {
			startedAt = now;
		}
		if (finishedAt == null) {
			finishedAt = now;
		}
	}

	if (input.type === "movie") {
		const watchedAt = finishedAt ?? startedAt;
		startedAt = watchedAt;
		finishedAt = watchedAt;
	}

	const [row] = await db
		.insert(obras)
		.values({
			id: crypto.randomUUID(),
			userId,
			title: input.title.trim(),
			type: input.type,
			status: input.status,
			review: normalizeOptionalString(input.review),
			tags: normalizeTags(input.tags),
			recommendedBy: normalizeOptionalString(input.recommendedBy),
			readingUrl: normalizeOptionalString(input.readingUrl),
			externalSource: external?.source,
			externalId: external?.id,
			metadata: metadata ?? null,
			coverUrl: normalizeOptionalString(input.coverUrl),
			creator: normalizeOptionalString(input.creator),
			year: nullableNumber(input.year),
			progressCurrent: progress?.current ?? null,
			progressTotal: progress?.total ?? null,
			startedAt,
			finishedAt,
			createdAt: now,
			updatedAt: now,
		})
		.returning();

	return toObra(row);
}

export async function updateObra(
	userId: string,
	id: string,
	rawPatch: unknown,
) {
	const patch = parseUpdateObraPatch(rawPatch);
	const existing = await db.query.obras.findFirst({
		where: and(eq(obras.id, id), eq(obras.userId, userId)),
	});

	if (!existing) {
		throw new Error("Obra no encontrada.");
	}

	const now = Date.now();
	const nextPatch: Partial<typeof obras.$inferInsert> = {
		updatedAt: now,
	};

	if (hasOwn(patch, "title") && patch.title != null) {
		nextPatch.title = patch.title.trim();
	}
	if (hasOwn(patch, "type") && patch.type != null) {
		nextPatch.type = patch.type;
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
	if (hasOwn(patch, "external")) {
		const external = sanitizeExternal(patch.external ?? null);
		nextPatch.externalSource = external?.source ?? null;
		nextPatch.externalId = external?.id ?? null;
	}
	if (hasOwn(patch, "metadata")) {
		nextPatch.metadata = sanitizeMetadata(
			patch.metadata ?? null,
			patch.type ?? existing.type,
		);
	}
	if (hasOwn(patch, "coverUrl")) {
		nextPatch.coverUrl = normalizeOptionalString(patch.coverUrl);
	}
	if (hasOwn(patch, "creator")) {
		nextPatch.creator = normalizeOptionalString(patch.creator);
	}
	if (hasOwn(patch, "year")) {
		nextPatch.year = nullableNumber(patch.year);
	}
	if (hasOwn(patch, "progress")) {
		const progress = sanitizeProgress(patch.progress ?? null);
		nextPatch.progressCurrent = progress?.current ?? null;
		nextPatch.progressTotal = progress?.total ?? null;
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
		nextPatch.finishedAt = null;
	}

	if (nextType === "movie") {
		const watchedAt =
			nextPatch.finishedAt ??
			nextPatch.startedAt ??
			existing.finishedAt ??
			existing.startedAt ??
			null;
		nextPatch.startedAt = watchedAt;
		nextPatch.finishedAt = watchedAt;
	}

	if (hasOwn(patch, "quotes")) {
		return db.transaction(async (tx) => {
			const existingQuotes = await listQuotesForObra(tx, userId, id);
			const [row] = await tx
				.update(obras)
				.set(nextPatch)
				.where(and(eq(obras.id, id), eq(obras.userId, userId)))
				.returning();

			await replaceQuotesForObra(
				tx,
				userId,
				id,
				sanitizeQuotes(patch.quotes ?? []),
				existingQuotes,
				now,
			);

			const quotes = await listQuotesForObra(tx, userId, id);
			return toObra(row, quotes);
		});
	}

	const [row] = await db
		.update(obras)
		.set(nextPatch)
		.where(and(eq(obras.id, id), eq(obras.userId, userId)))
		.returning();

	return toObra(row);
}

export async function removeObra(userId: string, id: string) {
	const [row] = await db
		.delete(obras)
		.where(and(eq(obras.id, id), eq(obras.userId, userId)))
		.returning({ id: obras.id });

	if (!row) {
		throw new Error("Obra no encontrada.");
	}

	return row;
}

export function toObra(row: ObraRow, quoteRows: ObraQuoteRow[] = []): Obra {
	return {
		id: row.id,
		title: row.title,
		type: row.type,
		status: row.status,
		review: row.review ?? undefined,
		tags: row.tags ?? [],
		quotes: quoteRows.map(toObraQuote),
		recommendedBy: row.recommendedBy ?? undefined,
		readingUrl: row.readingUrl ?? undefined,
		coverUrl: row.coverUrl ?? undefined,
		creator: row.creator ?? undefined,
		year: row.year ?? undefined,
		external:
			row.externalSource && row.externalId
				? { source: row.externalSource, id: row.externalId }
				: undefined,
		metadata: row.metadata ?? undefined,
		progress:
			row.progressCurrent != null && row.progressTotal != null
				? {
						current: row.progressCurrent,
						total: row.progressTotal,
					}
				: undefined,
		startedAt: row.startedAt ?? undefined,
		finishedAt: row.finishedAt ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function toObraQuote(row: ObraQuoteRow): ObraQuote {
	return {
		id: row.id,
		obraId: row.obraId,
		content: row.content,
		characterName: row.characterName ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

type QuoteExecutor = Pick<typeof db, "select" | "delete" | "insert">;

async function listQuotesForObra(
	executor: QuoteExecutor,
	userId: string,
	obraId: string,
) {
	return executor
		.select()
		.from(obraQuotes)
		.where(and(eq(obraQuotes.userId, userId), eq(obraQuotes.obraId, obraId)))
		.orderBy(asc(obraQuotes.createdAt));
}

async function replaceQuotesForObra(
	executor: QuoteExecutor,
	userId: string,
	obraId: string,
	quotes: ObraQuotePatch[],
	existingQuotes: ObraQuoteRow[],
	now: number,
) {
	await executor
		.delete(obraQuotes)
		.where(and(eq(obraQuotes.userId, userId), eq(obraQuotes.obraId, obraId)));

	if (quotes.length === 0) {
		return;
	}

	const createdAtById = new Map(
		existingQuotes.map((quote) => [quote.id, quote.createdAt]),
	);

	await executor.insert(obraQuotes).values(
		quotes.map((quote) => {
			const id = quote.id ?? crypto.randomUUID();
			return {
				id,
				userId,
				obraId,
				content: quote.content,
				characterName: normalizeOptionalString(quote.characterName),
				createdAt: createdAtById.get(id) ?? now,
				updatedAt: now,
			};
		}),
	);
}

function sanitizeQuotes(quotes: ObraQuotePatch[]) {
	return quotes.map((quote) => ({
		id: normalizeOptionalString(quote.id) ?? undefined,
		content: quote.content.trim(),
		characterName: normalizeOptionalString(quote.characterName) ?? undefined,
	}));
}

function sanitizeExternal(
	external: ExternalReference | null | undefined,
): ExternalReference | null | undefined {
	if (external === undefined) return undefined;
	if (external === null) return null;

	const source = external.source.trim();
	const id = external.id.trim();
	if (!source || !id) {
		throw new Error("Metadata invalida.");
	}

	return { source: source as ExternalReference["source"], id };
}

function sanitizeMetadata(
	metadata: ObraMetadata | null | undefined,
	obraType?: ObraType,
): ObraMetadata | null | undefined {
	if (metadata === undefined) return undefined;
	if (metadata === null) return null;

	const sanitized: ObraMetadata = {
		pages: nullableNumber(metadata.pages) ?? undefined,
		seasons: nullableNumber(metadata.seasons) ?? undefined,
		episodes: nullableNumber(metadata.episodes) ?? undefined,
		episodesAired: nullableNumber(metadata.episodesAired) ?? undefined,
		nextEpisodeDate: nullableNumber(metadata.nextEpisodeDate) ?? undefined,
		status: normalizeOptionalString(metadata.status) ?? undefined,
		volumes: nullableNumber(metadata.volumes) ?? undefined,
		season: normalizeOptionalString(metadata.season) ?? undefined,
		seasonYear: nullableNumber(metadata.seasonYear) ?? undefined,
		runtime: nullableNumber(metadata.runtime) ?? undefined,
		watchProviders: metadata.watchProviders
			?.map((provider) => normalizeOptionalString(provider))
			.filter((provider): provider is string => Boolean(provider)),
		latestChapter:
			typeof metadata.latestChapter === "number"
				? metadata.latestChapter
				: undefined,
		latestChapterSource: metadata.latestChapterSource ?? undefined,
		latestChapterCheckedAt:
			nullableNumber(metadata.latestChapterCheckedAt) ?? undefined,
		lastNotifiedChapter:
			typeof metadata.lastNotifiedChapter === "number"
				? metadata.lastNotifiedChapter
				: undefined,
		mangaPlusTitleId:
			normalizeOptionalString(metadata.mangaPlusTitleId) ?? undefined,
		mangaDexId: normalizeOptionalString(metadata.mangaDexId) ?? undefined,
	};

	if (obraType === "manga") {
		const legacyChapters = (metadata as { chapters?: number }).chapters;
		const latestChapter = sanitized.latestChapter ?? legacyChapters;
		if (latestChapter !== undefined && sanitized.latestChapter === undefined) {
			sanitized.latestChapter = latestChapter;
		}
	}

	return Object.values(sanitized).some((value) => value !== undefined)
		? sanitized
		: null;
}

function sanitizeProgress(
	progress: ObraProgress | null | undefined,
): ObraProgress | null | undefined {
	if (progress === undefined) return undefined;
	if (progress === null) return null;
	if (progress.total <= 0 || progress.current < 0) {
		throw new Error("Progreso invalido.");
	}
	if (progress.current > progress.total) {
		throw new Error("El progreso no puede superar el total.");
	}

	return progress;
}

export function syncMangaProgressTotal(
	currentTotal: number | null | undefined,
	metadata: ObraMetadata | null | undefined,
	obraType: ObraType,
) {
	if (obraType !== "manga") return currentTotal ?? undefined;
	if (currentTotal == null) return undefined;

	const latestChapter = metadata?.latestChapter;
	if (typeof latestChapter !== "number") return currentTotal;

	return Math.max(currentTotal, latestChapter);
}

function normalizeTags(tags: string[] | null | undefined) {
	if (!tags) return [];

	return tags
		.map((tag) => tag.trim().toLowerCase())
		.filter(Boolean)
		.slice(0, 20);
}

function normalizeOptionalString(value: string | null | undefined) {
	if (value == null) return null;
	const trimmed = value.trim();
	return trimmed || null;
}

function nullableNumber(value: number | null | undefined) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hasOwn<T extends object>(value: T, key: keyof T) {
	return Object.hasOwn(value, key);
}
