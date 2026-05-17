import type { Obra, ObraMetadata, ObraType } from "@/lib/types";

export function getProgressTotalFromMetadata(
	type: ObraType,
	metadata: ObraMetadata | undefined,
) {
	if (!metadata) return undefined;
	if (type === "book") return metadata.pages;
	if (type === "manga") return metadata.latestChapter;
	if (type === "series" || type === "anime") return metadata.episodes;
	return undefined;
}

export function getInitialProgressTotal(obra: Obra) {
	return (
		obra.progress?.total ??
		getProgressTotalFromMetadata(obra.type, obra.metadata) ??
		0
	);
}
