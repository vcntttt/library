import { api as convexApi } from "@convex/_generated/api";
import { useAuthToken } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { MetadataSearch } from "@/components/add-obra/metadata-search";
import { ObraForm } from "@/components/add-obra/obra-form";
import { TypeSelector } from "@/components/add-obra/type-selector";
import { Plus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type {
	MetadataDetails,
	MetadataDirectUrlFallback,
	MetadataSearchResult,
} from "@/lib/metadata/types";
import type { CreateObraInput, ObraType } from "@/lib/types";

const metadataSourceLabels = {
	"google-books": "Google Books",
	"open-library": "Open Library",
	"apple-books": "Apple Books",
	tmdb: "TMDB",
	anilist: "AniList",
	manhwaweb: "ManhwaWeb",
};

const metadataSourceByType: Record<
	ObraType,
	keyof typeof metadataSourceLabels
> = {
	book: "google-books",
	movie: "tmdb",
	series: "tmdb",
	anime: "anilist",
	manga: "anilist",
	manhwa: "manhwaweb",
};

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

interface AddObraDialogProps {
	triggerMode?: "default" | "fab";
	className?: string;
}

export function AddObraDialog({
	triggerMode = "default",
	className,
}: AddObraDialogProps = {}) {
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState<1 | 2 | 3>(1);
	const [activeType, setActiveType] = useState<ObraType | "">("");
	const [metadataQuery, setMetadataQuery] = useState("");
	const [metadataResults, setMetadataResults] = useState<
		MetadataSearchResult[]
	>([]);
	const [selectedMetadata, setSelectedMetadata] =
		useState<MetadataSearchResult | null>(null);
	const [metadataDetails, setMetadataDetails] =
		useState<MetadataDetails | null>(null);
	const [directUrlFallback, setDirectUrlFallback] =
		useState<MetadataDirectUrlFallback | null>(null);
	const [initialReadingUrl, setInitialReadingUrl] = useState("");
	const [metadataError, setMetadataError] = useState<string | null>(null);
	const [isSearchingMetadata, setIsSearchingMetadata] = useState(false);
	const [isLoadingMetadataDetails, setIsLoadingMetadataDetails] =
		useState(false);
	const metadataAbortRef = useRef<AbortController | null>(null);
	const metadataDebounceRef = useRef<number | null>(null);
	const authToken = useAuthToken();
	const createObra = useMutation(convexApi.obras.create);

	const metadataSourceLabel = activeType
		? metadataSourceLabels[metadataSourceByType[activeType]]
		: "";

	useEffect(() => {
		if (!open || selectedMetadata || !activeType) return;

		const query = metadataQuery.trim();
		if (query.length < 3) {
			setMetadataResults([]);
			setDirectUrlFallback(null);
			setMetadataError(null);
			setIsSearchingMetadata(false);
			return;
		}

		if (metadataDebounceRef.current) {
			window.clearTimeout(metadataDebounceRef.current);
		}
		metadataAbortRef.current?.abort();

		const controller = new AbortController();
		metadataAbortRef.current = controller;

		metadataDebounceRef.current = window.setTimeout(async () => {
			setIsSearchingMetadata(true);
			setMetadataError(null);
			setDirectUrlFallback(null);
			try {
				const response = await fetch(
					`/api/metadata/search?type=${encodeURIComponent(activeType)}&q=${encodeURIComponent(query)}`,
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
				const results = Array.isArray(payload?.results)
					? (payload.results as MetadataSearchResult[])
					: [];
				const fallback = isMetadataDirectUrlFallback(payload?.directUrlFallback)
					? payload.directUrlFallback
					: null;
				setMetadataResults(results);
				setDirectUrlFallback(fallback);
				if (results.length === 0 && !fallback) {
					setMetadataError("No hay resultados.");
				}
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") {
					return;
				}
				setDirectUrlFallback(null);
				setMetadataError(
					error instanceof Error
						? error.message
						: "No se pudo buscar metadatos.",
				);
			} finally {
				setIsSearchingMetadata(false);
			}
		}, 350);

		return () => {
			controller.abort();
			if (metadataDebounceRef.current) {
				window.clearTimeout(metadataDebounceRef.current);
			}
		};
	}, [open, metadataQuery, activeType, selectedMetadata, authToken]);

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			metadataAbortRef.current?.abort();
			if (metadataDebounceRef.current) {
				window.clearTimeout(metadataDebounceRef.current);
			}
			setStep(1);
			setActiveType("");
			setMetadataQuery("");
			setMetadataResults([]);
			setSelectedMetadata(null);
			setMetadataDetails(null);
			setDirectUrlFallback(null);
			setInitialReadingUrl("");
			setMetadataError(null);
			setIsSearchingMetadata(false);
			setIsLoadingMetadataDetails(false);
		}
	};

	const handleSelectType = (type: ObraType) => {
		setActiveType(type);
		setDirectUrlFallback(null);
		setInitialReadingUrl("");
		setStep(2);
	};

	const handleSkipMetadataSearch = () => {
		setSelectedMetadata(null);
		setMetadataDetails(null);
		setMetadataError(null);
		setInitialReadingUrl(directUrlFallback?.url ?? "");
		setStep(3);
	};

	const handleSelectResult = async (result: MetadataSearchResult) => {
		setSelectedMetadata(result);
		setStep(3);
		setIsLoadingMetadataDetails(true);
		setMetadataDetails(null);
		setMetadataError(null);

		try {
			const response = await fetch(
				`/api/metadata/details?source=${encodeURIComponent(result.source)}&id=${encodeURIComponent(result.id)}&type=${encodeURIComponent(activeType)}`,
				{
					headers: authToken
						? { authorization: `Bearer ${authToken}` }
						: undefined,
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
			const details = payload?.details as MetadataDetails | undefined;
			if (details) setMetadataDetails(details);
		} catch (error) {
			setMetadataError(
				error instanceof Error ? error.message : "No se pudo cargar metadatos.",
			);
		} finally {
			setIsLoadingMetadataDetails(false);
		}
	};

	const handleFormSubmit = async (input: CreateObraInput) => {
		await createObra(input);
		handleOpenChange(false);
	};

	const getStepTitle = () => {
		if (step === 1) return "Nueva obra";
		if (step === 2) return "Buscar obra";
		return "Editar obra";
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger
				render={
					triggerMode === "fab" ? (
						<Button
							size="icon-lg"
							className={`group size-14 rounded-full shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 ${className ?? ""}`}
							aria-label="Agregar nueva obra"
						/>
					) : (
						<Button
							size="lg"
							className={`group h-10 gap-2 rounded-full px-4 font-semibold shadow-md shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 ${className ?? ""}`}
							aria-label="Agregar nueva obra"
						/>
					)
				}
			>
				<Plus
					className={
						triggerMode === "fab"
							? "h-5 w-5 transition-transform group-hover:rotate-90"
							: "h-4 w-4 transition-transform group-hover:rotate-90"
					}
				/>
				{triggerMode === "default" ? (
					"Agregar obra"
				) : (
					<span className="sr-only">Agregar obra</span>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl rounded-xl max-h-[calc(100vh-2rem)] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-lg font-semibold font-serif">
						{getStepTitle()}
					</DialogTitle>
				</DialogHeader>

				{step === 1 && <TypeSelector onSelect={handleSelectType} />}

				{step === 2 && activeType && (
					<MetadataSearch
						type={activeType}
						query={metadataQuery}
						onQueryChange={setMetadataQuery}
						results={metadataResults}
						isSearching={isSearchingMetadata}
						error={metadataError}
						directUrlFallback={directUrlFallback}
						onSelectResult={handleSelectResult}
						onSkip={handleSkipMetadataSearch}
						onBack={() => {
							setStep(1);
							setActiveType("");
							setDirectUrlFallback(null);
							setInitialReadingUrl("");
						}}
						sourceLabel={metadataSourceLabel}
					/>
				)}

				{step === 3 && activeType && (
					<ObraForm
						type={activeType}
						selectedMetadata={selectedMetadata}
						metadataDetails={metadataDetails}
						isLoadingDetails={isLoadingMetadataDetails}
						initialReadingUrl={initialReadingUrl}
						onBack={() => {
							setStep(2);
							setSelectedMetadata(null);
							setMetadataDetails(null);
							setMetadataError(null);
							setInitialReadingUrl("");
						}}
						onCancel={() => handleOpenChange(false)}
						onSubmit={handleFormSubmit}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
