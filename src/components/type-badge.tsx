import type { ObraType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TypeIcons } from "./icons";

const typeColors: Record<ObraType, string> = {
	book: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
	movie: "bg-blue-500/10 text-blue-400 border-blue-500/20",
	series: "bg-orange-500/10 text-orange-400 border-orange-500/20",
	anime: "bg-pink-500/10 text-pink-400 border-pink-500/20",
	manga: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

const typeLabels: Record<ObraType, string> = {
	book: "Libro",
	movie: "Pelicula",
	series: "Serie",
	anime: "Anime",
	manga: "Manga",
};

interface TypeBadgeProps {
	type: ObraType;
	showIcon?: boolean;
	className?: string;
}

export function TypeBadge({
	type,
	showIcon = true,
	className,
}: TypeBadgeProps) {
	const Icon = TypeIcons[type];

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
				typeColors[type],
				className,
			)}
		>
			{showIcon && <Icon className="h-3 w-3" />}
			{typeLabels[type]}
		</span>
	);
}
