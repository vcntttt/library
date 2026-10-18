import { formatSeasonProgress } from "@/lib/season-progress";
import type { Obra } from "@/lib/types";

// Avance que muestra la portada: el porcentaje se acota a 100 y la etiqueta de temporada aplica solo a series y anime.
export function getCoverProgress(obra: Obra) {
	const showProgress =
		obra.type !== "movie" && obra.status !== "backlog" && obra.progress;
	const progressTotal = obra.progress?.total ?? 0;
	const progressCurrent = obra.progress?.current ?? 0;
	const progressPercent =
		progressTotal > 0
			? Math.min(100, (progressCurrent / progressTotal) * 100)
			: 0;
	const seasonProgressLabel =
		(obra.type === "series" || obra.type === "anime") &&
		obra.progressSeasons?.length
			? formatSeasonProgress(obra.progressSeasons, progressCurrent)
			: null;
	return {
		showProgress,
		progressTotal,
		progressCurrent,
		progressPercent,
		seasonProgressLabel,
	};
}
