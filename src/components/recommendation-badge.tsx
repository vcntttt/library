import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RecommendationBadgeProps {
	className?: string;
}

export function RecommendationBadge({ className }: RecommendationBadgeProps) {
	return (
		<Badge
			variant="outline"
			className={cn(
				"gap-1 rounded-none border-amber-700/40 bg-amber-700/10 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] text-amber-800 dark:border-amber-300/40 dark:bg-amber-300/10 dark:text-amber-200",
				className,
			)}
		>
			<Sparkles className="size-3" />
			Recomendada
		</Badge>
	);
}
