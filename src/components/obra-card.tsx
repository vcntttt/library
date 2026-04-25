import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { getObraMetaLine } from "@/lib/metadata/format";
import type { Obra } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronRight } from "./icons";
import { ProgressBar } from "./progress-bar";
import { StatusBadge } from "./status-badge";
import { TypeBadge } from "./type-badge";

interface ObraCardProps {
	obra: Obra;
	variant?: "default" | "compact" | "grid";
	secondaryText?: string;
	className?: string;
}

const normalizeReadingUrl = (value?: string) => {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
};

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
	const readingUrl = normalizeReadingUrl(obra.readingUrl);

	if (variant === "grid") {
		return (
			<article
				className={cn(
					"group relative flex h-full flex-col overflow-hidden border border-border bg-card transition-all duration-300 hover:border-primary hover:shadow-sm focus-within:border-primary focus-within:shadow-sm",
					className,
				)}
			>
				<Link
					to="/obra/$obraId"
					params={{ obraId: obra.id }}
					className="flex h-full flex-col"
				>
					<div className="relative aspect-[4/5] w-full max-h-60 overflow-hidden bg-background sm:aspect-[2/3] sm:max-h-none">
						{obra.coverUrl ? (
							<img
								src={obra.coverUrl}
								alt={`Portada de ${obra.title}`}
								className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
								loading="lazy"
							/>
						) : (
							<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
								Sin portada
							</div>
						)}
						<div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
					</div>
					<div className="space-y-2 p-4 pt-3.5">
						<div className="flex flex-wrap items-center gap-1.5">
							<TypeBadge type={obra.type} />
							<StatusBadge status={obra.status} />
						</div>
						<h3 className="truncate text-sm font-semibold text-card-foreground font-serif transition-colors group-hover:text-primary">
							{obra.title}
						</h3>
						{obra.creator && (
							<p className="truncate text-xs text-muted-foreground">
								{obra.creator}
							</p>
						)}
						{metaLine && (
							<p className="truncate text-xs text-muted-foreground">
								{metaLine}
							</p>
						)}
					</div>
				</Link>
				{readingUrl && (
					<a
						href={readingUrl}
						target="_blank"
						rel="noreferrer"
						className="absolute right-3 top-3 z-10 inline-flex h-8 items-center gap-1.5 border border-white/15 bg-black/55 px-2.5 text-[0.65rem] uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm transition-all duration-300 hover:border-white/30 hover:bg-black/72 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus-visible:translate-y-0 sm:focus-visible:opacity-100"
					>
						<ExternalLink className="h-3.5 w-3.5" />
						Ir a leer
					</a>
				)}
			</article>
		);
	}

	if (variant === "compact") {
		return (
			<Link
				to="/obra/$obraId"
				params={{ obraId: obra.id }}
				className={cn(
					"group flex items-center justify-between border-b border-border py-3 transition-colors hover:border-primary",
					className,
				)}
			>
				<div className="flex items-center gap-3 min-w-0">
					{obra.coverUrl && (
						<div className="h-10 w-7 overflow-hidden bg-background">
							<img
								src={obra.coverUrl}
								alt={`Portada de ${obra.title}`}
								className="h-full w-full object-cover"
								loading="lazy"
							/>
						</div>
					)}
					<TypeBadge type={obra.type} showIcon={false} />
					<div className="min-w-0">
						<span className="block truncate font-medium text-card-foreground group-hover:text-primary transition-colors">
							{obra.title}
						</span>
						{(secondaryText ?? metaLine) && (
							<span className="block text-xs text-muted-foreground">
								{secondaryText ?? metaLine}
							</span>
						)}
					</div>
				</div>
				<ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
			</Link>
		);
	}

	return (
		<article
			className={cn(
				"group flex flex-col border border-border bg-card transition-all duration-300 hover:border-primary hover:shadow-sm",
				className,
			)}
		>
			<Link
				to="/obra/$obraId"
				params={{ obraId: obra.id }}
				className="flex flex-1 flex-col p-4"
			>
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 flex-1 items-start gap-3">
						{obra.coverUrl && (
							<div className="h-16 w-12 overflow-hidden bg-background">
								<img
									src={obra.coverUrl}
									alt={`Portada de ${obra.title}`}
									className="h-full w-full object-cover"
									loading="lazy"
								/>
							</div>
						)}
						<div className="min-w-0 flex-1">
							<div className="mb-1 flex items-center gap-2">
								<TypeBadge type={obra.type} />
								<StatusBadge status={obra.status} />
							</div>
							<h3 className="truncate font-semibold text-card-foreground font-serif transition-colors group-hover:text-primary">
								{obra.title}
							</h3>
							{obra.creator && (
								<p className="truncate text-sm text-muted-foreground">
									{obra.creator}
								</p>
							)}
							{metaLine && (
								<p className="truncate text-xs text-muted-foreground">
									{metaLine}
								</p>
							)}
						</div>
					</div>
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
					<div className="mt-3 flex flex-wrap gap-2">
						{obra.tags.slice(0, 3).map((tag) => (
							<span
								key={tag}
								className="border-b border-border pb-0.5 text-xs text-muted-foreground"
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
			{readingUrl && (
				<div className="border-t border-border px-4 py-3">
					<a
						href={readingUrl}
						target="_blank"
						rel="noreferrer"
						className="inline-flex h-9 items-center gap-1.5 border border-border bg-card px-3 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
					>
						<ExternalLink className="h-3.5 w-3.5" />
						Ir a leer
					</a>
				</div>
			)}
		</article>
	);
}
