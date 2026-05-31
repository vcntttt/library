import type { ObraStatus, ObraType } from "./types";

const masculineStatusLabels: Record<ObraStatus, string> = {
	backlog: "Pendiente",
	"in-progress": "En progreso",
	paused: "Pausado",
	hiatus: "Hiatus",
	finished: "Terminado",
	dropped: "Abandonado",
};

const feminineStatusLabels: Record<ObraStatus, string> = {
	backlog: "Pendiente",
	"in-progress": "En progreso",
	paused: "Pausada",
	hiatus: "Hiatus",
	finished: "Terminada",
	dropped: "Abandonada",
};

export const pausedStatuses: ObraStatus[] = ["paused", "hiatus"];

export function isPausedStatus(status: ObraStatus): boolean {
	return pausedStatuses.includes(status);
}

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
