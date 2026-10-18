import { useAuthToken } from "@convex-dev/auth/react";
import { useState } from "react";
import { isMetadataFinished } from "@/lib/metadata/format";
import { buildMetadataPayload } from "@/lib/metadata/payload";
import type { MetadataDetails } from "@/lib/metadata/types";
import { clampProgressCurrent } from "@/lib/progress";
import { mergeSeasons, totalEpisodesForSeasons } from "@/lib/season-progress";
import type { Obra, ObraSeason, ObraStatus } from "@/lib/types";
import type { ObraAutoSave } from "./obra-edit-autosave";
import {
	buildProgressPatch,
	buildQuotesPatch,
	type EditableQuote,
	type EditValues,
	getEditableQuotes,
	getEditValues,
	normalizeReadingUrl,
} from "./obra-edit-patches";
export function useObraEditSession(obra: Obra, autoSave: ObraAutoSave) {
	const authToken = useAuthToken();
	const [values, setValues] = useState<EditValues>(() => getEditValues(obra));
	const [quotes, setQuotes] = useState<EditableQuote[]>(() =>
		getEditableQuotes(obra),
	);
	const [isSeasonEditorOpen, setIsSeasonEditorOpen] = useState(false);
	const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);
	const [metadataRefreshMessage, setMetadataRefreshMessage] = useState<
		string | null
	>(null);
	const [isCompletionReviewOpen, setIsCompletionReviewOpen] = useState(false);
	const { commitPatch, savePatch, flushPendingSaves } = autoSave;
	const updateValues = (
		nextValues: EditValues,
		patch: Record<string, unknown> | null,
		debounceKey: string,
		delayMs?: number,
	) => {
		setValues(nextValues);
		savePatch(patch, { debounceKey, delayMs });
	};

	const handleStatusChange = async (status: ObraStatus) => {
		const nextValues =
			status === "finished" && values.progressTotal > 0
				? { ...values, progressCurrent: values.progressTotal }
				: values;
		setValues(nextValues);
		// Un guardado de progreso pendiente puede llevar un estado automático; se envía antes para que no pise el elegido.
		flushPendingSaves();
		const saved = await commitPatch(
			buildProgressPatch(nextValues, obra, status) ?? { status },
		);
		if (
			saved &&
			status === "finished" &&
			obra.status !== "finished" &&
			!obra.review &&
			obra.reviewStatus !== "skipped"
		) {
			setIsCompletionReviewOpen(true);
		}
	};

	const handleOpenReadingLink = (urlValue: string) => {
		const nextUrl = normalizeReadingUrl(urlValue);
		if (!nextUrl) return;
		window.open(nextUrl, "_blank", "noopener,noreferrer");
	};

	const handleStepProgressChange = (nextCurrent: number, nextTotal: number) => {
		if (!Number.isFinite(nextTotal) || nextTotal <= 0) {
			return;
		}
		const safeCurrent = Math.min(Math.max(nextCurrent, 0), nextTotal);
		const nextValues = { ...values, progressCurrent: safeCurrent };
		setValues(nextValues);
		const resumedStatus =
			safeCurrent > values.progressCurrent &&
			obra.status !== "in-progress" &&
			obra.status !== "finished"
				? "in-progress"
				: undefined;
		savePatch(buildProgressPatch(nextValues, obra, resumedStatus), {
			debounceKey: "progress",
			delayMs: 600,
		});
	};

	const handleProgressTotalChange = (nextTotal: number) => {
		const progressCurrent = clampProgressCurrent(
			values.progressCurrent,
			nextTotal,
		);
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

	const handleSeasonProgressChange = (next: {
		seasons: ObraSeason[];
		current: number;
		total: number;
	}) => {
		const nextValues = {
			...values,
			progressCurrent: next.current,
			progressTotal: next.total,
			progressSeasons: next.seasons,
		};
		setValues(nextValues);
		const resumedStatus =
			next.current > values.progressCurrent &&
			obra.status !== "in-progress" &&
			obra.status !== "finished"
				? "in-progress"
				: undefined;
		savePatch(buildProgressPatch(nextValues, obra, resumedStatus), {
			debounceKey: "progress",
			delayMs: 600,
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
		const nextStatus = shouldFinishObra
			? "finished"
			: obra.status !== "in-progress" &&
					obra.status !== "finished" &&
					next.current > values.progressCurrent
				? "in-progress"
				: undefined;
		const completedTotal = Math.max(next.total, values.progressTotal);
		const nextValues = {
			...values,
			progressCurrent: shouldFinishObra ? completedTotal : next.current,
			progressTotal: completedTotal,
			progressSeasons: next.seasons,
		};
		setValues(nextValues);
		const saved = await commitPatch(
			buildProgressPatch(nextValues, obra, nextStatus) ??
				(shouldFinishObra ? { status: "finished" } : {}),
		);
		if (saved && shouldFinishObra) {
			setIsSeasonEditorOpen(false);
			if (!obra.review && obra.reviewStatus !== "skipped") {
				setIsCompletionReviewOpen(true);
			}
		}
	};

	const handleRefreshMetadata = async () => {
		if (!obra.external || isRefreshingMetadata) return;
		setIsRefreshingMetadata(true);
		setMetadataRefreshMessage(null);
		try {
			const params = new URLSearchParams({
				source: obra.external.source,
				id: obra.external.id,
				type: obra.type,
				refresh: "1",
			});
			const response = await fetch(`/api/metadata/details?${params}`, {
				headers: authToken
					? { authorization: `Bearer ${authToken}` }
					: undefined,
			});
			if (!response.ok) {
				const errorPayload = await response.json().catch(() => ({}));
				throw new Error(
					typeof errorPayload?.error === "string"
						? errorPayload.error
						: "No se pudo actualizar la información.",
				);
			}

			const payload = await response.json();
			const details = payload.details as MetadataDetails;
			const seasons = mergeSeasons(
				values.progressSeasons,
				details.seasonDetails ?? [],
			);
			const seasonTotal = totalEpisodesForSeasons(seasons);
			const providerTotal =
				typeof details.episodes === "number" ? details.episodes : 0;
			const nextTotal = Math.max(
				seasonTotal,
				providerTotal,
				values.progressTotal,
			);
			const nextValues = {
				...values,
				progressCurrent: values.progressCurrent,
				progressTotal: nextTotal,
				progressSeasons: seasons.length > 0 ? seasons : values.progressSeasons,
			};
			const metadata = {
				...(obra.metadata ?? {}),
				...(buildMetadataPayload(details, {
					initializeNotificationBaseline: false,
					previousMetadata: obra.metadata,
				}) ?? {}),
			};
			const patch = {
				title: details.title ?? obra.originalTitle ?? obra.title,
				creator: details.creator ?? obra.originalCreator,
				year: details.year ?? obra.originalYear,
				coverUrl: details.coverUrl ?? obra.originalCoverUrl,
				metadata,
				...(obra.type !== "movie" ? buildProgressPatch(nextValues, obra) : {}),
			};
			const saved = await commitPatch(patch);
			if (!saved) return;
			setValues(nextValues);
			setMetadataRefreshMessage(
				seasons.length > 0
					? `Información actualizada: ${seasons.length} temporadas y ${seasonTotal} episodios.`
					: "Información actualizada; el proveedor no entregó el detalle de temporadas.",
			);
		} catch (error) {
			setMetadataRefreshMessage(
				error instanceof Error
					? error.message
					: "No se pudo actualizar la información.",
			);
		} finally {
			setIsRefreshingMetadata(false);
		}
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
		const nextQuotes = quotes.filter((quote) => quote.clientId !== clientId);
		setQuotes(nextQuotes);
		savePatch(buildQuotesPatch(nextQuotes), { debounceKey: "quotes" });
	};

	const handleQuoteChange = (
		clientId: string,
		field: "content" | "characterName",
		value: string,
	) => {
		const nextQuotes = quotes.map((quote) =>
			quote.clientId === clientId ? { ...quote, [field]: value } : quote,
		);
		setQuotes(nextQuotes);
		savePatch(buildQuotesPatch(nextQuotes), { debounceKey: "quotes" });
	};

	return {
		obra,
		values,
		quotes,
		updateValues,
		isSeasonEditorOpen,
		setIsSeasonEditorOpen,
		isRefreshingMetadata,
		metadataRefreshMessage,
		isCompletionReviewOpen,
		setIsCompletionReviewOpen,
		handleStatusChange,
		handleOpenReadingLink,
		handleStepProgressChange,
		handleProgressTotalChange,
		handleSeasonProgressChange,
		handleFinishSeason,
		handleRefreshMetadata,
		handleAddQuote,
		handleRemoveQuote,
		handleQuoteChange,
	};
}
export type ObraEditSession = ReturnType<typeof useObraEditSession>;
