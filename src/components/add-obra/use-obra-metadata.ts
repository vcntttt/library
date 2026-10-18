import { useAuthToken } from "@convex-dev/auth/react";
import { useEffect, useRef, useState } from "react";
import type {
	MetadataDetails,
	MetadataDirectUrlFallback,
	MetadataSearchResult,
} from "@/lib/metadata/types";
import type { ObraType } from "@/lib/types";

function isMetadataDirectUrlFallback(
	value: unknown,
): value is MetadataDirectUrlFallback {
	return (
		typeof value === "object" &&
		value !== null &&
		"url" in value &&
		typeof value.url === "string" &&
		"label" in value &&
		typeof value.label === "string" &&
		"reason" in value &&
		typeof value.reason === "string"
	);
}

interface UseObraMetadataOptions {
	open: boolean;
	activeType: ObraType | "";
}

// Busca metadatos con debounce y carga el detalle del resultado elegido; una búsqueda o detalle nuevo cancela al anterior.
export function useObraMetadata({ open, activeType }: UseObraMetadataOptions) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<MetadataSearchResult[]>([]);
	const [directUrlFallback, setDirectUrlFallback] =
		useState<MetadataDirectUrlFallback | null>(null);
	const [selected, setSelected] = useState<MetadataSearchResult | null>(null);
	const [details, setDetails] = useState<MetadataDetails | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isSearching, setIsSearching] = useState(false);
	// El detalle en curso vive en estado: su ausencia es el fin de la carga, sin banderas que limpiar.
	const [detailsRequest, setDetailsRequest] = useState<AbortController | null>(
		null,
	);
	const metadataAbortRef = useRef<AbortController | null>(null);
	const metadataDebounceRef = useRef<number | null>(null);
	const authToken = useAuthToken();

	useEffect(() => {
		if (!open || selected || !activeType) return;

		const trimmedQuery = query.trim();
		if (trimmedQuery.length < 3) {
			setResults([]);
			setDirectUrlFallback(null);
			setError(null);
			setIsSearching(false);
			return;
		}

		if (metadataDebounceRef.current) {
			window.clearTimeout(metadataDebounceRef.current);
		}
		metadataAbortRef.current?.abort();

		const controller = new AbortController();
		metadataAbortRef.current = controller;

		metadataDebounceRef.current = window.setTimeout(async () => {
			setIsSearching(true);
			setError(null);
			setDirectUrlFallback(null);
			try {
				const response = await fetch(
					`/api/metadata/search?type=${encodeURIComponent(activeType)}&q=${encodeURIComponent(trimmedQuery)}`,
					{
						headers: authToken
							? { authorization: `Bearer ${authToken}` }
							: undefined,
						signal: controller.signal,
					},
				);
				if (!response.ok) {
					const payload = await response.json().catch(() => ({}));
					console.error("[metadata/search] request failed", {
						status: response.status,
						statusText: response.statusText,
						payload,
						url: response.url,
					});
					const message =
						payload && typeof payload.error === "string"
							? payload.error
							: "No se pudo buscar metadatos.";
					throw new Error(message);
				}

				const payload = await response.json();
				const nextResults = Array.isArray(payload?.results)
					? (payload.results as MetadataSearchResult[])
					: [];
				const fallback = isMetadataDirectUrlFallback(payload?.directUrlFallback)
					? payload.directUrlFallback
					: null;
				setResults(nextResults);
				setDirectUrlFallback(fallback);
				if (nextResults.length === 0 && !fallback) {
					setError("No hay resultados.");
				}
			} catch (fetchError) {
				if (fetchError instanceof Error && fetchError.name === "AbortError") {
					return;
				}
				setDirectUrlFallback(null);
				setError(
					fetchError instanceof Error
						? fetchError.message
						: "No se pudo buscar metadatos.",
				);
			} finally {
				setIsSearching(false);
			}
		}, 350);

		return () => {
			controller.abort();
			if (metadataDebounceRef.current) {
				window.clearTimeout(metadataDebounceRef.current);
			}
		};
	}, [open, query, activeType, selected, authToken]);

	const cancelDetails = () => {
		detailsRequest?.abort();
		setDetailsRequest(null);
	};

	const selectResult = async (result: MetadataSearchResult) => {
		cancelDetails();
		const controller = new AbortController();
		setDetailsRequest(controller);
		setSelected(result);
		setDetails(null);
		setError(null);

		try {
			const response = await fetch(
				`/api/metadata/details?source=${encodeURIComponent(result.source)}&id=${encodeURIComponent(result.id)}&type=${encodeURIComponent(activeType)}`,
				{
					headers: authToken
						? { authorization: `Bearer ${authToken}` }
						: undefined,
					signal: controller.signal,
				},
			);
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				const message =
					payload && typeof payload.error === "string"
						? payload.error
						: "No se pudo cargar metadatos.";
				throw new Error(message);
			}

			const payload = await response.json();
			const nextDetails = payload?.details as MetadataDetails | undefined;
			if (nextDetails && !controller.signal.aborted) setDetails(nextDetails);
		} catch (fetchError) {
			if (controller.signal.aborted) return;
			setError(
				fetchError instanceof Error
					? fetchError.message
					: "No se pudo cargar metadatos.",
			);
		} finally {
			setDetailsRequest((current) => (current === controller ? null : current));
		}
	};

	const clearSelection = () => {
		cancelDetails();
		setSelected(null);
		setDetails(null);
		setError(null);
	};

	const clearResults = () => {
		setResults([]);
		setDirectUrlFallback(null);
	};

	const reset = () => {
		metadataAbortRef.current?.abort();
		if (metadataDebounceRef.current) {
			window.clearTimeout(metadataDebounceRef.current);
		}
		clearSelection();
		setQuery("");
		clearResults();
		setError(null);
		setIsSearching(false);
	};

	return {
		query,
		setQuery,
		results,
		directUrlFallback,
		error,
		isSearching,
		selected,
		details,
		isLoadingDetails: detailsRequest !== null,
		selectResult,
		clearSelection,
		clearResults,
		reset,
	};
}
