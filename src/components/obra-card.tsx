import { Link } from "@tanstack/react-router";
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
					"group flex flex-col overflow-hidden border border-[#D6D0C7] bg-white transition-all duration-300 hover:border-[#B85C38] hover:shadow-sm",
					className,
				)}
			>
				<div className="aspect-[4/5] w-full max-h-56 bg-[#F5F2EB] sm:aspect-[2/3] sm:max-h-none">
					{obra.coverUrl ? (
						<img
							src={obra.coverUrl}
							alt={`Portada de ${obra.title}`}
							className="h-full w-full object-cover"
							loading="lazy"
						/>
					) : (
						<div className="flex h-full items-center justify-center text-xs text-[#8C8279]">
							Sin portada
						</div>
					)}
				</div>
				<div className="space-y-1 p-3">
					<div className="flex items-center gap-2">
						<TypeBadge type={obra.type} />
						<StatusBadge status={obra.status} />
					</div>
					<h3 className="truncate text-sm font-semibold text-[#1A1A1A] font-serif group-hover:text-[#B85C38] transition-colors">
						{obra.title}
					</h3>
					{obra.creator && (
						<p className="truncate text-xs text-[#8C8279]">{obra.creator}</p>
					)}
					{metaLine && (
						<p className="truncate text-xs text-[#8C8279]">{metaLine}</p>
					)}
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
					"group flex items-center justify-between border-b border-[#D6D0C7] py-3 transition-colors hover:border-[#B85C38]",
					className,
				)}
			>
				<div className="flex items-center gap-3 min-w-0">
					{obra.coverUrl && (
						<div className="h-10 w-7 overflow-hidden bg-[#F5F2EB]">
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
						<span className="block truncate font-medium text-[#1A1A1A] group-hover:text-[#B85C38] transition-colors">
							{obra.title}
						</span>
						{(secondaryText ?? metaLine) && (
							<span className="block text-xs text-[#8C8279]">
								{secondaryText ?? metaLine}
							</span>
						)}
					</div>
				</div>
				<ChevronRight className="h-4 w-4 text-[#8C8279] opacity-0 transition-opacity group-hover:opacity-100" />
			</Link>
		);
	}

	return (
		<Link
			to="/obra/$obraId"
			params={{ obraId: obra.id }}
			className={cn(
				"group flex flex-col border border-[#D6D0C7] bg-white p-4 transition-all duration-300 hover:border-[#B85C38] hover:shadow-sm",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-start gap-3 min-w-0 flex-1">
					{obra.coverUrl && (
						<div className="h-16 w-12 overflow-hidden bg-[#F5F2EB]">
							<img
								src={obra.coverUrl}
								alt={`Portada de ${obra.title}`}
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
						<h3 className="truncate font-semibold text-[#1A1A1A] font-serif group-hover:text-[#B85C38] transition-colors">
							{obra.title}
						</h3>
						{obra.creator && (
							<p className="text-sm text-[#8C8279] truncate">{obra.creator}</p>
						)}
						{metaLine && (
							<p className="text-xs text-[#8C8279] truncate">{metaLine}</p>
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
							className="text-xs text-[#8C8279] border-b border-[#D6D0C7] pb-0.5"
						>
							{tag}
						</span>
					))}
					{obra.tags.length > 3 && (
						<span className="text-xs text-[#8C8279]">
							+{obra.tags.length - 3}
						</span>
					)}
				</div>
			)}
		</Link>
	);
}
