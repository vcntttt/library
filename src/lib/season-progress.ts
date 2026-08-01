import type { ObraSeason } from "./types";

export interface SeasonProgress {
	seasonNumber: number;
	episode: number;
	completed: boolean;
}

export function validateSeasons(seasons: ObraSeason[]): ObraSeason[] {
	const unique = new Map<number, ObraSeason>();
	for (const season of seasons) {
		if (
			season.seasonNumber <= 0 ||
			season.episodeCount <= 0 ||
			!Number.isFinite(season.seasonNumber) ||
			!Number.isFinite(season.episodeCount)
		) {
			continue;
		}
		const existing = unique.get(season.seasonNumber);
		if (!existing || season.episodeCount > existing.episodeCount) {
			unique.set(season.seasonNumber, {
				seasonNumber: season.seasonNumber,
				episodeCount: Math.floor(season.episodeCount),
			});
		}
	}
	return Array.from(unique.values()).sort(
		(a, b) => a.seasonNumber - b.seasonNumber,
	);
}

export function totalEpisodesForSeasons(seasons: ObraSeason[]): number {
	return validateSeasons(seasons).reduce(
		(sum, season) => sum + season.episodeCount,
		0,
	);
}

export function mergeSeasons(
	existing: ObraSeason[],
	incoming: ObraSeason[],
): ObraSeason[] {
	return validateSeasons([...existing, ...incoming]);
}

export function getSeasonEndProgress(
	seasons: ObraSeason[],
	seasonNumber: number,
): number {
	const sanitized = validateSeasons(seasons);
	return sanitized
		.filter((season) => season.seasonNumber <= seasonNumber)
		.reduce((total, season) => total + season.episodeCount, 0);
}

export function getSeasonProgress(
	seasons: ObraSeason[],
	totalCurrent: number,
): SeasonProgress | null {
	const sanitized = validateSeasons(seasons);
	if (!sanitized.length) return null;

	const safeCurrent = Math.max(
		0,
		Math.floor(Number.isFinite(totalCurrent) ? totalCurrent : 0),
	);
	const total = totalEpisodesForSeasons(sanitized);

	if (safeCurrent >= total) {
		const last = sanitized[sanitized.length - 1];
		return {
			seasonNumber: last.seasonNumber,
			episode: last.episodeCount,
			completed: true,
		};
	}

	let remaining = safeCurrent;
	for (const season of sanitized) {
		if (remaining <= season.episodeCount) {
			return {
				seasonNumber: season.seasonNumber,
				episode: remaining,
				completed: false,
			};
		}
		remaining -= season.episodeCount;
	}

	const last = sanitized[sanitized.length - 1];
	return {
		seasonNumber: last.seasonNumber,
		episode: last.episodeCount,
		completed: true,
	};
}

export function setSeasonProgress(
	seasons: ObraSeason[],
	seasonNumber: number,
	episode: number,
): number {
	const sanitized = validateSeasons(seasons);
	if (!sanitized.length) return 0;

	const safeSeasonNumber = Math.max(
		1,
		Math.floor(Number.isFinite(seasonNumber) ? seasonNumber : 0),
	);
	let total = 0;
	let found = false;

	for (const season of sanitized) {
		if (season.seasonNumber === safeSeasonNumber) {
			const safeEpisode = Math.max(
				0,
				Math.min(
					Math.floor(Number.isFinite(episode) ? episode : 0),
					season.episodeCount,
				),
			);
			total += safeEpisode;
			found = true;
			break;
		}
		total += season.episodeCount;
	}

	if (!found) {
		const last = sanitized[sanitized.length - 1];
		return totalEpisodesForSeasons(sanitized) === 0
			? 0
			: last.episodeCount +
					totalEpisodesForSeasons(
						sanitized.filter((s) => s.seasonNumber < last.seasonNumber),
					);
	}

	return total;
}

export function formatSeasonProgress(
	seasons: ObraSeason[],
	totalCurrent: number,
): string | null {
	const progress = getSeasonProgress(seasons, totalCurrent);
	if (!progress) return null;
	return `Temporada ${progress.seasonNumber} · Capítulo ${progress.episode}`;
}

export function getInitialSeasonsFromMetadata(
	totalEpisodes?: number,
	seasonCount?: number,
): ObraSeason[] | undefined {
	if (
		!totalEpisodes ||
		!seasonCount ||
		totalEpisodes <= 0 ||
		seasonCount <= 0
	) {
		return undefined;
	}
	const base = Math.floor(totalEpisodes / seasonCount);
	const remainder = totalEpisodes % seasonCount;
	return Array.from({ length: seasonCount }, (_, index) => ({
		seasonNumber: index + 1,
		episodeCount: base + (index < remainder ? 1 : 0),
	}));
}
