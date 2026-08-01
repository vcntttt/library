import type { Obra, ObraType } from "@/lib/types";

export interface MetadataHealth {
	missing: string[];
	hasExternalSource: boolean;
}

const labels: Record<string, string> = {
	creator: "creador / director / autor",
	year: "año",
	cover: "portada",
	pages: "páginas",
	runtime: "duración",
	seasons: "temporadas",
	episodes: "episodios",
	volumes: "volúmenes",
	latestChapter: "capítulos",
};

const fieldsByType: Record<ObraType, string[]> = {
	book: ["creator", "year", "cover", "pages"],
	movie: ["creator", "year", "cover", "runtime"],
	series: ["creator", "year", "cover", "seasons", "episodes"],
	anime: ["creator", "year", "cover", "episodes"],
	manga: ["creator", "year", "cover", "volumes"],
	manhwa: ["creator", "year", "cover", "latestChapter"],
};

export function getMetadataHealth(obra: Obra): MetadataHealth {
	const metadata = obra.metadata;
	const missing = fieldsByType[obra.type].filter((field) => {
		switch (field) {
			case "creator":
				return !obra.originalCreator && !obra.creator;
			case "year":
				return !obra.originalYear && !obra.year;
			case "cover":
				return !obra.originalCoverUrl && !obra.coverUrl;
			default:
				return metadata?.[field as keyof typeof metadata] == null;
		}
	});

	return {
		missing: missing.map((field) => labels[field] ?? field),
		hasExternalSource: Boolean(obra.external),
	};
}
