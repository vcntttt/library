import type { ObraStatus } from "@/lib/types";

// Clases de color del badge de estado; el texto se mantiene en español en StatusBadge.
export const statusColors: Record<ObraStatus, string> = {
	backlog: "border-border bg-transparent text-muted-foreground",
	"in-progress": "border-primary/40 bg-primary/10 text-primary",
	paused:
		"border-amber-700/40 bg-amber-700/10 text-amber-700 dark:text-amber-200",
	hiatus:
		"border-amber-700/40 bg-amber-700/10 text-amber-700 dark:text-amber-200",
	finished:
		"border-emerald-700/40 bg-emerald-700/10 text-emerald-700 dark:text-emerald-200",
	dropped: "border-destructive/30 bg-destructive/10 text-destructive",
};

// Punto de color que acompaña a cada estado en badges y selectores.
export const statusDots: Record<ObraStatus, string> = {
	backlog: "bg-muted-foreground",
	"in-progress": "bg-primary",
	paused: "bg-amber-700",
	hiatus: "bg-amber-700",
	finished: "bg-emerald-700",
	dropped: "bg-destructive",
};
