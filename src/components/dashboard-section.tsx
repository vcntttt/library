import type { Obra } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ObraCard } from "./obra-card";

interface DashboardSectionProps {
	title: string;
	obras: Obra[];
	variant?: "default" | "compact";
	emptyMessage?: string;
	className?: string;
}

export function DashboardSection({
	title,
	obras,
	variant = "default",
	emptyMessage = "No hay nada aun",
	className,
}: DashboardSectionProps) {
	return (
		<section className={cn("space-y-4", className)}>
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-semibold text-foreground">{title}</h2>
				<span className="text-sm text-muted-foreground">{obras.length}</span>
			</div>
			{obras.length > 0 ? (
				<div
					className={cn(
						variant === "default"
							? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
							: "flex flex-col gap-2",
					)}
				>
					{obras.map((obra) => (
						<ObraCard key={obra.id} obra={obra} variant={variant} />
					))}
				</div>
			) : (
				<div className="rounded-lg border border-dashed border-border/50 py-8 text-center">
					<p className="text-sm text-muted-foreground">{emptyMessage}</p>
				</div>
			)}
		</section>
	);
}
