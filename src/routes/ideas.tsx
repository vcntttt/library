import { api as convexApi } from "@convex/_generated/api";
import { useAuthToken } from "@convex-dev/auth/react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ReadingIntegrationGate } from "@/components/reading/reading-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/ideas")({
	ssr: false,
	component: IdeasPage,
});

interface IdeaFilePayload {
	relativePath: string;
	title: string;
	content: string;
	contentHash: string;
	fileModifiedAt: number;
}

interface IdeaConflictPayload {
	error?: string;
	current?: IdeaFilePayload | null;
}

function IdeasPage() {
	return (
		<ReadingIntegrationGate
			title="Ideas"
			loginDescription="Inicia sesión para trabajar con tus notas de Obsidian."
			disabledDescription="La integración de ideas no está habilitada para este usuario."
		>
			<IdeasAuthed />
		</ReadingIntegrationGate>
	);
}

function IdeasAuthed() {
	const ideas = useQuery(convexApi.ideas.list, {});
	const dueIdeas = useQuery(convexApi.ideas.listDue, { limit: 20 });
	const reviewIdea = useMutation(convexApi.ideas.review);
	const authToken = useAuthToken();
	const [selectedPath, setSelectedPath] = useState<string | null>(null);
	const [file, setFile] = useState<IdeaFilePayload | null>(null);
	const [draft, setDraft] = useState("");
	const [mode, setMode] = useState<"edit" | "preview">("edit");
	const [newTitle, setNewTitle] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [isBusy, setIsBusy] = useState(false);
	const [conflictFile, setConflictFile] = useState<IdeaFilePayload | null>(
		null,
	);
	const [reviewingPath, setReviewingPath] = useState<string | null>(null);
	const [reviewContent, setReviewContent] = useState<string | null>(null);
	const [isReviewRevealed, setIsReviewRevealed] = useState(false);
	const [isReviewBusy, setIsReviewBusy] = useState(false);

	const selectedIdea = useMemo(
		() => ideas?.find((idea) => idea.relativePath === selectedPath) ?? null,
		[ideas, selectedPath],
	);
	const currentReview = useMemo(
		() => dueIdeas?.find((idea) => idea.relativePath === reviewingPath) ?? null,
		[dueIdeas, reviewingPath],
	);

	useEffect(() => {
		if (!selectedIdea || !authToken) return;
		let cancelled = false;
		setMessage(null);
		setConflictFile(null);
		void fetchIdea(authToken, selectedIdea.relativePath)
			.then((nextFile) => {
				if (cancelled) return;
				setFile(nextFile);
				setDraft(nextFile.content);
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setMessage(
						error instanceof Error ? error.message : "No se pudo leer la idea.",
					);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [authToken, selectedIdea]);

	const handleSync = async () => {
		if (!authToken) return;
		setIsBusy(true);
		setMessage(null);
		try {
			const response = await fetch("/api/ideas/sync", {
				method: "POST",
				headers: { authorization: `Bearer ${authToken}` },
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok)
				throw new Error(
					payload?.error ?? "No se pudieron sincronizar las ideas.",
				);
			setMessage(`Se sincronizaron ${payload.syncedIdeas ?? 0} ideas.`);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "No se pudieron sincronizar las ideas.",
			);
		} finally {
			setIsBusy(false);
		}
	};

	const handleCreate = async () => {
		if (!authToken || !newTitle.trim()) return;
		setIsBusy(true);
		setMessage(null);
		try {
			const response = await fetch("/api/ideas", {
				method: "POST",
				headers: {
					authorization: `Bearer ${authToken}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({ title: newTitle.trim(), content: "" }),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok)
				throw new Error(payload?.error ?? "No se pudo crear la idea.");
			setNewTitle("");
			setSelectedPath(payload.relativePath);
			setFile(payload);
			setDraft(payload.content);
			setMessage("Idea creada.");
		} catch (error) {
			setMessage(
				error instanceof Error ? error.message : "No se pudo crear la idea.",
			);
		} finally {
			setIsBusy(false);
		}
	};

	const startReview = () => {
		const next = dueIdeas?.[0];
		if (!next) return;
		setReviewingPath(next.relativePath);
		setReviewContent(null);
		setIsReviewRevealed(false);
	};

	const revealReview = async () => {
		if (!authToken || !currentReview) return;
		setIsReviewBusy(true);
		try {
			const nextFile = await fetchIdea(authToken, currentReview.relativePath);
			setReviewContent(nextFile.content);
			setIsReviewRevealed(true);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "No se pudo cargar la nota para repaso.",
			);
		} finally {
			setIsReviewBusy(false);
		}
	};

	const finishReview = async (rating: "again" | "hard" | "good" | "easy") => {
		if (!currentReview) return;
		setIsReviewBusy(true);
		try {
			await reviewIdea({ relativePath: currentReview.relativePath, rating });
			setReviewingPath(null);
			setReviewContent(null);
			setIsReviewRevealed(false);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "No se pudo guardar el repaso.",
			);
		} finally {
			setIsReviewBusy(false);
		}
	};

	const handleSave = async () => {
		if (!authToken || !file) return;
		setIsBusy(true);
		setMessage(null);
		try {
			const response = await fetch("/api/ideas/content", {
				method: "PUT",
				headers: {
					authorization: `Bearer ${authToken}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					relativePath: file.relativePath,
					content: draft,
					expectedHash: file.contentHash,
				}),
			});
			const payload = (await response.json().catch(() => ({}))) as
				| IdeaFilePayload
				| IdeaConflictPayload;
			if (response.status === 409) {
				if ("current" in payload && payload.current) {
					setConflictFile(payload.current);
				}
				setMessage(
					"La nota cambió en Obsidian. Decide qué versión cargar antes de guardar.",
				);
				return;
			}
			if (!response.ok) {
				const errorPayload = payload as IdeaConflictPayload;
				throw new Error(errorPayload.error ?? "No se pudo guardar la idea.");
			}
			const savedFile = payload as IdeaFilePayload;
			setFile(savedFile);
			setDraft(savedFile.content);
			setMessage("Guardado en el vault.");
		} catch (error) {
			setMessage(
				error instanceof Error ? error.message : "No se pudo guardar la idea.",
			);
		} finally {
			setIsBusy(false);
		}
	};

	const loadConflictVersion = () => {
		if (!conflictFile) return;
		setFile(conflictFile);
		setDraft(conflictFile.content);
		setConflictFile(null);
		setMessage("Se cargó la versión actual del vault.");
	};

	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
				<header className="flex flex-col gap-5 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
					<div className="space-y-2">
						<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
							Obsidian
						</p>
						<h1 className="font-serif text-4xl font-semibold">Ideas</h1>
						<p className="max-w-2xl text-sm text-muted-foreground">
							Un lienzo libre para conectar lecturas, citas, anotaciones y
							cualquier otra idea.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Input
							value={newTitle}
							onChange={(event) => setNewTitle(event.target.value)}
							placeholder="Título de idea"
							className="rounded-none sm:w-52"
							onKeyDown={(event) => {
								if (event.key === "Enter") void handleCreate();
							}}
						/>
						<Button
							onClick={handleCreate}
							disabled={isBusy || !newTitle.trim()}
							className="rounded-none"
						>
							Nueva idea
						</Button>
						<Button
							onClick={handleSync}
							disabled={isBusy}
							variant="outline"
							className="rounded-none"
						>
							Sincronizar vault
						</Button>
					</div>
				</header>

				{message && (
					<div className="border border-border bg-card px-4 py-3 text-sm">
						<p>{message}</p>
						{conflictFile && (
							<Button
								variant="outline"
								size="sm"
								className="mt-3 rounded-none"
								onClick={loadConflictVersion}
							>
								Cargar versión del vault
							</Button>
						)}
					</div>
				)}

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
								disabled={!dueIdeas?.length || isReviewBusy}
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
							{isReviewRevealed ? (
								<>
									<article className="prose prose-stone dark:prose-invert mt-4 max-w-none">
										<ReactMarkdown remarkPlugins={[remarkGfm]}>
											{reviewContent ?? ""}
										</ReactMarkdown>
									</article>
									<div className="mt-5 flex flex-wrap gap-2">
										{(
											[
												["again", "Otra vez"],
												["hard", "Difícil"],
												["good", "Bien"],
												["easy", "Fácil"],
											] as const
										).map(([rating, label]) => (
											<Button
												key={rating}
												variant={rating === "good" ? "default" : "outline"}
												className="rounded-none"
												disabled={isReviewBusy}
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
									disabled={isReviewBusy}
									className="mt-4 rounded-none"
								>
									Mostrar nota
								</Button>
							)}
						</div>
					)}
				</section>

				<div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
					<aside className="border border-border bg-card p-3">
						<p className="px-3 pb-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
							Notas ({ideas?.length ?? "…"})
						</p>
						<div className="space-y-1">
							{ideas?.map((idea) => (
								<button
									key={idea.relativePath}
									type="button"
									onClick={() => setSelectedPath(idea.relativePath)}
									className={`w-full border-l-2 px-3 py-3 text-left text-sm transition-colors ${selectedPath === idea.relativePath ? "border-primary bg-muted" : "border-transparent hover:bg-muted/60"}`}
								>
									{idea.title}
								</button>
							))}
							{ideas?.length === 0 && (
								<p className="px-3 py-6 text-sm text-muted-foreground">
									Todavía no hay ideas.
								</p>
							)}
						</div>
					</aside>

					<main className="min-h-[32rem] border border-border bg-card">
						{!selectedPath || !file ? (
							<div className="flex min-h-[32rem] items-center justify-center p-8 text-center text-sm text-muted-foreground">
								Selecciona una idea o crea una nueva.
							</div>
						) : (
							<div className="space-y-4 p-5">
								<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
									<p className="truncate text-xs text-muted-foreground">
										{file.relativePath}
									</p>
									<div className="flex gap-2">
										<Button
											variant={mode === "edit" ? "default" : "outline"}
											size="sm"
											className="rounded-none"
											onClick={() => setMode("edit")}
										>
											Editar
										</Button>
										<Button
											variant={mode === "preview" ? "default" : "outline"}
											size="sm"
											className="rounded-none"
											onClick={() => setMode("preview")}
										>
											Vista previa
										</Button>
										<Button
											size="sm"
											className="rounded-none"
											onClick={handleSave}
											disabled={isBusy}
										>
											Guardar
										</Button>
									</div>
								</div>
								{mode === "edit" ? (
									<Textarea
										value={draft}
										onChange={(event) => setDraft(event.target.value)}
										className="min-h-[28rem] resize-y rounded-none font-mono text-sm leading-relaxed"
									/>
								) : (
									<article className="prose prose-stone dark:prose-invert max-w-none min-h-[28rem]">
										<ReactMarkdown remarkPlugins={[remarkGfm]}>
											{draft}
										</ReactMarkdown>
									</article>
								)}
							</div>
						)}
					</main>
				</div>
			</div>
		</div>
	);
}

async function fetchIdea(token: string, relativePath: string) {
	const response = await fetch(
		`/api/ideas/content?path=${encodeURIComponent(relativePath)}`,
		{
			headers: { authorization: `Bearer ${token}` },
		},
	);
	const payload = (await response
		.json()
		.catch(() => ({}))) as IdeaFilePayload & { error?: string };
	if (!response.ok)
		throw new Error(payload.error ?? "No se pudo leer la idea.");
	return payload;
}
