import { Badge } from "@/components/ui/badge";
import { getStatusLabel } from "@/lib/status";
import type { ObraStatus, ObraType } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusColors: Record<ObraStatus, string> = {
	backlog: "border-border bg-transparent text-muted-foreground",
	"in-progress": "border-primary/40 bg-primary/10 text-primary",
	finished:
		"border-emerald-700/40 bg-emerald-700/10 text-emerald-700 dark:text-emerald-200",
	dropped: "border-destructive/30 bg-destructive/10 text-destructive",
};

export const statusDots: Record<ObraStatus, string> = {
	backlog: "bg-muted-foreground",
	"in-progress": "bg-primary",
	finished: "bg-emerald-700",
	dropped: "bg-destructive",
};

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
