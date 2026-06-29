import type { Obra, ObraFormat, ObraMetadata, ObraType } from "@/lib/types";

export function isAudiobook(obra: Pick<Obra, "type" | "format">) {
	return obra.type === "book" && obra.format === "audiobook";
}

export function getProgressUnitLabel(obra: Pick<Obra, "type" | "format">) {
	if (isAudiobook(obra)) return "minutos";
	if (obra.type === "book") return "páginas";
	if (obra.type === "series" || obra.type === "anime") return "episodios";
	if (obra.type === "manga" || obra.type === "manhwa") return "capítulos";
	return "";
}

export function formatDurationMinutes(minutes: number) {
	const safeMinutes = Math.max(0, Math.floor(minutes));
	const hours = Math.floor(safeMinutes / 60);
	const remainingMinutes = safeMinutes % 60;
	if (hours <= 0) return `${remainingMinutes} min`;
	if (remainingMinutes <= 0) return `${hours} h`;
	return `${hours} h ${remainingMinutes} min`;
}

export function formatProgressValue(
	value: number,
	obra: Pick<Obra, "type" | "format">,
) {
	if (isAudiobook(obra)) return formatDurationMinutes(value);
	return value.toLocaleString();
}

export function getBookFormatLabel(format?: ObraFormat) {
	if (format === "audiobook") return "Audiolibro";
	if (format === "ebook") return "Libro";
	if (format === "physical") return "Libro físico";
	return "Libro";
}

export function getProgressTotalFromMetadata(
	type: ObraType,
	metadata: ObraMetadata | undefined,
	format?: ObraFormat,
) {
	if (!metadata) return undefined;
	if (type === "book" && format === "audiobook") {
		return metadata.durationMinutes;
	}
	if (type === "book") return metadata.pages;
	if (type === "manga" || type === "manhwa") return metadata.latestChapter;
	if (type === "series" || type === "anime") return metadata.episodes;
	return undefined;
}

export function getInitialProgressTotal(obra: Obra) {
	return (
		obra.progress?.total ??
		getProgressTotalFromMetadata(obra.type, obra.metadata, obra.format) ??
		0
	);
}
