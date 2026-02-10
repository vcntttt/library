import { ExternalLink } from "lucide-react";
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

const normalizeReadingUrl = (value?: string) => {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
};

export function DashboardSection({
	title,
	obras,
	variant = "default",
	emptyMessage = "No hay nada aun",
	getSecondaryText,
	className,
}: DashboardSectionProps) {
	return (
		<section className={cn("space-y-3", className)}>
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-semibold text-foreground font-serif">
					{title}
				</h2>
				<span className="rounded-full border border-border/60 bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
					{obras.length}
				</span>
			</div>
			{obras.length > 0 ? (
				<div
					className={cn(
						variant === "default"
							? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
							: variant === "grid"
								? "grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
								: "flex flex-col gap-2",
					)}
				>
					{obras.map((obra) => {
						const readingUrl = normalizeReadingUrl(obra.readingUrl);
						return (
							<div key={obra.id} className="space-y-2">
								<ObraCard
									obra={obra}
									variant={variant}
									secondaryText={getSecondaryText?.(obra)}
								/>
								{readingUrl && (
									<a
										href={readingUrl}
										target="_blank"
										rel="noreferrer"
										className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
									>
										<ExternalLink className="h-3.5 w-3.5" />
										Ir a leer
									</a>
								)}
							</div>
						);
					})}
				</div>
			) : (
				<div className="rounded-xl border border-dashed border-border/60 bg-card/60 py-8 text-center">
					<p className="text-sm text-muted-foreground">{emptyMessage}</p>
				</div>
			)}
		</section>
	);
}
