import { Badge } from "@/components/ui/badge";
import type { ObraType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TypeIcons } from "./icons";

const typeColors: Record<ObraType, string> = {
	book: "border-[#3A5A40]/30 text-[#3A5A40] dark:text-[#7AA080]",
	movie: "border-[#4A4E69]/30 text-[#4A4E69] dark:text-[#8A8EA9]",
	series: "border-[#BC6C25]/30 text-[#BC6C25]",
	anime: "border-[#9A3B2E]/30 text-[#9A3B2E]",
	manga: "border-[#B85C38]/30 text-[#B85C38]",
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
