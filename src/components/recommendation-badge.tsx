import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface RecommendationBadgeProps {
	className?: string;
	recommendedBy?: string;
	variant?: "full" | "icon";
}

const recommendationBadgeClass =
	"rounded-none border-yellow-500/60 bg-yellow-400/14 text-yellow-700 shadow-[0_0_18px_rgba(250,204,21,0.16)] dark:border-yellow-300/55 dark:bg-yellow-300/12 dark:text-yellow-200";

export function RecommendationBadge({
	className,
	recommendedBy,
	variant = "full",
}: RecommendationBadgeProps) {
	const label = recommendedBy
		? `Recomendada por ${recommendedBy}`
		: "Recomendada";

	if (variant === "icon") {
		return (
			<Tooltip>
				<TooltipTrigger render={<span />} className="inline-flex shrink-0">
					<Badge
						variant="outline"
						aria-label={label}
						className={cn("size-5 p-0", recommendationBadgeClass, className)}
					>
						<Sparkles className="size-3" />
					</Badge>
				</TooltipTrigger>
				<TooltipContent
					side="bottom"
					className={cn(
						"rounded-none px-2.5 py-1 text-xs font-medium normal-case tracking-normal",
						recommendationBadgeClass,
					)}
					arrowClassName="bg-yellow-400/14 fill-yellow-400/14 dark:bg-yellow-300/12 dark:fill-yellow-300/12"
				>
					{label}
				</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<Badge
			variant="outline"
			className={cn(
				"gap-1 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em]",
				recommendationBadgeClass,
				className,
			)}
		>
			<Sparkles className="size-3" />
			Recomendada
		</Badge>
	);
}
