import type { ObraStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusColors: Record<ObraStatus, string> = {
	backlog: "text-muted-foreground",
	"in-progress": "text-amber-400",
	finished: "text-emerald-400",
	dropped: "text-red-400",
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
		<span
			className={cn(
				"inline-flex items-center text-xs font-medium",
				statusColors[status],
				className,
			)}
		>
			<span
				className={cn(
					"mr-1.5 h-1.5 w-1.5 rounded-full",
					status === "backlog" && "bg-muted-foreground",
					status === "in-progress" && "bg-amber-400",
					status === "finished" && "bg-emerald-400",
					status === "dropped" && "bg-red-400",
				)}
			/>
			{statusLabels[status]}
		</span>
	);
}
