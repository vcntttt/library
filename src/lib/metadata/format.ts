import type { Obra } from "@/lib/types";

const statusLabels: Record<string, string> = {
	"Returning Series": "En emisión",
	Ended: "Finalizada",
	Canceled: "Cancelada",
	"In Production": "En producción",
	Planned: "Planeada",
	Pilot: "Piloto",
	Released: "Estrenada",
	"Post Production": "Postproducción",
	Rumored: "Rumoreada",
	FINISHED: "Finalizada",
	RELEASING: "En emisión",
	HIATUS: "En pausa",
	NOT_YET_RELEASED: "No estrenada",
	CANCELLED: "Cancelada",
};

const ongoingStatuses = new Set(["Returning Series", "RELEASING"]);

export const formatMetadataStatus = (status?: string) => {
	if (!status) return undefined;
	return statusLabels[status] ?? status;
};

export const getObraMetaLine = (obra: Obra) => {
	const metadata = obra.metadata;
	const parts: string[] = [];

	if (obra.type === "book") {
		if (metadata?.pages)
			parts.push(`${metadata.pages.toLocaleString()} páginas`);
		if (!parts.length && obra.year) parts.push(`Año ${obra.year}`);
	}

	if (obra.type === "movie") {
		if (metadata?.runtime) parts.push(`${metadata.runtime} min`);
		if (obra.year) parts.push(String(obra.year));
		const status = formatMetadataStatus(metadata?.status);
		if (status) parts.push(status);
	}

	if (obra.type === "series") {
		if (metadata?.seasons) parts.push(`${metadata.seasons} temporadas`);
		if (metadata?.episodes) parts.push(`${metadata.episodes} episodios`);
		const status = formatMetadataStatus(metadata?.status);
		if (status) parts.push(status);
	}

	if (obra.type === "anime") {
		if (metadata?.episodes) parts.push(`${metadata.episodes} episodios`);
		const status = formatMetadataStatus(metadata?.status);
		if (status) parts.push(status);
		if (!parts.length && obra.year) parts.push(`Año ${obra.year}`);
	}

	if (obra.type === "manga") {
		const chapterCount = metadata?.latestChapter ?? metadata?.chapters;
		if (chapterCount) parts.push(`${chapterCount} capítulos`);
		if (!parts.length && metadata?.volumes)
			parts.push(`${metadata.volumes} volúmenes`);
		const status = formatMetadataStatus(metadata?.status);
		if (status) parts.push(status);
		if (!parts.length && obra.year) parts.push(`Año ${obra.year}`);
	}

	const compact = parts.filter(Boolean).slice(0, 2).join(" • ");
	return compact || undefined;
};

export const isMetadataOngoing = (status?: string) => {
	if (!status) return false;
	return ongoingStatuses.has(status);
};

export const isObraUpToDate = (obra: Obra) => {
	if (obra.type !== "series" && obra.type !== "anime" && obra.type !== "manga")
		return false;
	const status = obra.metadata?.status;
	if (!isMetadataOngoing(status)) return false;
	const releasedCount =
		obra.type === "manga"
			? (obra.metadata?.latestChapter ?? obra.metadata?.chapters)
			: obra.metadata?.episodesAired;
	if (!releasedCount || releasedCount <= 0) return false;
	const progressCurrent = obra.progress?.current ?? 0;
	return progressCurrent >= releasedCount;
};
