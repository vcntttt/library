import {
	ArrowLeft,
	Book,
	BookOpen,
	CheckCircle2,
	ChevronRight,
	Clock,
	Film,
	List,
	PauseCircle,
	Plus,
	Search,
	Sparkles,
	Star,
	Trash2,
	Tv,
	XCircle,
} from "lucide-react";
import type React from "react";
import type { ObraStatus, ObraType } from "@/lib/types";

export const TypeIcons: Record<
	ObraType,
	React.ComponentType<{ className?: string }>
> = {
	book: Book,
	movie: Film,
	series: Tv,
	anime: Sparkles,
	manga: BookOpen,
	manhwa: BookOpen,
};

export const StatusIcons: Record<
	ObraStatus,
	React.ComponentType<{ className?: string }>
> = {
	backlog: List,
	"in-progress": Clock,
	paused: PauseCircle,
	hiatus: PauseCircle,
	finished: CheckCircle2,
	dropped: XCircle,
};

export { Star, Plus, Search, ChevronRight, ArrowLeft, Trash2 };
