import { Link } from "@tanstack/react-router";
import type { Obra } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronRight } from "./icons";
import { ProgressBar } from "./progress-bar";
import { StarRating } from "./star-rating";
import { StatusBadge } from "./status-badge";
import { TypeBadge } from "./type-badge";

interface ObraCardProps {
	obra: Obra;
	variant?: "default" | "compact";
	className?: string;
}

export function ObraCard({
	obra,
	variant = "default",
	className,
}: ObraCardProps) {
	const showProgress =
		obra.progress &&
		obra.type !== "movie" &&
		(obra.status === "in-progress" || obra.status === "backlog");

	if (variant === "compact") {
		return (
			<Link
				to="/obra/$obraId"
				params={{ obraId: obra.id }}
				className={cn(
					"group flex items-center justify-between rounded-2xl border border-border/60 bg-card/70 px-4 py-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:bg-card hover:shadow-md",
					className,
				)}
			>
				<div className="flex items-center gap-3 min-w-0">
					<TypeBadge type={obra.type} showIcon={false} />
					<span className="truncate font-medium">{obra.title}</span>
				</div>
				<div className="flex items-center gap-3">
					{obra.rating && <StarRating rating={obra.rating} size="sm" />}
					<ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
				</div>
			</Link>
		);
	}

	return (
		<Link
			to="/obra/$obraId"
			params={{ obraId: obra.id }}
			className={cn(
				"group flex flex-col rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:bg-card hover:shadow-md",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 mb-1">
						<TypeBadge type={obra.type} />
						<StatusBadge status={obra.status} />
					</div>
					<h3 className="truncate font-semibold text-foreground font-serif group-hover:text-foreground/90">
						{obra.title}
					</h3>
					{obra.creator && (
						<p className="text-sm text-muted-foreground truncate">
							{obra.creator}
						</p>
					)}
				</div>
				{obra.rating && <StarRating rating={obra.rating} size="sm" />}
			</div>

			{showProgress && obra.progress && (
				<div className="mt-3">
					<ProgressBar
						current={obra.progress.current}
						total={obra.progress.total}
						type={obra.type}
					/>
				</div>
			)}

			{obra.tags.length > 0 && (
				<div className="mt-3 flex flex-wrap gap-1">
					{obra.tags.slice(0, 3).map((tag) => (
						<span
							key={tag}
							className="rounded-full border border-border/60 bg-muted/60 px-2.5 py-0.5 text-[0.65rem] tracking-[0.08em] text-muted-foreground"
						>
							{tag}
						</span>
					))}
					{obra.tags.length > 3 && (
						<span className="text-xs text-muted-foreground">
							+{obra.tags.length - 3}
						</span>
					)}
				</div>
			)}
		</Link>
	);
}
