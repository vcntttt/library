"use client";
import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { obraFromDoc } from "@/lib/obras";
import type { Obra, ObraId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CompletionReviewDialog } from "./completion-review-dialog";
import { type ObraAutoSave, useObraAutoSave } from "./obra-edit-autosave";
import {
	ObraIdentitySection,
	ObraPersonalSection,
	ObraProgressSection,
	ObraQuotesSection,
	ObraReadingSection,
} from "./obra-edit-sections";
import { useObraEditSession } from "./obra-edit-session";

interface ObraEditSheetProps {
	obraId?: ObraId | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}
export function ObraEditSheet(props: ObraEditSheetProps) {
	return <ObraEditLoader key={props.obraId ?? "empty"} {...props} />;
}
function ObraEditLoader({ obraId, open, onOpenChange }: ObraEditSheetProps) {
	const convexId = obraId ? (obraId as Id<"obras">) : null;
	const doc = useQuery(
		convexApi.obras.get,
		convexId ? { id: convexId } : "skip",
	);
	const autoSave = useObraAutoSave(convexId);
	return (
		<Sheet
			open={open}
			onOpenChange={(next) => {
				if (!next) autoSave.flushPendingSaves();
				onOpenChange(next);
			}}
		>
			<SheetContent
				side="right"
				className="h-dvh max-h-dvh w-full max-w-none overflow-y-auto border-l-border bg-card p-0 sm:max-w-xl lg:max-w-2xl"
			>
				{doc ? (
					<ObraEditorSession
						key={doc.id}
						obra={obraFromDoc(doc)}
						autoSave={autoSave}
					/>
				) : (
					<>
						<SheetHeader>
							<SheetTitle>Editar obra</SheetTitle>
							<SheetDescription>
								Los cambios se guardan automáticamente.
							</SheetDescription>
						</SheetHeader>
						<div className="px-5 py-5">
							{doc === null ? (
								<p className="text-sm text-muted-foreground">
									Obra no encontrada.
								</p>
							) : (
								<div className="flex flex-col gap-4">
									<Skeleton className="h-24 rounded-none" />
									<Skeleton className="h-40 rounded-none" />
									<Skeleton className="h-40 rounded-none" />
								</div>
							)}
						</div>
					</>
				)}
			</SheetContent>
		</Sheet>
	);
}
function ObraEditorSession({
	obra,
	autoSave,
}: {
	obra: Obra;
	autoSave: ObraAutoSave;
}) {
	const session = useObraEditSession(obra, autoSave);
	const { isCompletionReviewOpen, setIsCompletionReviewOpen } = session;
	const convexId = obra.id as Id<"obras">;
	const saveReview = useMutation(convexApi.obras.saveReview);
	const snoozeReview = useMutation(convexApi.obras.snoozeReview);
	const skipReview = useMutation(convexApi.obras.skipReview);
	const autoSaveLabel =
		autoSave.status === "saving"
			? "Guardando..."
			: autoSave.status === "saved"
				? "Guardado"
				: autoSave.status === "error"
					? "Error al guardar"
					: "Sin cambios";
	return (
		<>
			<SheetHeader className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4">
				<div className="flex items-start justify-between gap-4 pr-9">
					<div className="min-w-0 flex flex-col gap-1">
						<SheetTitle className="font-serif text-xl">Editar obra</SheetTitle>
						<SheetDescription>
							Los cambios se guardan automáticamente.
						</SheetDescription>
					</div>
					<div className="flex shrink-0 flex-col items-end gap-1 text-right">
						<span
							className={cn(
								"text-xs font-medium",
								autoSave.status === "error"
									? "text-destructive"
									: "text-muted-foreground",
							)}
						>
							{autoSaveLabel}
						</span>
						{autoSave.status === "error" && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={autoSave.retry}
								className="h-7 rounded-none px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
							>
								Reintentar
							</Button>
						)}
					</div>
				</div>
				{autoSave.error && (
					<p className="text-xs text-destructive">{autoSave.error}</p>
				)}
			</SheetHeader>
			<div className="px-5 py-5">
				<div className="flex flex-col gap-8">
					<ObraIdentitySection {...session} />
					{obra.type !== "movie" && obra.status !== "backlog" && (
						<ObraProgressSection {...session} />
					)}
					<ObraReadingSection {...session} />
					<ObraPersonalSection {...session} />
					<ObraQuotesSection {...session} />
				</div>
			</div>
			<CompletionReviewDialog
				open={isCompletionReviewOpen}
				onOpenChange={setIsCompletionReviewOpen}
				title={obra.title}
				initialReview={obra.review}
				onSave={async (review) =>
					await saveReview({ id: convexId as Id<"obras">, review })
				}
				onLater={async () => {
					if (convexId) await snoozeReview({ id: convexId });
				}}
				onSkip={async () => {
					if (convexId) await skipReview({ id: convexId });
				}}
			/>
		</>
	);
}
