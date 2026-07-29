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

export interface EpisodicReleasePayload {
	type: "media.episode.release";
	eventId: string;
	obraId: string;
	externalId: string;
	title: string;
	episode: number;
	seasonNumber?: number;
	episodeNumber?: number;
	source: "tmdb" | "anilist";
	url?: string;
	detectedAt: number;
}

export type ReleasePayload = MangaReleasePayload | EpisodicReleasePayload;

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

export function mergeEpisodicMetadata(
	existing: ObraMetadata | undefined,
	details: ObraMetadata,
	now = Date.now(),
) {
	const maxOptional = (left?: number, right?: number) => {
		if (left === undefined) return right;
		if (right === undefined) return left;
		return Math.max(left, right);
	};

	const merged: ObraMetadata = {
		...(existing ?? {}),
		seasons: maxOptional(existing?.seasons, details.seasons),
		episodes: maxOptional(existing?.episodes, details.episodes),
		episodesAired: maxOptional(
			existing?.episodesAired,
			details.episodesAired,
		),
		latestSeasonNumber:
			details.latestSeasonNumber ?? existing?.latestSeasonNumber,
		latestEpisodeNumber:
			details.latestEpisodeNumber ?? existing?.latestEpisodeNumber,
		nextEpisodeDate: details.nextEpisodeDate,
		latestEpisodeCheckedAt: details.latestEpisodeCheckedAt ?? now,
		status: details.status ?? existing?.status,
		runtime: details.runtime ?? existing?.runtime,
		watchProviders: details.watchProviders ?? existing?.watchProviders,
		lastNotifiedEpisode: existing?.lastNotifiedEpisode,
	};

	return merged;
}

export function getNewEpisodeRelease(
	existing: ObraMetadata | undefined,
	next: ObraMetadata,
) {
	const released = next.episodesAired;
	if (!released || released <= 0) return undefined;
	const baseline = existing?.lastNotifiedEpisode ?? existing?.episodesAired;
	if (baseline === undefined || released <= baseline) return undefined;
	return released;
}

export function mergeAcknowledgedEpisodeMetadata(
	existing: ObraMetadata | undefined,
	episode: number,
	now: number,
): ObraMetadata {
	return {
		...(existing ?? {}),
		episodesAired: Math.max(existing?.episodesAired ?? 0, episode),
		lastNotifiedEpisode: Math.max(
			existing?.lastNotifiedEpisode ?? 0,
			episode,
		),
		latestEpisodeCheckedAt: existing?.latestEpisodeCheckedAt ?? now,
	};
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
