"use client";

import { RecommendationBadge } from "@/components/recommendation-badge";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import type { Obra } from "@/lib/types";
import { ObraStatusPicker } from "./obra-status-picker";

interface ObraStatusCellProps {
	obra: Obra;
	showOngoingBadge: boolean;
	showUpToDateBadge: boolean;
}

export function ObraStatusCell({
	obra,
	showOngoingBadge,
	showUpToDateBadge,
}: ObraStatusCellProps) {
	const hasProgress = obra.type !== "movie";
	const progressTotal = obra.progress?.total ?? 0;
	const progressCurrent = obra.progress?.current ?? 0;
	const showProgress =
		hasProgress &&
		obra.status !== "backlog" &&
		obra.status !== "finished" &&
		progressTotal > 0;

	return (
		<ObraStatusPicker obra={obra}>
			<div className="flex flex-col items-start gap-2 text-left">
				<div className="flex flex-wrap items-center gap-2">
					<StatusBadge status={obra.status} type={obra.type} />
					{obra.recommendedBy && (
						<RecommendationBadge
							variant="icon"
							recommendedBy={obra.recommendedBy}
						/>
					)}
					{showOngoingBadge && (
						<Badge
							variant="outline"
							className="rounded-none border-[#4A4E69]/40 bg-[#4A4E69]/10 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] text-[#4A4E69] dark:text-[#B9BEDB]"
						>
							En emisión
						</Badge>
					)}
					{showUpToDateBadge && (
						<Badge
							variant="outline"
							className="rounded-none border-[#3A5A40]/40 bg-[#3A5A40]/10 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] text-[#3A5A40] dark:text-[#A8D5AD]"
						>
							Al día
						</Badge>
					)}
				</div>
				{showProgress && (
					<div className="w-28">
						<div className="h-1 w-full bg-border">
							<div
								className="h-full bg-primary"
								style={{
									width: `${Math.min((progressCurrent / progressTotal) * 100, 100)}%`,
								}}
							/>
						</div>
					</div>
				)}
			</div>
		</ObraStatusPicker>
	);
}
