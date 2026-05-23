"use client";

import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { ExternalLink, Minus, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { obraFromDoc } from "@/lib/obras";
import { getInitialProgressTotal } from "@/lib/progress";
import { getStatusLabel } from "@/lib/status";
import type { Obra, ObraId, ObraStatus, ObraType } from "@/lib/types";
import { cn, formatDateInput, parseDateInput } from "@/lib/utils";

interface EditableQuote {
	clientId: string;
	id?: string;
	content: string;
	characterName: string;
}

interface EditValues {
	customTitle: string;
	customCreator: string;
	customYear: string;
	customCoverUrl: string;
	readingUrl: string;
	recommendedBy: string;
	startedAt: string;
	finishedAt: string;
	review: string;
	progressCurrent: number;
	progressTotal: number;
}

type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

const progressUnitLabels: Record<ObraType, string> = {
	book: "páginas",
	movie: "",
	series: "episodios",
	anime: "episodios",
	manga: "capítulos",
	manhwa: "capítulos",
};

const normalizeReadingUrl = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
};

function getEditValues(obra: Obra): EditValues {
	return {
		customTitle: obra.title,
		customCreator: obra.creator ?? "",
		customYear: obra.year ? String(obra.year) : "",
		customCoverUrl: obra.coverUrl ?? "",
		readingUrl: obra.readingUrl ?? "",
		recommendedBy: obra.recommendedBy ?? "",
		startedAt: formatDateInput(
			obra.type === "movie"
				? (obra.finishedAt ?? obra.startedAt)
				: obra.startedAt,
		),
		finishedAt: formatDateInput(
			obra.type === "movie"
				? (obra.finishedAt ?? obra.startedAt)
				: obra.finishedAt,
		),
		review: obra.review ?? "",
		progressCurrent: obra.progress?.current ?? 0,
		progressTotal: getInitialProgressTotal(obra),
	};
}

function buildCustomPatch(values: EditValues) {
	const year = Number(values.customYear);
	return {
		customTitle: values.customTitle.trim() || undefined,
		customCreator: values.customCreator.trim() || undefined,
		customYear:
			values.customYear.trim() && Number.isFinite(year) ? year : undefined,
		customCoverUrl: values.customCoverUrl.trim() || undefined,
	};
}

function buildPersonalPatch(values: EditValues, obra: Obra) {
	const movieWatchedAt =
		obra.type === "movie"
			? (parseDateInput(values.finishedAt) ?? parseDateInput(values.startedAt))
			: undefined;

	return {
		readingUrl: values.readingUrl.trim() || undefined,
		recommendedBy: values.recommendedBy.trim(),
		startedAt:
			obra.type === "movie" ? movieWatchedAt : parseDateInput(values.startedAt),
		finishedAt:
			obra.type === "movie"
				? movieWatchedAt
				: parseDateInput(values.finishedAt),
		review: values.review.trim() || undefined,
	};
}

function buildProgressPatch(
	values: Pick<EditValues, "progressCurrent" | "progressTotal">,
	obra: Obra,
	status?: ObraStatus,
) {
	if (obra.type === "movie") return null;
	const total = Math.max(0, Math.floor(values.progressTotal || 0));
	const current = Math.min(
		Math.max(0, Math.floor(values.progressCurrent || 0)),
		total,
	);
	if (total <= 0) {
		return { progress: undefined, ...(status ? { status } : {}) };
	}
	return { progress: { current, total }, ...(status ? { status } : {}) };
}

function buildQuotesPatch(quotes: EditableQuote[]) {
	return {
		quotes: quotes
			.map((quote) => ({
				id: quote.id,
				content: quote.content.trim(),
				characterName: quote.characterName.trim() || undefined,
			}))
			.filter((quote) => quote.content),
	};
}

export function ObraEditSheet({
	obraId,
	open,
	onOpenChange,
}: {
	obraId?: ObraId | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const convexId = obraId ? (obraId as Id<"obras">) : null;
	const doc = useQuery(
		convexApi.obras.get,
		convexId ? { id: convexId } : "skip",
	);
	const updateObra = useMutation(convexApi.obras.update);
	const obra = doc ? obraFromDoc(doc) : null;
	const [values, setValues] = useState<EditValues | null>(null);
	const [quotes, setQuotes] = useState<EditableQuote[]>([]);
	const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");
	const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
	const [lastFailedPatch, setLastFailedPatch] = useState<Record<
		string,
		unknown
	> | null>(null);
	const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
	const pendingSavePatches = useRef(new Map<string, Record<string, unknown>>());

	const resetFromObra = useCallback((nextObra: Obra) => {
		setValues(getEditValues(nextObra));
		setQuotes(
			nextObra.quotes.map((quote) => ({
				clientId: quote.id,
				id: quote.id,
				content: quote.content,
				characterName: quote.characterName ?? "",
			})),
		);
	}, []);

	useEffect(() => {
		if (!obra || !open) return;
		resetFromObra(obra);
		setAutoSaveStatus("idle");
		setAutoSaveError(null);
	}, [obra, open, resetFromObra]);

	const commitPatch = useCallback(
		async (patch: Record<string, unknown>) => {
			if (!convexId) return false;
			setAutoSaveStatus("saving");
			setAutoSaveError(null);
			try {
				await updateObra({ id: convexId, patch });
				setLastFailedPatch(null);
				setAutoSaveStatus("saved");
				return true;
			} catch (error) {
				setLastFailedPatch(patch);
				setAutoSaveStatus("error");
				setAutoSaveError(
					error instanceof Error ? error.message : "No se pudo guardar.",
				);
				return false;
			}
		},
		[convexId, updateObra],
	);

	const savePatch = useCallback(
		(
			patch: Record<string, unknown> | null,
			options?: { debounceKey?: string; delayMs?: number },
		) => {
			if (!patch) return;
			const { debounceKey, delayMs = 700 } = options ?? {};
			if (!debounceKey) {
				void commitPatch(patch);
				return;
			}
			const existingTimer = saveTimers.current.get(debounceKey);
			if (existingTimer) clearTimeout(existingTimer);
			pendingSavePatches.current.set(debounceKey, patch);
			setAutoSaveStatus("saving");
			setAutoSaveError(null);
			const timer = setTimeout(() => {
				saveTimers.current.delete(debounceKey);
				const pendingPatch = pendingSavePatches.current.get(debounceKey);
				pendingSavePatches.current.delete(debounceKey);
				if (pendingPatch) void commitPatch(pendingPatch);
			}, delayMs);
			saveTimers.current.set(debounceKey, timer);
		},
		[commitPatch],
	);

	const flushPendingSaves = useCallback(() => {
		for (const [key, timer] of saveTimers.current) {
			clearTimeout(timer);
			const pendingPatch = pendingSavePatches.current.get(key);
			pendingSavePatches.current.delete(key);
			if (pendingPatch) void commitPatch(pendingPatch);
		}
		saveTimers.current.clear();
	}, [commitPatch]);

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) flushPendingSaves();
		onOpenChange(nextOpen);
	};

	const updateValues = (
		nextValues: EditValues,
		patch: Record<string, unknown> | null,
		debounceKey: string,
		delayMs?: number,
	) => {
		setValues(nextValues);
		savePatch(patch, { debounceKey, delayMs });
	};

	const handleStatusChange = (status: ObraStatus) => {
		savePatch({ status });
	};

	const handleOpenReadingLink = (urlValue: string) => {
		const nextUrl = normalizeReadingUrl(urlValue);
		if (!nextUrl) return;
		window.open(nextUrl, "_blank", "noopener,noreferrer");
	};

	const handleStepProgressChange = (nextCurrent: number, nextTotal: number) => {
		if (!obra || !values || !Number.isFinite(nextTotal) || nextTotal <= 0) {
			return;
		}
		const safeCurrent = Math.min(Math.max(nextCurrent, 0), nextTotal);
		const nextValues = { ...values, progressCurrent: safeCurrent };
		setValues(nextValues);
		savePatch(buildProgressPatch(nextValues, obra), {
			debounceKey: "progress",
			delayMs: 600,
		});
	};

	const handleProgressTotalChange = (nextTotal: number) => {
		if (!obra || !values) return;
		const progressCurrent = nextTotal === 0 ? 0 : values.progressCurrent;
		const nextValues = {
			...values,
			progressCurrent,
			progressTotal: nextTotal,
		};
		updateValues(
			nextValues,
			buildProgressPatch(nextValues, obra),
			"progress",
			600,
		);
	};

	const handleAddQuote = () => {
		setQuotes((current) => [
			...current,
			{
				clientId: `new-${crypto.randomUUID()}`,
				content: "",
				characterName: "",
			},
		]);
	};

	const handleRemoveQuote = (clientId: string) => {
		setQuotes((current) => {
			const nextQuotes = current.filter((quote) => quote.clientId !== clientId);
			savePatch(buildQuotesPatch(nextQuotes), { debounceKey: "quotes" });
			return nextQuotes;
		});
	};

	const handleQuoteChange = (
		clientId: string,
		field: "content" | "characterName",
		value: string,
	) => {
		setQuotes((current) => {
			const nextQuotes = current.map((quote) =>
				quote.clientId === clientId ? { ...quote, [field]: value } : quote,
			);
			savePatch(buildQuotesPatch(nextQuotes), { debounceKey: "quotes" });
			return nextQuotes;
		});
	};

	const autoSaveLabel = useMemo(() => {
		if (autoSaveStatus === "saving") return "Guardando...";
		if (autoSaveStatus === "saved") return "Guardado";
		if (autoSaveStatus === "error") return "Error al guardar";
		return "Sin cambios";
	}, [autoSaveStatus]);

	const progressUnitLabel = obra ? progressUnitLabels[obra.type] : "";
	const hasProgress = obra ? obra.type !== "movie" : false;

	return (
		<Sheet open={open} onOpenChange={handleOpenChange}>
			<SheetContent
				side="right"
				className="h-dvh max-h-dvh w-full max-w-none overflow-y-auto border-l-border bg-card p-0 sm:max-w-xl lg:max-w-2xl"
			>
				<SheetHeader className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4">
					<div className="flex items-start justify-between gap-4 pr-9">
						<div className="min-w-0 flex flex-col gap-1">
							<SheetTitle className="font-serif text-xl">
								Editar obra
							</SheetTitle>
							<SheetDescription>
								Los cambios se guardan automáticamente.
							</SheetDescription>
						</div>
						<div className="flex shrink-0 flex-col items-end gap-1 text-right">
							<span
								className={cn(
									"text-xs font-medium",
									autoSaveStatus === "error"
										? "text-destructive"
										: "text-muted-foreground",
								)}
							>
								{autoSaveLabel}
							</span>
							{autoSaveStatus === "error" && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => {
										if (lastFailedPatch) void commitPatch(lastFailedPatch);
									}}
									className="h-7 rounded-none px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
								>
									Reintentar
								</Button>
							)}
						</div>
					</div>
					{autoSaveError && (
						<p className="text-xs text-destructive">{autoSaveError}</p>
					)}
				</SheetHeader>

				<div className="px-5 py-5">
					{doc === undefined || !obra || !values ? (
						<div className="flex flex-col gap-4">
							<Skeleton className="h-24 rounded-none" />
							<Skeleton className="h-40 rounded-none" />
							<Skeleton className="h-40 rounded-none" />
						</div>
					) : doc === null ? (
						<p className="text-sm text-muted-foreground">Obra no encontrada.</p>
					) : (
						<div className="flex flex-col gap-8">
							<section className="flex flex-col gap-4 border border-border bg-card p-5">
								<p className="text-sm font-medium">Información básica</p>
								<div className="flex flex-col gap-2">
									<Label>Título</Label>
									<Input
										value={values.customTitle}
										onChange={(event) => {
											const nextValues = {
												...values,
												customTitle: event.target.value,
											};
											updateValues(
												nextValues,
												buildCustomPatch(nextValues),
												"customTitle",
											);
										}}
										className="rounded-none border-border bg-background focus-visible:ring-primary"
									/>
								</div>
								<div className="flex flex-col gap-2">
									<Label>Creador</Label>
									<Input
										value={values.customCreator}
										onChange={(event) => {
											const nextValues = {
												...values,
												customCreator: event.target.value,
											};
											updateValues(
												nextValues,
												buildCustomPatch(nextValues),
												"customCreator",
											);
										}}
										className="rounded-none border-border bg-background focus-visible:ring-primary"
									/>
								</div>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="flex flex-col gap-2">
										<Label>Año</Label>
										<Input
											type="number"
											value={values.customYear}
											onChange={(event) => {
												const nextValues = {
													...values,
													customYear: event.target.value,
												};
												updateValues(
													nextValues,
													buildCustomPatch(nextValues),
													"customYear",
												);
											}}
											className="rounded-none border-border bg-background focus-visible:ring-primary"
										/>
									</div>
									<div className="flex flex-col gap-2">
										<Label>Portada (URL)</Label>
										<Input
											value={values.customCoverUrl}
											onChange={(event) => {
												const nextValues = {
													...values,
													customCoverUrl: event.target.value,
												};
												updateValues(
													nextValues,
													buildCustomPatch(nextValues),
													"customCoverUrl",
												);
											}}
											className="rounded-none border-border bg-background focus-visible:ring-primary"
										/>
									</div>
								</div>
							</section>

							{hasProgress && (
								<section className="flex flex-col gap-4 border border-border bg-card p-5">
									<p className="text-sm font-medium">Progreso</p>
									<div className="flex flex-col gap-3">
										<Label>
											Progreso
											{progressUnitLabel ? ` (${progressUnitLabel})` : ""}
										</Label>
										<div className="flex items-center justify-between">
											<span className="text-sm text-muted-foreground">
												{values.progressCurrent} / {values.progressTotal || "-"}
											</span>
										</div>
										<div className="flex items-center gap-3">
											<Button
												type="button"
												variant="outline"
												size="icon"
												disabled={values.progressTotal <= 0}
												className="rounded-none border-border hover:border-primary hover:text-primary"
												onClick={() =>
													handleStepProgressChange(
														values.progressCurrent - 1,
														values.progressTotal,
													)
												}
											>
												<Minus />
											</Button>
											<Slider
												min={0}
												max={values.progressTotal || 1}
												step={1}
												disabled={values.progressTotal <= 0}
												value={[
													Math.min(
														values.progressCurrent,
														values.progressTotal || 0,
													),
												]}
												onValueChange={(nextValue) => {
													const current = Array.isArray(nextValue)
														? nextValue[0]
														: nextValue;
													if (current !== undefined) {
														handleStepProgressChange(
															current,
															values.progressTotal,
														);
													}
												}}
												className="flex-1"
											/>
											<Button
												type="button"
												variant="outline"
												size="icon"
												disabled={values.progressTotal <= 0}
												className="rounded-none border-border hover:border-primary hover:text-primary"
												onClick={() =>
													handleStepProgressChange(
														values.progressCurrent + 1,
														values.progressTotal,
													)
												}
											>
												<Plus />
											</Button>
										</div>
										<div className="flex flex-col gap-2">
											<Label>
												Total
												{progressUnitLabel ? ` (${progressUnitLabel})` : ""}
											</Label>
											<Input
												type="number"
												min={0}
												step={1}
												value={String(values.progressTotal)}
												onChange={(event) => {
													const nextValue = event.target.value
														? Number(event.target.value)
														: 0;
													handleProgressTotalChange(
														Number.isNaN(nextValue) ? 0 : nextValue,
													);
												}}
												className="max-w-[140px] rounded-none border-border bg-background focus-visible:ring-primary"
											/>
										</div>
									</div>
								</section>
							)}

							<section className="flex flex-col gap-4 border border-border bg-card p-5">
								<p className="text-sm font-medium">Lectura</p>
								<div className="flex flex-col gap-2">
									<Label>Lectura personal</Label>
									<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
										<Input
											value={values.readingUrl}
											onChange={(event) => {
												const nextValues = {
													...values,
													readingUrl: event.target.value,
												};
												updateValues(
													nextValues,
													buildPersonalPatch(nextValues, obra),
													"readingUrl",
												);
											}}
											placeholder="https://cubari.moe/..."
											className="flex-1 rounded-none border-border bg-background focus-visible:ring-primary"
										/>
										<Button
											type="button"
											variant="outline"
											disabled={!values.readingUrl.trim()}
											onClick={() => handleOpenReadingLink(values.readingUrl)}
											className="rounded-none border-border hover:border-primary hover:text-primary"
										>
											<ExternalLink />
											Ir a leer
										</Button>
									</div>
								</div>
							</section>

							<section className="flex flex-col gap-4 border border-border bg-card p-5">
								<p className="text-sm font-medium">Estado y fechas</p>
								<div className="flex flex-col gap-2">
									<Label>Estado</Label>
									<Select
										value={obra.status}
										onValueChange={(value) =>
											handleStatusChange(value as ObraStatus)
										}
									>
										<SelectTrigger className="rounded-none border-border bg-background focus:ring-primary">
											<span className="truncate">
												{getStatusLabel(obra.status, obra.type)}
											</span>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="backlog">
												{getStatusLabel("backlog", obra.type)}
											</SelectItem>
											<SelectItem value="in-progress">
												{getStatusLabel("in-progress", obra.type)}
											</SelectItem>
											<SelectItem value="finished">
												{getStatusLabel("finished", obra.type)}
											</SelectItem>
											<SelectItem value="dropped">
												{getStatusLabel("dropped", obra.type)}
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="flex flex-col gap-2 sm:col-span-2">
										<Label>Recomendado por</Label>
										<Input
											value={values.recommendedBy}
											onChange={(event) => {
												const nextValues = {
													...values,
													recommendedBy: event.target.value,
												};
												updateValues(
													nextValues,
													buildPersonalPatch(nextValues, obra),
													"recommendedBy",
												);
											}}
											className="rounded-none border-border bg-background focus-visible:ring-primary"
										/>
									</div>
									<div className="flex flex-col gap-2">
										<Label>
											{obra.type === "movie" ? "Fecha" : "Fecha de inicio"}
										</Label>
										<Input
											type="date"
											value={
												obra.type === "movie"
													? values.finishedAt
													: values.startedAt
											}
											onChange={(event) => {
												const nextValues =
													obra.type === "movie"
														? {
																...values,
																startedAt: event.target.value,
																finishedAt: event.target.value,
															}
														: { ...values, startedAt: event.target.value };
												updateValues(
													nextValues,
													buildPersonalPatch(nextValues, obra),
													obra.type === "movie" ? "movieDate" : "startedAt",
													300,
												);
											}}
											className="rounded-none border-border bg-background focus-visible:ring-primary"
										/>
									</div>
									{obra.type !== "movie" && (
										<div className="flex flex-col gap-2">
											<Label>Fecha de término</Label>
											<Input
												type="date"
												value={values.finishedAt}
												onChange={(event) => {
													const nextValues = {
														...values,
														finishedAt: event.target.value,
													};
													updateValues(
														nextValues,
														buildPersonalPatch(nextValues, obra),
														"finishedAt",
														300,
													);
												}}
												className="rounded-none border-border bg-background focus-visible:ring-primary"
											/>
										</div>
									)}
								</div>
							</section>

							<section className="flex flex-col gap-4 border border-border bg-card p-5">
								<p className="text-sm font-medium">Reseña y citas</p>
								<div className="flex flex-col gap-2">
									<Label>Reseña</Label>
									<Textarea
										value={values.review}
										onChange={(event) => {
											const nextValues = {
												...values,
												review: event.target.value,
											};
											updateValues(
												nextValues,
												buildPersonalPatch(nextValues, obra),
												"review",
											);
										}}
										placeholder="Escribe tu reseña..."
										rows={10}
										className="rounded-none border-border bg-background focus-visible:ring-primary"
									/>
								</div>
								<div className="flex flex-col gap-3">
									<div className="flex items-center justify-between gap-3">
										<Label>Citas</Label>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={handleAddQuote}
											className="rounded-none border-border hover:border-primary hover:text-primary"
										>
											<Plus />
											Agregar cita
										</Button>
									</div>
									{quotes.length === 0 ? (
										<div className="border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
											Todavía no hay citas para esta obra.
										</div>
									) : (
										<div className="flex flex-col gap-3">
											{quotes.map((quote) => (
												<div
													key={quote.clientId}
													className="flex flex-col gap-3 border border-border bg-muted/30 p-3"
												>
													<div className="flex items-start gap-2">
														<Textarea
															value={quote.content}
															onChange={(event) =>
																handleQuoteChange(
																	quote.clientId,
																	"content",
																	event.target.value,
																)
															}
															placeholder="Cita"
															rows={3}
															className="min-h-24 rounded-none border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
														/>
														<Button
															type="button"
															variant="ghost"
															size="icon"
															aria-label="Eliminar cita"
															onClick={() => handleRemoveQuote(quote.clientId)}
															className="shrink-0 rounded-none text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
														>
															<Trash2 />
														</Button>
													</div>
													<Input
														value={quote.characterName}
														onChange={(event) =>
															handleQuoteChange(
																quote.clientId,
																"characterName",
																event.target.value,
															)
														}
														placeholder="Personaje"
														className="rounded-none border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
													/>
												</div>
											))}
										</div>
									)}
								</div>
							</section>
						</div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
