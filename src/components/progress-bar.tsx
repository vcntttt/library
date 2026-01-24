import type { ObraType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
	current: number;
	total: number;
	type: ObraType;
	showLabel?: boolean;
	className?: string;
}

const progressColors: Record<ObraType, string> = {
	book: "bg-emerald-500",
	movie: "bg-blue-500",
	series: "bg-orange-500",
	anime: "bg-pink-500",
	manga: "bg-cyan-500",
};

const unitLabels: Record<ObraType, string> = {
	book: "pag",
	movie: "",
	series: "eps",
	anime: "eps",
	manga: "caps",
};

export function ProgressBar({
	current,
	total,
	type,
	showLabel = true,
	className,
}: ProgressBarProps) {
	const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;

	return (
		<div className={cn("space-y-1", className)}>
			<div className="h-2 w-full overflow-hidden rounded-full bg-muted/60 shadow-inner">
				<div
					className={cn(
						"h-full rounded-full transition-all duration-500",
						progressColors[type],
					)}
					style={{ width: `${percentage}%` }}
				/>
			</div>
			{showLabel && (
				<p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
					{current} / {total} {unitLabels[type]}
				</p>
			)}
		</div>
	);
}
