import {
	Book,
	BookOpen,
	CheckCircle2,
	Clock,
	Film,
	List,
	PauseCircle,
	Sparkles,
	Tv,
	XCircle,
} from "lucide-react";
import type { ComponentType } from "react";
import type { ObraStatus, ObraType } from "@/lib/types";

// Icono de lucide por tipo de obra; se usa en badges, selectores y formularios.
export const TypeIcons: Record<
	ObraType,
	ComponentType<{ className?: string }>
> = {
	book: Book,
	movie: Film,
	series: Tv,
	anime: Sparkles,
	manga: BookOpen,
	manhwa: BookOpen,
};

// Icono de lucide por estado de obra.
export const StatusIcons: Record<
	ObraStatus,
	ComponentType<{ className?: string }>
> = {
	backlog: List,
	"in-progress": Clock,
	paused: PauseCircle,
	hiatus: PauseCircle,
	finished: CheckCircle2,
	dropped: XCircle,
};
