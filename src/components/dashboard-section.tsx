import type { Obra } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ObraCard } from "./obra-card";

interface DashboardSectionProps {
	title: string;
	obras: Obra[];
	variant?: "default" | "compact" | "grid";
	emptyMessage?: string;
	getSecondaryText?: (obra: Obra) => string | undefined;
	className?: string;
}

export function DashboardSection({
	title,
	obras,
	variant = "default",
	emptyMessage = "No hay nada aun",
	getSecondaryText,
	className,
}: DashboardSectionProps) {
	return (
		<section className={cn("space-y-4", className)}>
			<div className="flex items-baseline justify-between">
				<h2 className="font-serif text-xl">{title}</h2>
				<span className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
					{obras.length} obras
				</span>
			</div>
			{obras.length > 0 ? (
				<div
					className={cn(
						variant === "default"
							? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
							: variant === "grid"
								? "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
								: "flex flex-col gap-3",
					)}
				>
					{obras.map((obra) => (
						<ObraCard
							key={obra.id}
							obra={obra}
							variant={variant}
							secondaryText={getSecondaryText?.(obra)}
						/>
					))}
				</div>
			) : (
				<div className="border border-dashed border-border bg-card py-8 text-center">
					<p className="text-sm text-muted-foreground">{emptyMessage}</p>
				</div>
			)}
		</section>
	);
}
