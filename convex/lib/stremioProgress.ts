import { unzlibSync } from "fflate";

export interface StremioVideo {
	id: string;
	season: number;
	episode: number;
	released?: string;
}

// Stremio anchors its compressed bitmap to the last watched video, allowing the
// catalog to grow without treating replays or skipped episodes as new progress.
export function countWatchedEpisodes(
	serialized: string,
	videos: StremioVideo[],
) {
	if (!serialized) return 0;
	const parts = serialized.split(":");
	const encoded = parts.pop();
	const length = Number(parts.pop());
	const anchor = parts.join(":");
	if (
		!encoded ||
		!Number.isInteger(length) ||
		length < 1 ||
		length > 100_000 ||
		encoded.length > 100_000
	)
		throw new Error("Progreso de episodios de Stremio inválido.");
	const sorted = [...videos].sort(
		(a, b) =>
			a.season - b.season ||
			a.episode - b.episode ||
			(a.released ?? "").localeCompare(b.released ?? ""),
	);
	const anchorIndex = sorted.findIndex((video) => video.id === anchor);
	if (anchorIndex < 0)
		throw new Error(
			"No se pudo vincular el progreso con los episodios de Stremio.",
		);
	const compressed = Uint8Array.from(atob(encoded), (character) =>
		character.charCodeAt(0),
	);
	const bytes = unzlibSync(compressed, {
		out: new Uint8Array(Math.ceil(100_000 / 8)),
	});
	const offset = length - 1 - anchorIndex;
	return sorted.reduce((total, video, index) => {
		const previous = index + offset;
		return (
			total +
			(video.season > 0 &&
			previous >= 0 &&
			previous < length &&
			((bytes[Math.floor(previous / 8)] ?? 0) & (1 << (previous % 8))) !== 0
				? 1
				: 0)
		);
	}, 0);
}
