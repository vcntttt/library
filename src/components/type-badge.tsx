import { Badge } from "@/components/ui/badge";
import type { ObraType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TypeIcons } from "./icons";

const typeColors: Record<ObraType, string> = {
	book: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
	movie: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
	series:
		"border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
	anime: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
	manga: "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
};

const typeLabels: Record<ObraType, string> = {
	book: "Libro",
	movie: "Película",
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
		<Badge
			className={cn(
				"gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em]",
				typeColors[type],
				className,
			)}
		>
			{showIcon && <Icon className="h-3 w-3" />}
			{typeLabels[type]}
		</Badge>
	);
}
