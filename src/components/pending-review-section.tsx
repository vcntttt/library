import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { CompletionReviewDialog } from "@/components/completion-review-dialog";
import { Button } from "@/components/ui/button";

export function PendingReviewSection() {
	const reviews = useQuery(convexApi.obras.listPendingReviews, { limit: 12 });
	const saveReview = useMutation(convexApi.obras.saveReview);
	const snoozeReview = useMutation(convexApi.obras.snoozeReview);
	const skipReview = useMutation(convexApi.obras.skipReview);
	const [selectedId, setSelectedId] = useState<Id<"obras"> | null>(null);
	const selected = reviews?.find((obra) => obra.id === selectedId);

	if (reviews === undefined || reviews.length === 0) return null;

	return (
		<section className="space-y-4 border border-primary/40 bg-primary/5 p-5">
			<div className="flex items-end justify-between gap-4">
				<div>
					<p className="text-xs uppercase tracking-[0.16em] text-primary">
						Pendiente editorial
					</p>
					<h2 className="font-serif text-2xl font-semibold">
						{reviews.length === 1
							? "Una reseña espera tu atención"
							: `${reviews.length} reseñas esperan tu atención`}
					</h2>
				</div>
				<Link to="/lectura" className="text-sm underline underline-offset-4">
					Ir a Lectura
				</Link>
			</div>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{reviews.map((obra) => (
					<div
						key={obra.id}
						className="flex items-center justify-between gap-3 border border-border bg-card p-4"
					>
						<div className="min-w-0">
							<p className="truncate font-medium">{obra.title}</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Obra terminada
							</p>
						</div>
						<Button
							size="sm"
							className="shrink-0 rounded-none"
							onClick={() => setSelectedId(obra.id)}
						>
							Escribir
						</Button>
					</div>
				))}
			</div>
			{selected && (
				<CompletionReviewDialog
					open
					onOpenChange={(open) => {
						if (!open) setSelectedId(null);
					}}
					title={selected.title}
					initialReview={selected.review}
					onSave={(review) => saveReview({ id: selected.id, review })}
					onLater={() => snoozeReview({ id: selected.id })}
					onSkip={() => skipReview({ id: selected.id })}
				/>
			)}
		</section>
	);
}
