import { Badge } from "@/components/ui/badge";
import type { ObraStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusColors: Record<ObraStatus, string> = {
	backlog: "border-border bg-transparent text-muted-foreground",
	"in-progress": "border-primary/40 bg-primary/10 text-primary",
	finished:
		"border-emerald-700/30 bg-emerald-700/10 text-emerald-700 dark:text-emerald-300",
	dropped: "border-destructive/30 bg-destructive/10 text-destructive",
};

const statusDots: Record<ObraStatus, string> = {
	backlog: "bg-muted-foreground",
	"in-progress": "bg-primary",
	finished: "bg-emerald-700",
	dropped: "bg-destructive",
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
				"gap-1.5 rounded-none border px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.2em]",
				statusColors[status],
				className,
			)}
		>
			<span className={cn("h-1.5 w-1.5 rounded-full", statusDots[status])} />
			{statusLabels[status]}
		</Badge>
	);
}
