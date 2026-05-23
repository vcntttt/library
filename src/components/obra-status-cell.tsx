"use client";

import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Check, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { StatusBadge, statusDots } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { getStatusLabel } from "@/lib/status";
import type { Obra, ObraStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const allStatuses: ObraStatus[] = [
	"backlog",
	"in-progress",
	"finished",
	"dropped",
];

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
	const updateObra = useMutation(convexApi.obras.update);
	const [isPickerOpen, setIsPickerOpen] = useState(false);
	const [isReviewOpen, setIsReviewOpen] = useState(false);
	const [reviewDraft, setReviewDraft] = useState("");

	const hasProgress = obra.type !== "movie";
	const progressTotal = obra.progress?.total ?? 0;
	const progressCurrent = obra.progress?.current ?? 0;
	const showProgress =
		hasProgress && obra.status !== "finished" && progressTotal > 0;

	const releasedCount =
		obra.type === "manga" || obra.type === "manhwa"
			? obra.metadata?.latestChapter
			: obra.metadata?.episodesAired;
	const canMarkUpToDate =
		showOngoingBadge && releasedCount && releasedCount > 0;

	const handleStatusChange = async (nextStatus: ObraStatus) => {
		await updateObra({
			id: obra.id as Id<"obras">,
			patch: { status: nextStatus },
		});
		setIsPickerOpen(false);

		if (nextStatus === "finished" && !obra.review) {
			setReviewDraft("");
			setIsReviewOpen(true);
		}
	};

	const handleProgressChange = async (
		nextCurrent: number,
		nextTotal: number,
	) => {
		const safeCurrent = Math.min(
			Math.max(Math.round(nextCurrent), 0),
			Math.round(nextTotal),
		);
		const safeTotal = Math.max(Math.round(nextTotal), 0);

		const patch: Record<string, unknown> = {
			progress:
				safeTotal === 0 ? null : { current: safeCurrent, total: safeTotal },
		};

		if (obra.status !== "in-progress" && safeCurrent > 0) {
			patch.status = "in-progress";
		}

		await updateObra({
			id: obra.id as Id<"obras">,
			patch,
		});
	};

	const handleMarkUpToDate = async () => {
		if (!releasedCount || releasedCount <= 0) return;
		const nextTotal = Math.max(progressTotal, releasedCount);
		const patch: Record<string, unknown> = {
			progress: { current: releasedCount, total: nextTotal },
		};
		if (obra.status !== "in-progress") {
			patch.status = "in-progress";
		}
		await updateObra({
			id: obra.id as Id<"obras">,
			patch,
		});
		setIsPickerOpen(false);
	};

	const handleSaveReview = async () => {
		const trimmed = reviewDraft.trim();
		await updateObra({
			id: obra.id as Id<"obras">,
			patch: { review: trimmed || undefined },
		});
		setIsReviewOpen(false);
	};

	const handleSkipReview = () => {
		setIsReviewOpen(false);
	};

	return (
		<>
			<button
				type="button"
				className="flex flex-col items-start gap-2 text-left"
				onClick={(e) => {
					e.stopPropagation();
					setIsPickerOpen(true);
				}}
			>
				<div className="flex flex-wrap items-center gap-2">
					<StatusBadge status={obra.status} type={obra.type} />
					{obra.recommendedBy && (
						<Badge
							variant="outline"
							className="rounded-none border-[#B85C38]/40 bg-[#B85C38]/10 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] text-[#B85C38]"
						>
							Recomendada
						</Badge>
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
			</button>

			<Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
				<DialogContent className="rounded-none sm:max-w-sm p-0 gap-0 overflow-hidden border border-border bg-card">
					<DialogHeader className="px-4 pt-4 pb-2">
						<DialogTitle className="text-xs font-normal uppercase tracking-[0.12em] text-muted-foreground">
							Cambiar estado
						</DialogTitle>
					</DialogHeader>
					<div className="px-2 pb-2 space-y-0.5">
						{allStatuses.map((s) => (
							<button
								key={s}
								type="button"
								onClick={() => handleStatusChange(s)}
								className={cn(
									"w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
									obra.status === s
										? "bg-muted text-foreground"
										: "text-muted-foreground hover:bg-muted/50",
								)}
							>
								<span
									className={cn("h-2 w-2 rounded-full shrink-0", statusDots[s])}
								/>
								<span className="flex-1 text-left">
									{getStatusLabel(s, obra.type)}
								</span>
								{obra.status === s && <Check className="size-4 shrink-0" />}
							</button>
						))}
					</div>

					{showProgress && (
						<>
							<div className="border-t border-border" />
							<div className="px-4 py-3 space-y-3">
								<p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
									Progreso
								</p>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="icon"
										className="h-7 w-7 rounded-none"
										onClick={() =>
											handleProgressChange(progressCurrent - 1, progressTotal)
										}
									>
										<Minus className="size-3" />
									</Button>
									<Input
										type="number"
										min={0}
										value={progressCurrent}
										onChange={(e) =>
											handleProgressChange(
												Number(e.target.value),
												progressTotal,
											)
										}
										className="h-7 w-16 rounded-none text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
									/>
									<span className="text-sm text-muted-foreground">/</span>
									<Input
										type="number"
										min={0}
										value={progressTotal}
										onChange={(e) =>
											handleProgressChange(
												progressCurrent,
												Number(e.target.value),
											)
										}
										className="h-7 w-16 rounded-none text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
									/>
									<Button
										variant="outline"
										size="icon"
										className="h-7 w-7 rounded-none"
										onClick={() =>
											handleProgressChange(progressCurrent + 1, progressTotal)
										}
									>
										<Plus className="size-3" />
									</Button>
								</div>
								{progressTotal > 0 && (
									<Slider
										min={0}
										max={progressTotal}
										step={1}
										value={[Math.min(progressCurrent, progressTotal)]}
										onValueChange={([v]) =>
											handleProgressChange(v, progressTotal)
										}
									/>
								)}
							</div>
						</>
					)}

					{canMarkUpToDate && (
						<>
							<div className="border-t border-border" />
							<div className="px-4 py-3">
								<Button
									variant="ghost"
									className="w-full rounded-none justify-start text-sm text-muted-foreground hover:text-foreground"
									onClick={handleMarkUpToDate}
								>
									Marcar al día
								</Button>
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>

			<Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
				<DialogContent className="rounded-none sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{obra.title}</DialogTitle>
						<DialogDescription>
							¿Quieres dejar una reseña ahora?
						</DialogDescription>
					</DialogHeader>
					<Textarea
						placeholder="Escribe tu reseña..."
						value={reviewDraft}
						onChange={(e) => setReviewDraft(e.target.value)}
						className="rounded-none min-h-[120px]"
					/>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							variant="ghost"
							onClick={handleSkipReview}
							className="rounded-none"
						>
							Omitir
						</Button>
						<Button onClick={handleSaveReview} className="rounded-none">
							Guardar reseña
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
