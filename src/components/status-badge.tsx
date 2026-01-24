import { Badge } from "@/components/ui/badge";
import type { ObraStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusColors: Record<ObraStatus, string> = {
	backlog: "border-border/60 bg-muted/60 text-muted-foreground",
	"in-progress":
		"border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
	finished:
		"border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
	dropped: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const statusDots: Record<ObraStatus, string> = {
	backlog: "bg-muted-foreground",
	"in-progress": "bg-amber-500",
	finished: "bg-emerald-500",
	dropped: "bg-rose-500",
};

const statusLabels: Record<ObraStatus, string> = {
	backlog: "Pendiente",
	"in-progress": "En progreso",
	finished: "Terminada",
	dropped: "Abandonada",
};

interface StatusBadgeProps {
	status: ObraStatus;
	className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
	return (
		<Badge
			className={cn(
				"gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em]",
				statusColors[status],
				className,
			)}
		>
			<span className={cn("h-1.5 w-1.5 rounded-full", statusDots[status])} />
			{statusLabels[status]}
		</Badge>
	);
}
