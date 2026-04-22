import { Badge } from "@/components/ui/badge";
import type { ObraType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TypeIcons } from "./icons";

const typeColors: Record<ObraType, string> = {
	book: "border-emerald-700/30 text-emerald-700 dark:text-emerald-300",
	movie: "border-slate-700/30 text-slate-700 dark:text-slate-300",
	series: "border-amber-700/30 text-amber-700 dark:text-amber-300",
	anime: "border-destructive/30 text-destructive",
	manga: "border-primary/30 text-primary",
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
				"gap-1.5 rounded-none border px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.2em] bg-transparent",
				typeColors[type],
				className,
			)}
		>
			{showIcon && <Icon className="h-3 w-3" />}
			{typeLabels[type]}
		</Badge>
	);
}
