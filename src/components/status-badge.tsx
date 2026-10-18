import { statusColors, statusDots } from "@/components/status-tokens";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel } from "@/lib/status";
import type { ObraStatus, ObraType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
	status: ObraStatus;
	type?: ObraType;
	className?: string;
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
	return (
		<Badge
			className={cn(
				"gap-1.5 rounded-none border px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em]",
				statusColors[status],
				className,
			)}
		>
			<span className={cn("h-1.5 w-1.5 rounded-full", statusDots[status])} />
			{getStatusLabel(status, type)}
		</Badge>
	);
}
