import { Badge } from "@/components/ui/badge";
import { getBookFormatLabel } from "@/lib/progress";
import type { ObraFormat, ObraType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TypeIcons } from "./icons";

const typeColors: Record<ObraType, string> = {
	book: "border-emerald-700/40 text-emerald-700 dark:text-emerald-200",
	movie: "border-slate-700/40 text-slate-700 dark:text-slate-200",
	series: "border-amber-700/40 text-amber-700 dark:text-amber-200",
	anime: "border-destructive/30 text-destructive",
	manga: "border-primary/30 text-primary",
	manhwa: "border-sky-500/30 text-sky-500",
};

const typeLabels: Record<ObraType, string> = {
	book: "Libro",
	movie: "Película",
	series: "Serie",
	anime: "Anime",
	manga: "Manga",
	manhwa: "Manhwa",
};

interface TypeBadgeProps {
	type: ObraType;
	format?: ObraFormat;
	showIcon?: boolean;
	className?: string;
}

export function TypeBadge({
	type,
	format,
	showIcon = true,
	className,
}: TypeBadgeProps) {
	const Icon = TypeIcons[type];
	const label = type === "book" ? getBookFormatLabel(format) : typeLabels[type];

	return (
		<Badge
			className={cn(
				"gap-1.5 rounded-none border bg-transparent px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em]",
				typeColors[type],
				className,
			)}
		>
			{showIcon && <Icon className="size-3" />}
			{label}
		</Badge>
	);
}
