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
				"h-5 gap-1 rounded-none border-amber-700/30 bg-amber-700/10 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-amber-800 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-200",
				className,
			)}
		>
			<Sparkles className="h-3 w-3" />
			Recomendada
		</Badge>
	);
}
