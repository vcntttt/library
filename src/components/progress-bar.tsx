import { formatProgressValue, getProgressUnitLabel } from "@/lib/progress";
import type { ObraFormat, ObraType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
	current: number;
	total: number;
	type: ObraType;
	format?: ObraFormat;
	showLabel?: boolean;
	className?: string;
}

export function ProgressBar({
	current,
	total,
	type,
	format,
	showLabel = true,
	className,
}: ProgressBarProps) {
	const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;
	const obra = { type, format };
	const unitLabel = getProgressUnitLabel(obra);

	return (
		<div className={cn("space-y-1", className)}>
			<div className="h-1 w-full bg-border">
				<div
					className="h-full bg-primary"
					style={{ width: `${percentage}%` }}
				/>
			</div>
			{showLabel && (
				<p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
					{formatProgressValue(current, obra)} /{" "}
					{formatProgressValue(total, obra)} {unitLabel}
				</p>
			)}
		</div>
	);
}
