import type { ObraType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
	current: number;
	total: number;
	type: ObraType;
	showLabel?: boolean;
	className?: string;
}

const unitLabels: Record<ObraType, string> = {
	book: "páginas",
	movie: "",
	series: "episodios",
	anime: "episodios",
	manga: "capítulos",
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
			<div className="h-px w-full bg-[#D6D0C7]">
				<div
					className="h-full bg-[#B85C38]"
					style={{ width: `${percentage}%` }}
				/>
			</div>
			{showLabel && (
				<p className="text-[0.6rem] uppercase tracking-[0.2em] text-[#8C8279]">
					{current} / {total} {unitLabels[type]}
				</p>
			)}
		</div>
	);
}
