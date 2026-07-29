"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	getSeasonEndProgress,
	getSeasonProgress,
	setSeasonProgress,
	totalEpisodesForSeasons,
	validateSeasons,
} from "@/lib/season-progress";
import type { ObraSeason } from "@/lib/types";

interface SeasonProgressEditorProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	seasons: ObraSeason[];
	current: number;
	total: number;
	onChange: (next: {
		seasons: ObraSeason[];
		current: number;
		total: number;
	}) => void;
	onFinishSeason?: (next: {
		seasons: ObraSeason[];
		current: number;
		total: number;
		seasonNumber: number;
		isLastSeason: boolean;
	}) => void;
}

const MAX_VISIBLE_EPISODES = 24;

export function SeasonProgressEditor({
	open,
	onOpenChange,
	seasons,
	current,
	total,
	onChange,
	onFinishSeason,
}: SeasonProgressEditorProps) {
	const [localSeasons, setLocalSeasons] = useState<ObraSeason[]>([]);
	const [localCurrent, setLocalCurrent] = useState(current);

	useEffect(() => {
		if (!open) return;
		setLocalSeasons(validateSeasons(seasons));
		setLocalCurrent(current);
	}, [open, seasons, current]);

	const sanitized = useMemo(
		() => validateSeasons(localSeasons),
		[localSeasons],
	);
	const progress = useMemo(
		() => getSeasonProgress(sanitized, localCurrent),
		[sanitized, localCurrent],
	);
	const derivedTotal = useMemo(
		() => totalEpisodesForSeasons(sanitized),
		[sanitized],
	);
	const effectiveTotal = Math.max(derivedTotal, total);

	const applySeasons = (nextSeasons: ObraSeason[]) => {
		const valid = validateSeasons(nextSeasons);
		setLocalSeasons(valid);
		const nextTotal = totalEpisodesForSeasons(valid);
		const effectiveNextTotal = Math.max(nextTotal, total);
		const nextCurrent = Math.min(localCurrent, effectiveNextTotal);
		setLocalCurrent(nextCurrent);
		onChange({
			seasons: valid,
			current: nextCurrent,
			total: effectiveNextTotal,
		});
	};

	const updateSeasonEpisodeCount = (seasonNumber: number, count: number) => {
		applySeasons(
			sanitized.map((season) =>
				season.seasonNumber === seasonNumber
					? { ...season, episodeCount: Math.max(0, count) }
					: season,
			),
		);
	};

	const addSeason = () => {
		const nextSeasonNumber =
			sanitized.length > 0
				? sanitized[sanitized.length - 1].seasonNumber + 1
				: 1;
		applySeasons([
			...sanitized,
			{ seasonNumber: nextSeasonNumber, episodeCount: 1 },
		]);
	};

	const removeLastSeason = () => {
		applySeasons(sanitized.slice(0, -1));
	};

	const setCurrentBySeasonEpisode = (seasonNumber: number, episode: number) => {
		const nextCurrent = setSeasonProgress(sanitized, seasonNumber, episode);
		setLocalCurrent(nextCurrent);
		onChange({
			seasons: sanitized,
			current: nextCurrent,
			total: effectiveTotal,
		});
	};

	const handleEpisodeClick = (seasonNumber: number, episode: number) => {
		setCurrentBySeasonEpisode(seasonNumber, episode);
	};

	const finishSeason = (seasonNumber: number) => {
		const nextCurrent = Math.max(
			localCurrent,
			getSeasonEndProgress(sanitized, seasonNumber),
		);
		const next = {
			seasons: sanitized,
			current: nextCurrent,
			total: effectiveTotal,
			seasonNumber,
			isLastSeason: sanitized.at(-1)?.seasonNumber === seasonNumber,
		};
		setLocalCurrent(nextCurrent);
		if (onFinishSeason) {
			onFinishSeason(next);
			return;
		}
		onChange(next);
	};

	const handleCurrentInputChange = (seasonNumber: number, episode: number) => {
		setCurrentBySeasonEpisode(seasonNumber, episode);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				overlayProps={{ onClick: () => onOpenChange(false) }}
				className="h-dvh max-h-dvh w-full max-w-none overflow-y-auto border-l-border bg-card p-0 sm:max-w-xl"
			>
				<SheetHeader className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4">
					<div className="min-w-0 flex flex-col gap-1">
						<SheetTitle className="font-serif text-xl">
							Progreso por temporadas
						</SheetTitle>
						<SheetDescription>
							Marca hasta dónde has visto editando temporada y capítulo.
						</SheetDescription>
					</div>
				</SheetHeader>
				<div className="px-5 py-5 space-y-8">
					<section className="flex flex-col gap-4 border border-border bg-card p-5">
						<p className="text-sm font-medium">Temporada actual</p>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="flex flex-col gap-2">
								<Label>Temporada</Label>
								<Input
									type="number"
									min={1}
									value={progress?.seasonNumber ?? 1}
									onChange={(event) => {
										handleCurrentInputChange(
											Number(event.target.value),
											progress?.episode ?? 0,
										);
									}}
									className="rounded-none border-border bg-background focus-visible:ring-primary"
								/>
							</div>
							<div className="flex flex-col gap-2">
								<Label>Capítulo</Label>
								<Input
									type="number"
									min={0}
									value={progress?.episode ?? 0}
									onChange={(event) => {
										handleCurrentInputChange(
											progress?.seasonNumber ?? 1,
											Number(event.target.value),
										);
									}}
									className="rounded-none border-border bg-background focus-visible:ring-primary"
								/>
							</div>
						</div>
						<p className="text-sm text-muted-foreground">
							Total: {localCurrent} / {effectiveTotal}
						</p>
					</section>

					<section className="flex flex-col gap-4 border border-border bg-card p-5">
						<div className="flex items-center justify-between">
							<p className="text-sm font-medium">Temporadas</p>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="icon"
									aria-label="Eliminar última temporada"
									disabled={sanitized.length <= 1}
									onClick={removeLastSeason}
									className="rounded-none border-border hover:border-destructive hover:text-destructive"
								>
									<Minus />
								</Button>
								<Button
									type="button"
									variant="outline"
									size="icon"
									aria-label="Agregar temporada"
									onClick={addSeason}
									className="rounded-none border-border hover:border-primary hover:text-primary"
								>
									<Plus />
								</Button>
							</div>
						</div>
						<div className="flex flex-col gap-3">
							{sanitized.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No hay temporadas configuradas.
								</p>
							) : (
								sanitized.map((season) => (
									<div
										key={season.seasonNumber}
										className="flex flex-col gap-2"
									>
										<div className="flex items-center justify-between gap-3">
											<Label>Temporada {season.seasonNumber}</Label>
											<div className="flex items-center gap-2">
												<Button
													type="button"
													variant="ghost"
													size="sm"
													disabled={
														getSeasonEndProgress(
															sanitized,
															season.seasonNumber,
														) <= localCurrent
													}
													onClick={() => finishSeason(season.seasonNumber)}
													className="rounded-none"
												>
													<Check className="size-4" />
													{getSeasonEndProgress(
														sanitized,
														season.seasonNumber,
													) <= localCurrent
														? "Terminada"
														: "Terminar temporada"}
												</Button>
												<Input
													type="number"
													min={1}
													value={season.episodeCount}
													aria-label={`Episodios de la temporada ${season.seasonNumber}`}
													onChange={(event) => {
														updateSeasonEpisodeCount(
															season.seasonNumber,
															Number(event.target.value),
														);
													}}
													className="max-w-[100px] rounded-none border-border bg-background focus-visible:ring-primary"
												/>
											</div>
										</div>
										<EpisodeGrid
											season={season}
											current={localCurrent}
											seasons={sanitized}
											onClick={handleEpisodeClick}
										/>
									</div>
								))
							)}
						</div>
					</section>
				</div>
			</SheetContent>
		</Sheet>
	);
}

function EpisodeGrid({
	season,
	current,
	seasons,
	onClick,
}: {
	season: ObraSeason;
	current: number;
	seasons: ObraSeason[];
	onClick: (seasonNumber: number, episode: number) => void;
}) {
	const previousTotal = useMemo(
		() =>
			seasons
				.filter((s) => s.seasonNumber < season.seasonNumber)
				.reduce((sum, s) => sum + s.episodeCount, 0),
		[seasons, season.seasonNumber],
	);

	if (season.episodeCount > MAX_VISIBLE_EPISODES) {
		return (
			<p className="text-xs text-muted-foreground">
				{season.episodeCount} episodios. Usa los inputs de arriba para marcar
				avance.
			</p>
		);
	}

	return (
		<div className="flex flex-wrap gap-1">
			{Array.from({ length: season.episodeCount }, (_, index) => {
				const episode = index + 1;
				const globalIndex = previousTotal + episode;
				const isWatched = globalIndex <= current;
				return (
					<button
						type="button"
						key={episode}
						onClick={() => onClick(season.seasonNumber, episode)}
						className={[
							"h-7 w-7 text-xs transition-colors",
							"border border-border hover:border-primary hover:text-primary",
							isWatched
								? "bg-primary text-primary-foreground"
								: "bg-background text-muted-foreground",
						].join(" ")}
					>
						{episode}
					</button>
				);
			})}
		</div>
	);
}
