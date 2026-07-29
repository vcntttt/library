"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function CompletionReviewDialog({
	open,
	onOpenChange,
	title,
	initialReview,
	onSave,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	initialReview?: string;
	onSave: (review: string) => Promise<unknown>;
}) {
	const [draft, setDraft] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setDraft(initialReview ?? "");
		setError(null);
	}, [initialReview, open]);

	const handleSave = async () => {
		setIsSaving(true);
		setError(null);
		try {
			const saved = await onSave(draft.trim());
			if (saved !== false) onOpenChange(false);
		} catch (saveError) {
			setError(
				saveError instanceof Error
					? saveError.message
					: "No se pudo guardar la reseña.",
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="rounded-none sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						Terminaste esta obra. ¿Quieres dejar una reseña ahora?
					</DialogDescription>
				</DialogHeader>
				<Textarea
					placeholder="Escribe tu reseña..."
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					className="min-h-[120px] rounded-none"
				/>
				{error && <p className="text-sm text-destructive">{error}</p>}
				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						type="button"
						variant="ghost"
						disabled={isSaving}
						onClick={() => onOpenChange(false)}
						className="rounded-none"
					>
						Omitir
					</Button>
					<Button
						type="button"
						disabled={isSaving}
						onClick={() => void handleSave()}
						className="rounded-none"
					>
						{isSaving ? "Guardando..." : "Guardar reseña"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
