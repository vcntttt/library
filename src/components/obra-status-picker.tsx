"use client";

import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Check, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { CompletionReviewDialog } from "@/components/completion-review-dialog";
import { SeasonProgressEditor } from "@/components/season-progress-editor";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { isMetadataFinished } from "@/lib/metadata/format";
import { formatProgressValue, getProgressUnitLabel } from "@/lib/progress";
import { getStatusLabel } from "@/lib/status";
import type { Obra, ObraStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { statusDots } from "./status-badge";

const allStatuses: ObraStatus[] = [
	"backlog",
	"in-progress",
	"paused",
	"hiatus",
	"finished",
	"dropped",
];

interface ObraStatusPickerProps {
	obra: Obra;
	children: React.ReactNode;
}

export function ObraStatusPicker({ obra, children }: ObraStatusPickerProps) {
	const updateObra = useMutation(convexApi.obras.update);
	const [isPickerOpen, setIsPickerOpen] = useState(false);
	const [isReviewOpen, setIsReviewOpen] = useState(false);
	const [isSeasonEditorOpen, setIsSeasonEditorOpen] = useState(false);

	const hasProgress = obra.type !== "movie";
	const progressTotal = obra.progress?.total ?? 0;
	const progressCurrent = obra.progress?.current ?? 0;
	const progressUnitLabel = getProgressUnitLabel(obra);
	const showProgress =
		hasProgress &&
		obra.status !== "backlog" &&
		obra.status !== "finished" &&
		progressTotal > 0;

	const releasedCount =
		obra.type === "manga" || obra.type === "manhwa"
			? obra.metadata?.latestChapter
			: obra.metadata?.episodesAired;
	const canMarkUpToDate = releasedCount && releasedCount > 0;

	const closePicker = () => {
		setTimeout(() => setIsPickerOpen(false), 10);
	};

	const handleStatusChange = async (nextStatus: ObraStatus) => {
		await updateObra({
			id: obra.id as Id<"obras">,
			patch: { status: nextStatus },
		});
		closePicker();

		if (nextStatus === "finished" && !obra.review) {
			setTimeout(() => {
				setIsReviewOpen(true);
			}, 15);
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
		closePicker();
	};

	const handleSeasonProgressChange = async (next: {
		seasons: NonNullable<Obra["progressSeasons"]>;
		current: number;
		total: number;
	}) => {
		const patch: Record<string, unknown> = {
			progress: { current: next.current, total: next.total },
			progressSeasons: next.seasons,
		};
		if (obra.status !== "in-progress" && next.current > 0) {
			patch.status = "in-progress";
		}
		await updateObra({
			id: obra.id as Id<"obras">,
			patch,
		});
	};

	const handleFinishSeason = async (next: {
		seasons: NonNullable<Obra["progressSeasons"]>;
		current: number;
		total: number;
		isLastSeason: boolean;
	}) => {
		const shouldFinishObra =
			next.isLastSeason && isMetadataFinished(obra.metadata?.status);
		const completedTotal = Math.max(next.total, progressTotal);
		await updateObra({
			id: obra.id as Id<"obras">,
			patch: {
				progress: {
					current: shouldFinishObra ? completedTotal : next.current,
					total: completedTotal,
				},
				progressSeasons: next.seasons,
				...(shouldFinishObra
					? { status: "finished" as const }
					: obra.status !== "in-progress" && next.current > 0
						? { status: "in-progress" as const }
						: {}),
			},
		});
		if (!shouldFinishObra) return;
		setIsSeasonEditorOpen(false);
		closePicker();
		if (!obra.review) setIsReviewOpen(true);
	};

	const handlePickerOpenChange = (open: boolean) => {
		if (!open) {
			closePicker();
		} else {
			setIsPickerOpen(true);
		}
	};

	const handleSaveReview = async (review: string) => {
		await updateObra({
			id: obra.id as Id<"obras">,
			patch: { review: review || undefined },
		});
	};

	return (
		<>
			{/* biome-ignore lint/a11y/useSemanticElements: cannot nest button inside anchor links used by ObraCard */}
			<span
				role="button"
				tabIndex={0}
				className="inline-flex cursor-pointer"
				onClick={(e) => {
					e.stopPropagation();
					e.preventDefault();
					setIsPickerOpen(true);
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.stopPropagation();
						e.preventDefault();
						setIsPickerOpen(true);
					}
				}}
			>
				{children}
			</span>

			<Dialog open={isPickerOpen} onOpenChange={handlePickerOpenChange}>
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
								{progressUnitLabel && (
									<p className="text-xs text-muted-foreground">
										{formatProgressValue(progressCurrent, obra)} /{" "}
										{formatProgressValue(progressTotal, obra)}{" "}
										{progressUnitLabel}
									</p>
								)}
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
										onValueChange={(nextValue) => {
											const value = Array.isArray(nextValue)
												? nextValue[0]
												: nextValue;
											if (value !== undefined) {
												handleProgressChange(value, progressTotal);
											}
										}}
									/>
								)}
								{(obra.type === "series" || obra.type === "anime") &&
									(obra.progressSeasons?.length ?? 0) > 0 && (
										<Button
											type="button"
											variant="outline"
											className="w-full rounded-none"
											onClick={() => setIsSeasonEditorOpen(true)}
										>
											Progreso por temporadas
										</Button>
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

			<SeasonProgressEditor
				open={isSeasonEditorOpen}
				onOpenChange={setIsSeasonEditorOpen}
				seasons={obra.progressSeasons ?? []}
				current={progressCurrent}
				total={progressTotal}
				onChange={(next) => void handleSeasonProgressChange(next)}
				onFinishSeason={(next) => void handleFinishSeason(next)}
			/>
			<CompletionReviewDialog
				open={isReviewOpen}
				onOpenChange={setIsReviewOpen}
				title={obra.title}
				initialReview={obra.review}
				onSave={handleSaveReview}
			/>
		</>
	);
}
