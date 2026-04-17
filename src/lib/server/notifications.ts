import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import {
	type MangaReleasePayload,
	notificationEvents,
	obras,
} from "@/db/schema";
import { getMetadataDetails } from "@/lib/metadata/providers";
import type { ObraMetadata } from "@/lib/types";

const DEFAULT_POLL_LIMIT = 10;
const MAX_POLL_LIMIT = 50;
const DEFAULT_INTERVAL_MS = 2 * 60 * 60 * 1000;

declare global {
	var __libraryMangaWorkerStarted: boolean | undefined;
	var __libraryMangaWorkerTimer: ReturnType<typeof setInterval> | undefined;
}

export async function checkForNewChapters() {
	const tracked = await db
		.select()
		.from(obras)
		.where(
			and(
				eq(obras.type, "manga"),
				ne(obras.status, "dropped"),
				eq(obras.externalSource, "anilist"),
			),
		);

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
				"manga",
			);
			const merged = mergeMangaMetadata(obra.metadata ?? undefined, details);
			const [updatedRow] = await db
				.update(obras)
				.set({
					metadata: merged,
					updatedAt: Date.now(),
				})
				.where(eq(obras.id, obra.id))
				.returning({ id: obras.id });

			if (updatedRow) {
				updated += 1;
			}

			const latestChapter = merged?.latestChapter ?? merged?.chapters;
			const lastNotifiedChapter = obra.metadata?.lastNotifiedChapter ?? 0;
			if (!latestChapter || latestChapter <= lastNotifiedChapter) {
				continue;
			}

			const payload: MangaReleasePayload = {
				type: "manga.release",
				eventId: `${obra.id}:${latestChapter}`,
				obraId: obra.id,
				anilistId: obra.externalId,
				title: obra.title,
				chapter: latestChapter,
				source: merged?.latestChapterSource ?? "anilist",
				detectedAt: Date.now(),
			};

			const result = await enqueueReleaseNotification(payload);
			if (result.enqueued) {
				enqueued += 1;
			}
		} catch (error) {
			console.error("[manga-worker] check failed", {
				obraId: obra.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return { checked, updated, enqueued };
}

export async function pullNotificationEvents(limit = DEFAULT_POLL_LIMIT) {
	const safeLimit = Math.max(1, Math.min(limit, MAX_POLL_LIMIT));
	const rows = await db
		.select()
		.from(notificationEvents)
		.where(eq(notificationEvents.status, "pending"))
		.orderBy(asc(notificationEvents.createdAt))
		.limit(safeLimit);

	const now = Date.now();
	const events = [] as Array<{
		eventId: string;
		attempts: number;
		lastAttemptAt: number;
		payload: MangaReleasePayload;
	}>;

	for (const row of rows) {
		const attempts = row.attempts + 1;
		await db
			.update(notificationEvents)
			.set({ attempts, lastAttemptAt: now, updatedAt: now })
			.where(eq(notificationEvents.id, row.id));

		events.push({
			eventId: row.eventId,
			attempts,
			lastAttemptAt: now,
			payload: {
				type: "manga.release",
				eventId: row.eventId,
				obraId: row.obraId,
				anilistId: row.anilistId,
				title: row.title,
				chapter: row.chapter,
				source: row.source,
				url: row.url ?? undefined,
				detectedAt: row.detectedAt,
			},
		});
	}

	return { events };
}

export async function ackNotificationEvent(
	eventId: string,
	status: "delivered" | "failed",
	error?: string,
) {
	const event = await db.query.notificationEvents.findFirst({
		where: eq(notificationEvents.eventId, eventId),
	});

	if (!event) {
		return { ok: false, reason: "not_found" as const };
	}

	const now = Date.now();
	if (status === "failed") {
		await db
			.update(notificationEvents)
			.set({
				status: "pending",
				lastError: error?.trim() || "error-desconocido",
				updatedAt: now,
			})
			.where(eq(notificationEvents.id, event.id));

		return { ok: true, status: "pending" as const };
	}

	await db
		.update(notificationEvents)
		.set({
			status: "delivered",
			deliveredAt: now,
			lastError: null,
			updatedAt: now,
		})
		.where(eq(notificationEvents.id, event.id));

	const obra = await db.query.obras.findFirst({
		where: eq(obras.id, event.obraId),
	});

	if (obra) {
		const metadata: ObraMetadata = {
			...(obra.metadata ?? {}),
			lastNotifiedChapter: event.chapter,
			latestChapter:
				typeof obra.metadata?.latestChapter === "number"
					? Math.max(obra.metadata.latestChapter, event.chapter)
					: event.chapter,
			latestChapterCheckedAt: obra.metadata?.latestChapterCheckedAt ?? now,
		};

		await db
			.update(obras)
			.set({ metadata, updatedAt: now })
			.where(eq(obras.id, obra.id));
	}

	return { ok: true, status: "delivered" as const };
}

export async function enqueueReleaseNotification(payload: MangaReleasePayload) {
	const existing = await db.query.notificationEvents.findFirst({
		where: eq(notificationEvents.eventId, payload.eventId),
	});

	if (existing) {
		return { enqueued: false, eventId: existing.eventId };
	}

	const now = Date.now();
	await db.insert(notificationEvents).values({
		id: crypto.randomUUID(),
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
}

export function ensureMangaReleaseWorkerStarted() {
	if (globalThis.__libraryMangaWorkerStarted) return;
	if (process.env.MANGA_RELEASE_WORKER_DISABLED === "true") return;

	globalThis.__libraryMangaWorkerStarted = true;
	const intervalMs = Math.max(
		60_000,
		Number(process.env.MANGA_RELEASE_WORKER_INTERVAL_MS ?? DEFAULT_INTERVAL_MS),
	);

	void checkForNewChapters().catch((error) => {
		console.error("[manga-worker] initial run failed", error);
	});

	globalThis.__libraryMangaWorkerTimer = setInterval(() => {
		void checkForNewChapters().catch((error) => {
			console.error("[manga-worker] scheduled run failed", error);
		});
	}, intervalMs);
}

function mergeMangaMetadata(
	existing: ObraMetadata | undefined,
	details: Awaited<ReturnType<typeof getMetadataDetails>>,
) {
	const merged: ObraMetadata = {
		...(existing ?? {}),
		chapters: details.chapters ?? existing?.chapters,
		volumes: details.volumes ?? existing?.volumes,
		status: details.status ?? existing?.status,
		latestChapter: details.latestChapter ?? existing?.latestChapter,
		latestChapterSource:
			details.latestChapterSource ?? existing?.latestChapterSource,
		latestChapterCheckedAt:
			details.latestChapterCheckedAt ??
			existing?.latestChapterCheckedAt ??
			Date.now(),
		mangaPlusTitleId: details.mangaPlusTitleId ?? existing?.mangaPlusTitleId,
		mangaDexId: details.mangaDexId ?? existing?.mangaDexId,
		lastNotifiedChapter: existing?.lastNotifiedChapter,
	};

	if (
		typeof details.latestChapter === "number" &&
		(typeof merged.chapters !== "number" ||
			details.latestChapter > merged.chapters)
	) {
		merged.chapters = details.latestChapter;
	}

	return merged;
}
