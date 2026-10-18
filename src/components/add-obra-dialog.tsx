import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState } from "react";
import { MetadataSearch } from "@/components/add-obra/metadata-search";
import { ObraForm } from "@/components/add-obra/obra-form";
import { TypeSelector } from "@/components/add-obra/type-selector";
import { useObraMetadata } from "@/components/add-obra/use-obra-metadata";
import { CompletionReviewDialog } from "@/components/completion-review-dialog";
import { Plus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { MetadataSearchResult } from "@/lib/metadata/types";
import type { CreateObraInput, ObraType } from "@/lib/types";

const metadataSourceLabels = {
	"google-books": "Google Books",
	"open-library": "Open Library",
	"apple-books": "Apple Books",
	amazon: "Amazon",
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
	const [initialReadingUrl, setInitialReadingUrl] = useState("");
	const [initialSourceUrl, setInitialSourceUrl] = useState("");
	const metadata = useObraMetadata({ open, activeType });
	const createObra = useMutation(convexApi.obras.create);
	const saveReview = useMutation(convexApi.obras.saveReview);
	const snoozeReview = useMutation(convexApi.obras.snoozeReview);
	const skipReview = useMutation(convexApi.obras.skipReview);
	const [createdReview, setCreatedReview] = useState<{
		id: Id<"obras">;
		title: string;
	} | null>(null);

	const metadataSourceLabel = activeType
		? metadataSourceLabels[metadataSourceByType[activeType]]
		: "";

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			metadata.reset();
			setStep(1);
			setActiveType("");
			setInitialReadingUrl("");
			setInitialSourceUrl("");
		}
	};

	const handleSelectType = (type: ObraType) => {
		setActiveType(type);
		metadata.clearResults();
		setInitialReadingUrl("");
		setInitialSourceUrl("");
		setStep(2);
	};

	const handleSkipMetadataSearch = () => {
		metadata.clearSelection();
		setInitialReadingUrl("");
		setInitialSourceUrl(metadata.directUrlFallback?.url ?? "");
		setStep(3);
	};

	const handleSelectResult = (result: MetadataSearchResult) => {
		void metadata.selectResult(result);
		setStep(3);
	};

	const handleFormSubmit = async (input: CreateObraInput) => {
		const created = await createObra(input);
		handleOpenChange(false);
		if (created.status === "finished" && created.reviewStatus === "pending") {
			setCreatedReview({ id: created.id, title: created.title });
		}
	};

	const getStepTitle = () => {
		if (step === 1) return "Nueva obra";
		if (step === 2) return "Buscar obra";
		return "Editar obra";
	};

	return (
		<>
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
							query={metadata.query}
							onQueryChange={metadata.setQuery}
							results={metadata.results}
							isSearching={metadata.isSearching}
							error={metadata.error}
							directUrlFallback={metadata.directUrlFallback}
							onSelectResult={handleSelectResult}
							onSkip={handleSkipMetadataSearch}
							onBack={() => {
								setStep(1);
								setActiveType("");
								metadata.clearResults();
								setInitialReadingUrl("");
							}}
							sourceLabel={metadataSourceLabel}
						/>
					)}

					{step === 3 && activeType && (
						<ObraForm
							type={activeType}
							selectedMetadata={metadata.selected}
							metadataDetails={metadata.details}
							isLoadingDetails={metadata.isLoadingDetails}
							initialReadingUrl={initialReadingUrl}
							initialSourceUrl={initialSourceUrl}
							onBack={() => {
								metadata.clearSelection();
								setStep(2);
								setInitialReadingUrl("");
							}}
							onCancel={() => handleOpenChange(false)}
							onSubmit={handleFormSubmit}
						/>
					)}
				</DialogContent>
			</Dialog>
			{createdReview && (
				<CompletionReviewDialog
					open
					onOpenChange={(nextOpen) => {
						if (!nextOpen) setCreatedReview(null);
					}}
					title={createdReview.title}
					onSave={(review) => saveReview({ id: createdReview.id, review })}
					onLater={() => snoozeReview({ id: createdReview.id })}
					onSkip={() => skipReview({ id: createdReview.id })}
				/>
			)}
		</>
	);
}
