import {
	ArrowLeft,
	Book,
	BookOpen,
	CheckCircle2,
	ChevronRight,
	Clock,
	Edit,
	Film,
	List,
	MoreHorizontal,
	Plus,
	Search,
	SlidersHorizontal,
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
};

export const StatusIcons: Record<
	ObraStatus,
	React.ComponentType<{ className?: string }>
> = {
	backlog: List,
	"in-progress": Clock,
	finished: CheckCircle2,
	dropped: XCircle,
};

export {
	Star,
	Plus,
	Search,
	SlidersHorizontal,
	ChevronRight,
	ArrowLeft,
	Trash2,
	Edit,
	MoreHorizontal,
};
