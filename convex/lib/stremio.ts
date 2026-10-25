import type { Doc } from "../_generated/dataModel";

export interface StremioLibraryItem {
	_id: string;
	mtime: number;
	name: string;
	type: string;
	removed: boolean;
	temp: boolean;
	state?: {
		timeWatched?: number;
		timeOffset?: number;
		lastWatched?: number;
		flaggedWatched?: number;
		timesWatched?: number;
		duration?: number;
		overallTimeWatched?: number;
		watched?: string;
		video_id?: string;
		videoId?: string;
	};
}

export interface StremioLibraryEntry {
	id: string;
	mtime: number;
}

export function parseStremioEntries(value: unknown): StremioLibraryEntry[] {
	const result = unwrapResult(value);
	const entries: StremioLibraryEntry[] = [];
	if (Array.isArray(result)) {
		for (const item of result) {
			if (Array.isArray(item) && typeof item[0] === "string") {
				const mtime = parseMtime(item[1]);
				if (mtime !== undefined) entries.push({ id: item[0], mtime });
			} else if (isRecord(item) && typeof item._id === "string") {
				const mtime = parseMtime(item.mtime ?? item._mtime);
				if (mtime !== undefined) entries.push({ id: item._id, mtime });
			} else {
				throw new Error("Stremio devolvió metadatos de biblioteca inválidos.");
			}
		}
	} else if (isRecord(result)) {
		for (const [id, rawMtime] of Object.entries(result)) {
			const mtime = parseMtime(rawMtime);
			if (mtime !== undefined) entries.push({ id, mtime });
			else
				throw new Error("Stremio devolvió metadatos de biblioteca inválidos.");
		}
	} else {
		throw new Error("Stremio devolvió metadatos de biblioteca inválidos.");
	}
	return entries.sort(
		(a, b) => a.mtime - b.mtime || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
	);
}

export function parseStremioItems(value: unknown): StremioLibraryItem[] {
	const result = unwrapResult(value);
	if (!Array.isArray(result)) throw new Error("Respuesta inválida de Stremio.");
	return result.flatMap((raw) => {
		if (
			!isRecord(raw) ||
			typeof raw._id !== "string" ||
			typeof raw.name !== "string" ||
			typeof raw.type !== "string"
		) {
			throw new Error("Stremio devolvió un elemento de biblioteca inválido.");
		}
		if (raw.state !== undefined && !isRecord(raw.state)) {
			throw new Error("Stremio devolvió un estado de reproducción inválido.");
		}
		const state = isRecord(raw.state) ? raw.state : undefined;
		return [
			{
				_id: raw._id,
				mtime: parseMtime(raw._mtime ?? raw.mtime) ?? 0,
				name: raw.name,
				type: raw.type,
				removed: raw.removed === true,
				temp: raw.temp === true,
				state: state
					? {
							timeWatched: finiteOptional(
								state.time_watched ?? state.timeWatched,
							),
							timeOffset: finiteOptional(state.time_offset ?? state.timeOffset),
							lastWatched: parseMtime(state.last_watched ?? state.lastWatched),
							flaggedWatched: finiteOptional(
								state.flagged_watched ?? state.flaggedWatched,
							),
							timesWatched: finiteOptional(
								state.times_watched ?? state.timesWatched,
							),
							duration: finiteOptional(state.duration),
							overallTimeWatched: finiteOptional(
								state.overall_time_watched ?? state.overallTimeWatched,
							),
							watched:
								typeof state.watched === "string" ? state.watched : undefined,
							video_id:
								typeof state.video_id === "string" ? state.video_id : undefined,
							videoId:
								typeof state.videoId === "string" ? state.videoId : undefined,
						}
					: undefined,
			},
		];
	});
}

export function stremioItemHasStarted(item: StremioLibraryItem): boolean {
	return (
		(item.state?.timeWatched ?? 0) > 0 ||
		(item.state?.timeOffset ?? 0) > 0 ||
		(item.state?.timesWatched ?? 0) > 0 ||
		(item.state?.flaggedWatched ?? 0) > 0 ||
		(item.state?.overallTimeWatched ?? 0) > 0 ||
		Boolean(item.state?.watched)
	);
}

export function shouldImportStremioItem(
	currentMtime: number | undefined,
	incomingMtime: number,
): boolean {
	return currentMtime === undefined || incomingMtime > currentMtime;
}

export function mergeImportedProgress(
	current: number | undefined,
	total: number | undefined,
	incomingCurrent: number | undefined,
	incomingTotal: number | undefined,
): { current?: number; total?: number } {
	if (incomingCurrent === undefined || incomingTotal === undefined) {
		return { current, total };
	}
	return {
		current: Math.max(current ?? 0, incomingCurrent),
		total: Math.max(total ?? 0, incomingTotal),
	};
}

export function getImportedStatus(
	type: "movie" | "series",
	watchedMovie: boolean,
	seriesStatus?: string,
	progressCurrent?: number,
	progressTotal?: number,
): "in-progress" | "finished" {
	if (type === "movie") return watchedMovie ? "finished" : "in-progress";
	return seriesStatus === "Ended" &&
		progressTotal !== undefined &&
		progressTotal > 0 &&
		(progressCurrent ?? 0) >= progressTotal
		? "finished"
		: "in-progress";
}

export function mergeImportedWatchMetadata(
	existing: Doc<"obras">["metadata"],
	incoming: {
		seasons?: number;
		episodes?: number;
		watchProviders: string[];
		status?: string;
	},
): NonNullable<Doc<"obras">["metadata"]> {
	return {
		...existing,
		seasons: existing?.seasons ?? incoming.seasons,
		episodes: existing?.episodes ?? incoming.episodes,
		watchProviders: incoming.watchProviders,
		status: incoming.status ?? existing?.status,
	};
}

export function getImdbId(id: string): string | undefined {
	const imdbId = id.split(":")[0];
	return imdbId && /^tt\d+$/.test(imdbId) ? imdbId : undefined;
}

export function sanitizedStremioError(
	status?: number,
	retryAfter?: string | null,
): string {
	if (status === 401 || status === 403)
		return "Stremio rechazó la autenticación. Revisa las credenciales.";
	if (status === 429) {
		const secondsValue = retryAfter ? Number(retryAfter) : NaN;
		const seconds = Number.isFinite(secondsValue)
			? Math.max(1, secondsValue)
			: retryAfter && Number.isFinite(Date.parse(retryAfter))
				? Math.max(1, (Date.parse(retryAfter) - Date.now()) / 1000)
				: 3600;
		return `Stremio limitó las solicitudes. Intenta de nuevo en ${Math.ceil(seconds / 60)} min.`;
	}
	if (status !== undefined && status >= 500)
		return "Stremio no está disponible temporalmente.";
	return "No se pudo sincronizar con Stremio. Inténtalo más tarde.";
}

function unwrapResult(value: unknown): unknown {
	if (!isRecord(value)) throw new Error("Respuesta inválida de Stremio.");
	if (value.error) throw new Error("Stremio rechazó la solicitud.");
	return value.result;
}

function finiteOptional(value: unknown): number | undefined {
	const number = Number(value);
	return Number.isFinite(number) && value != null ? number : undefined;
}

function parseMtime(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string") return undefined;
	const numeric = Number(value);
	if (Number.isFinite(numeric)) return numeric;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
