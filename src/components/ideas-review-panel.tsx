import { api as convexApi } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { fetchIdea } from "@/lib/ideas-api";

type IdeaRating = "again" | "hard" | "good" | "easy";

const ratingOptions = [
	["again", "Otra vez"],
	["hard", "Difícil"],
	["good", "Bien"],
	["easy", "Fácil"],
] as const satisfies ReadonlyArray<readonly [IdeaRating, string]>;

interface IdeasReviewPanelProps {
	authToken: string | null;
	dueIdeas: ReadonlyArray<{ relativePath: string; title: string }> | undefined;
	onMessage: (message: string) => void;
}

// Repaso espaciado: revela una idea vencida y registra la calificación en Convex. Los errores van al mensaje del padre.
export function IdeasReviewPanel({
	authToken,
	dueIdeas,
	onMessage,
}: IdeasReviewPanelProps) {
	const reviewIdea = useMutation(convexApi.ideas.review);
	const [reviewingPath, setReviewingPath] = useState<string | null>(null);
	const [reviewContent, setReviewContent] = useState<string | null>(null);
	const [isRevealed, setIsRevealed] = useState(false);
	const [isBusy, setIsBusy] = useState(false);

	const currentReview = useMemo(
		() => dueIdeas?.find((idea) => idea.relativePath === reviewingPath) ?? null,
		[dueIdeas, reviewingPath],
	);

	const startReview = () => {
		const next = dueIdeas?.[0];
		if (!next) return;
		setReviewingPath(next.relativePath);
		setReviewContent(null);
		setIsRevealed(false);
	};

	const revealReview = async () => {
		if (!authToken || !currentReview) return;
		setIsBusy(true);
		try {
			const nextFile = await fetchIdea(authToken, currentReview.relativePath);
			setReviewContent(nextFile.content);
			setIsRevealed(true);
		} catch (error) {
			onMessage(
				error instanceof Error
					? error.message
					: "No se pudo cargar la nota para repaso.",
			);
		} finally {
			setIsBusy(false);
		}
	};

	const finishReview = async (rating: IdeaRating) => {
		if (!currentReview) return;
		setIsBusy(true);
		try {
			await reviewIdea({ relativePath: currentReview.relativePath, rating });
			setReviewingPath(null);
			setReviewContent(null);
			setIsRevealed(false);
		} catch (error) {
			onMessage(
				error instanceof Error
					? error.message
					: "No se pudo guardar el repaso.",
			);
		} finally {
			setIsBusy(false);
		}
	};

	return (
		<section className="border border-border bg-card p-5">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
						Repaso
					</p>
					<h2 className="font-serif text-2xl font-semibold">
						Ideas que toca volver a ver
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{dueIdeas === undefined
							? "Cargando agenda…"
							: `${dueIdeas.length} ${dueIdeas.length === 1 ? "idea disponible" : "ideas disponibles"}`}
					</p>
				</div>
				{!currentReview && (
					<Button
						onClick={startReview}
						disabled={!dueIdeas?.length || isBusy}
						className="rounded-none"
					>
						Empezar repaso
					</Button>
				)}
			</div>
			{currentReview && (
				<div className="mt-5 border-t border-border pt-5">
					<p className="font-serif text-xl font-semibold">
						{currentReview.title}
					</p>
					{isRevealed ? (
						<>
							<article className="prose prose-stone dark:prose-invert mt-4 max-w-none">
								<ReactMarkdown remarkPlugins={[remarkGfm]}>
									{reviewContent ?? ""}
								</ReactMarkdown>
							</article>
							<div className="mt-5 flex flex-wrap gap-2">
								{ratingOptions.map(([rating, label]) => (
									<Button
										key={rating}
										variant={rating === "good" ? "default" : "outline"}
										className="rounded-none"
										disabled={isBusy}
										onClick={() => void finishReview(rating)}
									>
										{label}
									</Button>
								))}
							</div>
						</>
					) : (
						<Button
							onClick={() => void revealReview()}
							disabled={isBusy}
							className="mt-4 rounded-none"
						>
							Mostrar nota
						</Button>
					)}
				</div>
			)}
		</section>
	);
}
