"use client";

import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Check } from "lucide-react";
import { useState } from "react";
import { CompletionReviewDialog } from "@/components/completion-review-dialog";
import { ObraStatusProgress } from "@/components/obra-status-progress";
import { SeasonProgressEditor } from "@/components/season-progress-editor";
import { statusDots } from "@/components/status-tokens";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { isMetadataFinished } from "@/lib/metadata/format";
import { isPositiveCount } from "@/lib/progress";
import { getStatusLabel } from "@/lib/status";
import type { Obra, ObraSeason, ObraStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const allStatuses: ObraStatus[] = [
	"backlog",
	"in-progress",
	"paused",
	"hiatus",
	"finished",
	"dropped",
];

// Avanzar progreso con capítulos o episodios vistos pasa a "en progreso" salvo que la obra ya lo esté.
function startedStatusPatch(status: ObraStatus, current: number) {
	return status !== "in-progress" && current > 0
		? { status: "in-progress" as const }
		: {};
}

// La reseña se ofrece al terminar una obra salvo que ya tenga una o el usuario la haya omitido.
function shouldOfferReview(obra: Obra) {
	return !obra.review && obra.reviewStatus !== "skipped";
}

interface ObraStatusPickerProps {
	obra: Obra;
	children: React.ReactNode;
}

export function ObraStatusPicker({ obra, children }: ObraStatusPickerProps) {
	const updateObra = useMutation(convexApi.obras.update);
	const saveReview = useMutation(convexApi.obras.saveReview);
	const snoozeReview = useMutation(convexApi.obras.snoozeReview);
	const skipReview = useMutation(convexApi.obras.skipReview);
	const [isPickerOpen, setIsPickerOpen] = useState(false);
	const [isReviewOpen, setIsReviewOpen] = useState(false);
	const [isSeasonEditorOpen, setIsSeasonEditorOpen] = useState(false);
	const [progressDraft, setProgressDraft] = useState<{
		current: number;
		total: number;
	} | null>(null);
	const [progressError, setProgressError] = useState<string | null>(null);

	const obraId = obra.id as Id<"obras">;
	const hasProgress = obra.type !== "movie";
	const progressTotal = obra.progress?.total ?? 0;
	const progressCurrent = obra.progress?.current ?? 0;
	const displayedProgressCurrent = progressDraft?.current ?? progressCurrent;
	const displayedProgressTotal = progressDraft?.total ?? progressTotal;
	const showProgress =
		hasProgress &&
		!obra.readingDocumentId &&
		obra.status !== "backlog" &&
		obra.status !== "finished" &&
		progressTotal > 0;

	const releasedCount =
		obra.type === "manga" || obra.type === "manhwa"
			? obra.metadata?.latestChapter
			: obra.metadata?.episodesAired;
	const canMarkUpToDate = isPositiveCount(releasedCount);

	const closePicker = () => {
		setProgressDraft(null);
		setTimeout(() => setIsPickerOpen(false), 10);
	};

	const handleStatusChange = async (nextStatus: ObraStatus) => {
		await updateObra({ id: obraId, patch: { status: nextStatus } });
		closePicker();

		if (nextStatus === "finished" && shouldOfferReview(obra)) {
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
		setProgressDraft({ current: safeCurrent, total: safeTotal });

		const patch: Record<string, unknown> = {
			...startedStatusPatch(obra.status, safeCurrent),
		};
		if (safeTotal > 0) {
			patch.progress = { current: safeCurrent, total: safeTotal };
		} else if (obra.progress) {
			patch.progress = null;
		}

		setProgressError(null);
		try {
			await updateObra({ id: obraId, patch });
		} catch (error) {
			// Se descarta el borrador para mostrar el valor guardado, no uno que no llegó al servidor.
			setProgressDraft(null);
			setProgressError(
				error instanceof Error
					? error.message
					: "No se pudo guardar el progreso.",
			);
		}
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
		await updateObra({ id: obraId, patch });
		closePicker();
	};

	const handleSeasonProgressChange = async (next: {
		seasons: ObraSeason[];
		current: number;
		total: number;
	}) => {
		await updateObra({
			id: obraId,
			patch: {
				progress: { current: next.current, total: next.total },
				progressSeasons: next.seasons,
				...startedStatusPatch(obra.status, next.current),
			},
		});
	};

	const handleFinishSeason = async (next: {
		seasons: ObraSeason[];
		current: number;
		total: number;
		isLastSeason: boolean;
	}) => {
		const shouldFinishObra =
			next.isLastSeason && isMetadataFinished(obra.metadata?.status);
		const completedTotal = Math.max(next.total, progressTotal);
		await updateObra({
			id: obraId,
			patch: {
				progress: {
					current: shouldFinishObra ? completedTotal : next.current,
					total: completedTotal,
				},
				progressSeasons: next.seasons,
				...(shouldFinishObra
					? { status: "finished" as const }
					: startedStatusPatch(obra.status, next.current)),
			},
		});
		if (!shouldFinishObra) return;
		setIsSeasonEditorOpen(false);
		closePicker();
		if (shouldOfferReview(obra)) setIsReviewOpen(true);
	};

	const handlePickerOpenChange = (open: boolean) => {
		if (!open) {
			closePicker();
		} else {
			setIsPickerOpen(true);
		}
	};

	const handleSaveReview = async (review: string) => {
		await saveReview({ id: obraId, review });
	};

	const handleLaterReview = async () => {
		await snoozeReview({ id: obraId });
	};

	const handleSkipReview = async () => {
		await skipReview({ id: obraId });
	};

	return (
		<>
			<button
				type="button"
				className="inline-flex cursor-pointer"
				onClick={(e) => {
					e.stopPropagation();
					e.preventDefault();
					setIsPickerOpen(true);
				}}
			>
				{children}
			</button>

			<Dialog open={isPickerOpen} onOpenChange={handlePickerOpenChange}>
				<DialogContent
					className="rounded-none sm:max-w-sm p-0 gap-0 overflow-hidden border border-border bg-card"
					onClick={(event) => event.stopPropagation()}
					onPointerDown={(event) => event.stopPropagation()}
				>
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
							<ObraStatusProgress
								obra={obra}
								current={displayedProgressCurrent}
								total={displayedProgressTotal}
								error={progressError}
								onProgressChange={handleProgressChange}
								onOpenSeasonEditor={() => setIsSeasonEditorOpen(true)}
							/>
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
				onLater={handleLaterReview}
				onSkip={handleSkipReview}
			/>
		</>
	);
}
