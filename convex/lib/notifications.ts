import type { Infer } from "convex/values";
import type { mangaChapterSourceValidator } from "./validators";
import type { ObraMetadata } from "./obras";

export type MangaChapterSource = Infer<typeof mangaChapterSourceValidator>;

export interface MangaReleasePayload {
	type: "manga.release";
	eventId: string;
	obraId: string;
	anilistId: string;
	title: string;
	chapter: number;
	source: MangaChapterSource;
	url?: string;
	detectedAt: number;
}

export function mergeAcknowledgedMangaMetadata(
	existing: ObraMetadata | undefined,
	chapter: number,
	now: number,
): ObraMetadata {
	const nextChapter = Math.max(
		typeof existing?.latestChapter === "number" ? existing.latestChapter : 0,
		chapter,
	);

	return {
		...(existing ?? {}),
		latestChapter: nextChapter,
		lastNotifiedChapter: chapter,
		latestChapterCheckedAt: existing?.latestChapterCheckedAt ?? now,
	};
}

export function mergeMangaMetadata(
	existing: ObraMetadata | undefined,
	details: ObraMetadata,
) {
	const merged: ObraMetadata = {
		...(existing ?? {}),
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

	return merged;
}

export function nextReadProgress(args: {
	currentProgress: number | undefined;
	currentTotal: number | undefined;
	chapter: number;
}) {
	const currentProgress = args.currentProgress ?? 0;
	const alreadyRead = currentProgress >= args.chapter;
	const progressCurrent = Math.max(currentProgress, args.chapter);
	const progressTotal = Math.max(args.currentTotal ?? 0, args.chapter);
	return { progressCurrent, progressTotal, alreadyRead };
}
