import { Link } from "@tanstack/react-router";
import { getObraMetaLine } from "@/lib/metadata/format";
import type { Obra } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronRight } from "./icons";
import { ProgressBar } from "./progress-bar";
import { StarRating } from "./star-rating";
import { StatusBadge } from "./status-badge";
import { TypeBadge } from "./type-badge";

interface ObraCardProps {
	obra: Obra;
	variant?: "default" | "compact" | "grid";
	secondaryText?: string;
	className?: string;
}

export function ObraCard({
	obra,
	variant = "default",
	secondaryText,
	className,
}: ObraCardProps) {
	const showProgress =
		obra.progress &&
		obra.type !== "movie" &&
		(obra.status === "in-progress" || obra.status === "backlog");
	const metaLine = getObraMetaLine(obra);

	if (variant === "grid") {
		return (
			<Link
				to="/obra/$obraId"
				params={{ obraId: obra.id }}
				className={cn(
					"group flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card/70 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:bg-card hover:shadow-md",
					className,
				)}
			>
				<div className="aspect-[2/3] w-full bg-muted/60">
					{obra.coverUrl ? (
						<img
							src={obra.coverUrl}
							alt=""
							className="h-full w-full object-cover"
							loading="lazy"
						/>
					) : (
						<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
							Sin portada
						</div>
					)}
				</div>
				<div className="space-y-1 p-2.5">
					<div className="flex items-center gap-2">
						<TypeBadge type={obra.type} />
						<StatusBadge status={obra.status} />
					</div>
					<h3 className="truncate text-sm font-semibold text-foreground font-serif group-hover:text-foreground/90">
						{obra.title}
					</h3>
					{obra.creator && (
						<p className="text-[0.7rem] text-muted-foreground truncate">
							{obra.creator}
						</p>
					)}
					{metaLine && (
						<p className="text-[0.7rem] text-muted-foreground truncate">
							{metaLine}
						</p>
					)}
					{obra.rating && <StarRating rating={obra.rating} size="sm" />}
				</div>
			</Link>
		);
	}

	if (variant === "compact") {
		return (
			<Link
				to="/obra/$obraId"
				params={{ obraId: obra.id }}
				className={cn(
					"group flex items-center justify-between rounded-lg border border-border/60 bg-card/70 px-4 py-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:bg-card hover:shadow-md",
					className,
				)}
			>
				<div className="flex items-center gap-3 min-w-0">
					{obra.coverUrl && (
						<div className="h-10 w-7 overflow-hidden rounded-md bg-muted/60">
							<img
								src={obra.coverUrl}
								alt=""
								className="h-full w-full object-cover"
								loading="lazy"
							/>
						</div>
					)}
					<TypeBadge type={obra.type} showIcon={false} />
					<div className="min-w-0">
						<span className="block truncate font-medium">{obra.title}</span>
						{(secondaryText ?? metaLine) && (
							<span className="block text-xs text-muted-foreground">
								{secondaryText ?? metaLine}
							</span>
						)}
					</div>
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
				"group flex flex-col rounded-lg border border-border/60 bg-card/70 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:bg-card hover:shadow-md",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-start gap-3 min-w-0 flex-1">
					{obra.coverUrl && (
						<div className="h-16 w-12 overflow-hidden rounded-lg bg-muted/60">
							<img
								src={obra.coverUrl}
								alt=""
								className="h-full w-full object-cover"
								loading="lazy"
							/>
						</div>
					)}
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
						{metaLine && (
							<p className="text-xs text-muted-foreground truncate">
								{metaLine}
							</p>
						)}
					</div>
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
