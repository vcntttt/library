import { resolveCustomPatchValue } from "@/lib/custom-fields";
import { getInitialProgressTotal } from "@/lib/progress";
import { validateSeasons } from "@/lib/season-progress";
import type { Obra, ObraFormat, ObraSeason, ObraStatus } from "@/lib/types";
import { formatDateInput, parseDateInput } from "@/lib/utils";

export interface EditableQuote {
	clientId: string;
	id?: string;
	content: string;
	characterName: string;
}

export interface EditValues {
	customTitle: string;
	customCreator: string;
	customYear: string;
	customCoverUrl: string;
	format: ObraFormat | "";
	readingUrl: string;
	sourceUrl: string;
	recommendedBy: string;
	startedAt: string;
	finishedAt: string;
	review: string;
	progressCurrent: number;
	progressTotal: number;
	progressSeasons: ObraSeason[];
}

export type SavePatch = Record<string, unknown>;

// Cambia los valores locales y, si hay parche, lo encola para guardarlo. Sin `debounceKey` se guarda al instante.
export type UpdateValues = (
	nextValues: EditValues,
	patch: SavePatch | null,
	debounceKey?: string,
	delayMs?: number,
) => void;

export const bookFormats: ObraFormat[] = ["physical", "ebook", "audiobook"];

export const normalizeReadingUrl = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
};

export function getEditValues(obra: Obra): EditValues {
	return {
		customTitle: obra.title,
		customCreator: obra.creator ?? "",
		customYear: obra.year ? String(obra.year) : "",
		customCoverUrl: obra.coverUrl ?? "",
		format: obra.format ?? "",
		readingUrl: obra.readingUrl ?? "",
		sourceUrl: obra.sourceUrl ?? "",
		recommendedBy: obra.recommendedBy ?? "",
		startedAt: formatDateInput(
			obra.type === "movie"
				? (obra.finishedAt ?? obra.startedAt)
				: obra.startedAt,
		),
		finishedAt: formatDateInput(
			obra.type === "movie"
				? (obra.finishedAt ?? obra.startedAt)
				: obra.finishedAt,
		),
		review: obra.review ?? "",
		progressCurrent: obra.progress?.current ?? 0,
		progressTotal: getInitialProgressTotal(obra),
		progressSeasons: obra.progressSeasons ?? [],
	};
}

export function getEditableQuotes(obra: Obra): EditableQuote[] {
	return obra.quotes.map((quote) => ({
		clientId: quote.id,
		id: quote.id,
		content: quote.content,
		characterName: quote.characterName ?? "",
	}));
}

// Convex ignora `undefined`, pero `null` limpia un valor. Solo se manda `null` si el obra
// tenía un valor que ahora se borra; si no, la clave se omite para que el servidor no lo toque.
function clearedValue<T>(
	next: T | undefined,
	current: unknown,
): T | null | undefined {
	if (next !== undefined) return next;
	return current != null && current !== "" ? null : undefined;
}

export function buildCustomPatch(values: EditValues, obra: Obra) {
	const year = Number(values.customYear);
	return {
		customTitle: clearedValue(
			values.customTitle.trim() || undefined,
			obra.customTitle,
		),
		customCreator: resolveCustomPatchValue({
			next: values.customCreator.trim() || undefined,
			custom: obra.customCreator,
			original: obra.originalCreator,
			blank: "",
		}),
		customYear: resolveCustomPatchValue({
			next:
				values.customYear.trim() && Number.isFinite(year) ? year : undefined,
			custom: obra.customYear,
			original: obra.originalYear,
			blank: 0,
		}),
		customCoverUrl: resolveCustomPatchValue({
			next: values.customCoverUrl.trim() || undefined,
			custom: obra.customCoverUrl,
			original: obra.originalCoverUrl,
			blank: "",
		}),
	};
}

export function buildFormatPatch(
	values: Pick<EditValues, "format">,
	obra: Obra,
) {
	return {
		format: clearedValue(values.format || undefined, obra.format),
	};
}

export function buildPersonalPatch(values: EditValues, obra: Obra) {
	const isMovie = obra.type === "movie";
	const movieWatchedAt = isMovie
		? (parseDateInput(values.finishedAt) ?? parseDateInput(values.startedAt))
		: undefined;
	const currentMovieWatchedAt = obra.finishedAt ?? obra.startedAt;

	return {
		readingUrl: clearedValue(
			values.readingUrl.trim() || undefined,
			obra.readingUrl,
		),
		sourceUrl: clearedValue(
			values.sourceUrl.trim() || undefined,
			obra.sourceUrl,
		),
		recommendedBy: values.recommendedBy.trim(),
		startedAt: isMovie
			? clearedValue(movieWatchedAt, currentMovieWatchedAt)
			: clearedValue(parseDateInput(values.startedAt), obra.startedAt),
		finishedAt: isMovie
			? clearedValue(movieWatchedAt, currentMovieWatchedAt)
			: clearedValue(parseDateInput(values.finishedAt), obra.finishedAt),
		review: clearedValue(values.review.trim() || undefined, obra.review),
	};
}

export function buildProgressPatch(
	values: Pick<
		EditValues,
		"progressCurrent" | "progressTotal" | "progressSeasons"
	>,
	obra: Obra,
	status?: ObraStatus,
) {
	if (obra.type === "movie") return null;
	const patch: SavePatch = { ...(status ? { status } : {}) };
	// El servidor rechaza cualquier progreso de un obra ligada a un documento de lectura.
	if (obra.readingDocumentId) return patch;
	const total = Math.max(0, Math.floor(values.progressTotal || 0));
	const current = Math.min(
		Math.max(0, Math.floor(values.progressCurrent || 0)),
		total,
	);
	const seasons = validateSeasons(values.progressSeasons);
	if (total <= 0) {
		if (obra.progress) patch.progress = null;
		if (obra.progressSeasons?.length) patch.progressSeasons = null;
		return patch;
	}
	patch.progress = { current, total };
	if (seasons.length > 0) {
		patch.progressSeasons = seasons;
	}
	return patch;
}

export function buildQuotesPatch(quotes: EditableQuote[]) {
	return {
		quotes: quotes
			.map((quote) => ({
				id: quote.id,
				content: quote.content.trim(),
				characterName: quote.characterName.trim() || undefined,
			}))
			.filter((quote) => quote.content),
	};
}
