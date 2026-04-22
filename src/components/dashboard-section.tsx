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
		<section className={cn("space-y-4", className)}>
			<div className="flex items-baseline justify-between">
				<h2 className="font-serif text-xl">{title}</h2>
				<span className="text-[0.65rem] uppercase tracking-[0.3em] text-[#8C8279]">
					{obras.length} obras
				</span>
			</div>
			{obras.length > 0 ? (
				<div
					className={cn(
						variant === "default"
							? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
							: variant === "grid"
								? "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
								: "flex flex-col gap-3",
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
										className="inline-flex h-9 items-center gap-1.5 border border-[#D6D0C7] bg-white px-3 text-xs text-[#8C8279] transition-colors hover:border-[#B85C38] hover:text-[#1A1A1A]"
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
				<div className="border border-dashed border-[#D6D0C7] bg-white py-8 text-center">
					<p className="text-sm text-[#8C8279]">{emptyMessage}</p>
				</div>
			)}
		</section>
	);
}
