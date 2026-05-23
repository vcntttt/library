import type { ObraStatus, ObraType } from "./types";

const masculineStatusLabels: Record<ObraStatus, string> = {
	backlog: "Pendiente",
	"in-progress": "En progreso",
	finished: "Terminado",
	dropped: "Abandonado",
};

const feminineStatusLabels: Record<ObraStatus, string> = {
	backlog: "Pendiente",
	"in-progress": "En progreso",
	finished: "Terminada",
	dropped: "Abandonada",
};

const genderByType: Record<ObraType, "masculine" | "feminine"> = {
	book: "masculine",
	movie: "feminine",
	series: "feminine",
	anime: "masculine",
	manga: "masculine",
	manhwa: "masculine",
};

export function getStatusLabel(status: ObraStatus, type?: ObraType): string {
	if (!type) return feminineStatusLabels[status];
	const gender = genderByType[type];
	return gender === "masculine"
		? masculineStatusLabels[status]
		: feminineStatusLabels[status];
}
