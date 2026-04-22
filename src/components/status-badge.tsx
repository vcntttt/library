import { Badge } from "@/components/ui/badge";
import type { ObraStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusColors: Record<ObraStatus, string> = {
	backlog: "border-[#D6D0C7] bg-transparent text-[#8C8279]",
	"in-progress": "border-[#B85C38]/40 bg-[#B85C38]/8 text-[#B85C38]",
	finished:
		"border-[#3A5A40]/30 bg-[#3A5A40]/8 text-[#3A5A40] dark:text-[#7AA080]",
	dropped: "border-[#9A3B2E]/30 bg-[#9A3B2E]/8 text-[#9A3B2E]",
};

const statusDots: Record<ObraStatus, string> = {
	backlog: "bg-[#8C8279]",
	"in-progress": "bg-[#B85C38]",
	finished: "bg-[#3A5A40]",
	dropped: "bg-[#9A3B2E]",
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
