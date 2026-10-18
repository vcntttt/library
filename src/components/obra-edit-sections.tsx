import { ExternalLink, Minus, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
	formatProgressRemaining,
	formatProgressValue,
	getBookFormatLabel,
	getProgressUnitLabel,
	isAudiobook,
} from "@/lib/progress";
import { formatSeasonProgress } from "@/lib/season-progress";
import { getStatusLabel } from "@/lib/status";
import type { ObraFormat, ObraStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
	bookFormats,
	buildCustomPatch,
	buildFormatPatch,
	buildPersonalPatch,
} from "./obra-edit-patches";
import type { ObraEditSession } from "./obra-edit-session";
import { SeasonProgressEditor } from "./season-progress-editor";

export function ObraIdentitySection({
	obra,
	values,
	updateValues,
	isRefreshingMetadata,
	handleRefreshMetadata,
	metadataRefreshMessage,
}: Pick<
	ObraEditSession,
	| "obra"
	| "values"
	| "updateValues"
	| "isRefreshingMetadata"
	| "handleRefreshMetadata"
	| "metadataRefreshMessage"
>) {
	return (
		<section className="flex flex-col gap-4 border border-border bg-card p-5">
			<div className="flex items-center justify-between gap-3">
				<p className="text-sm font-medium">Información básica</p>
				{obra.external && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={isRefreshingMetadata}
						onClick={() => void handleRefreshMetadata()}
						className="rounded-none border-border hover:border-primary hover:text-primary"
					>
						<RefreshCw
							className={cn("h-4 w-4", isRefreshingMetadata && "animate-spin")}
						/>
						{isRefreshingMetadata ? "Consultando..." : "Actualizar información"}
					</Button>
				)}
			</div>
			{metadataRefreshMessage && (
				<p className="text-xs text-muted-foreground">
					{metadataRefreshMessage}
				</p>
			)}
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
							buildCustomPatch(nextValues, obra),
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
							buildCustomPatch(nextValues, obra),
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
								buildCustomPatch(nextValues, obra),
								"customYear",
							);
						}}
						className="rounded-none border-border bg-background focus-visible:ring-primary"
					/>
				</div>
				{obra.type === "book" && (
					<div className="flex flex-col gap-2">
						<Label>Formato</Label>
						<Select
							value={values.format}
							onValueChange={(value) => {
								const nextValues = {
									...values,
									format: value as ObraFormat,
								};
								updateValues(
									nextValues,
									buildFormatPatch(nextValues, obra),
									"format",
									200,
								);
							}}
						>
							<SelectTrigger className="rounded-none border-border bg-background focus:ring-primary">
								<span className="truncate">
									{getBookFormatLabel(values.format || undefined)}
								</span>
							</SelectTrigger>
							<SelectContent>
								{bookFormats.map((format) => (
									<SelectItem key={format} value={format}>
										{getBookFormatLabel(format)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
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
								buildCustomPatch(nextValues, obra),
								"customCoverUrl",
							);
						}}
						className="rounded-none border-border bg-background focus-visible:ring-primary"
					/>
				</div>
			</div>
		</section>
	);
}

export function ObraProgressSection({
	obra,
	values,
	isSeasonEditorOpen,
	setIsSeasonEditorOpen,
	handleStepProgressChange,
	handleProgressTotalChange,
	handleSeasonProgressChange,
	handleFinishSeason,
}: Pick<
	ObraEditSession,
	| "obra"
	| "values"
	| "isSeasonEditorOpen"
	| "setIsSeasonEditorOpen"
	| "handleStepProgressChange"
	| "handleProgressTotalChange"
	| "handleSeasonProgressChange"
	| "handleFinishSeason"
>) {
	const progressFormat = values.format || undefined;
	const progressUnitLabel = getProgressUnitLabel({
		type: obra.type,
		format: progressFormat,
	});
	const progressControlledByReading = Boolean(obra.readingDocumentId);
	return (
		<section className="flex flex-col gap-4 border border-border bg-card p-5">
			<p className="text-sm font-medium">Progreso</p>
			{progressControlledByReading && (
				<p className="border-l-2 border-primary pl-3 text-xs text-muted-foreground">
					Este progreso lo controla la integración con KOReader. Desvincula el
					documento para editarlo manualmente.
				</p>
			)}
			<div className="flex flex-col gap-3">
				<Label>
					Progreso
					{progressUnitLabel ? ` (${progressUnitLabel})` : ""}
				</Label>
				<ObraProgressSummary obra={obra} values={values} />
				<div className="flex items-center gap-3">
					<Button
						aria-label="Restar progreso"
						type="button"
						variant="outline"
						size="icon"
						disabled={progressControlledByReading || values.progressTotal <= 0}
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
						disabled={progressControlledByReading || values.progressTotal <= 0}
						value={[
							Math.min(values.progressCurrent, values.progressTotal || 0),
						]}
						onValueChange={(nextValue) => {
							const current = Array.isArray(nextValue)
								? nextValue[0]
								: nextValue;
							if (current !== undefined) {
								handleStepProgressChange(current, values.progressTotal);
							}
						}}
						className="flex-1"
					/>
					<Button
						aria-label="Sumar progreso"
						type="button"
						variant="outline"
						size="icon"
						disabled={progressControlledByReading || values.progressTotal <= 0}
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
				{(obra.type === "series" || obra.type === "anime") && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={progressControlledByReading}
						onClick={() => setIsSeasonEditorOpen(true)}
						className="w-full rounded-none border-border hover:border-primary hover:text-primary"
					>
						Editar por temporadas
					</Button>
				)}
				<div className="flex flex-col gap-2">
					<Label>
						Total
						{progressUnitLabel ? ` (${progressUnitLabel})` : ""}
					</Label>
					<Input
						type="number"
						min={0}
						step={1}
						disabled={progressControlledByReading}
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
				<SeasonProgressEditor
					open={isSeasonEditorOpen}
					onOpenChange={setIsSeasonEditorOpen}
					seasons={values.progressSeasons}
					current={values.progressCurrent}
					total={values.progressTotal}
					onChange={handleSeasonProgressChange}
					onFinishSeason={(next) => void handleFinishSeason(next)}
				/>
			</div>
		</section>
	);
}

export function ObraReadingSection({
	obra,
	values,
	updateValues,
	handleOpenReadingLink,
}: Pick<
	ObraEditSession,
	"obra" | "values" | "updateValues" | "handleOpenReadingLink"
>) {
	return (
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
			<div className="flex flex-col gap-2">
				<Label>Fuente</Label>
				<Input
					value={values.sourceUrl}
					onChange={(event) => {
						const nextValues = {
							...values,
							sourceUrl: event.target.value,
						};
						updateValues(
							nextValues,
							buildPersonalPatch(nextValues, obra),
							"sourceUrl",
						);
					}}
					placeholder="URL del proveedor o ficha externa"
					className="rounded-none border-border bg-background focus-visible:ring-primary"
				/>
			</div>
		</section>
	);
}

export function ObraPersonalSection({
	obra,
	values,
	updateValues,
	handleStatusChange,
}: Pick<
	ObraEditSession,
	"obra" | "values" | "updateValues" | "handleStatusChange"
>) {
	return (
		<section className="flex flex-col gap-4 border border-border bg-card p-5">
			<p className="text-sm font-medium">Estado y fechas</p>
			<div className="flex flex-col gap-2">
				<Label>Estado</Label>
				<Select
					value={obra.status}
					onValueChange={(value) =>
						void handleStatusChange(value as ObraStatus)
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
						<SelectItem value="paused">
							{getStatusLabel("paused", obra.type)}
						</SelectItem>
						<SelectItem value="hiatus">
							{getStatusLabel("hiatus", obra.type)}
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
					<Label>{obra.type === "movie" ? "Fecha" : "Fecha de inicio"}</Label>
					<Input
						type="date"
						value={obra.type === "movie" ? values.finishedAt : values.startedAt}
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
	);
}

export function ObraQuotesSection({
	obra,
	values,
	updateValues,
	quotes,
	handleAddQuote,
	handleRemoveQuote,
	handleQuoteChange,
}: Pick<
	ObraEditSession,
	| "obra"
	| "values"
	| "updateValues"
	| "quotes"
	| "handleAddQuote"
	| "handleRemoveQuote"
	| "handleQuoteChange"
>) {
	return (
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
	);
}

function ObraProgressSummary({
	obra,
	values,
}: Pick<ObraEditSession, "obra" | "values">) {
	const progressFormat = values.format || undefined;
	return (
		<div className="flex items-center justify-between">
			<span className="text-sm text-muted-foreground">
				{formatProgressValue(values.progressCurrent, {
					type: obra.type,
					format: progressFormat,
				})}{" "}
				/{" "}
				{values.progressTotal
					? formatProgressValue(values.progressTotal, {
							type: obra.type,
							format: progressFormat,
						})
					: "-"}
			</span>
			{isAudiobook({
				type: obra.type,
				format: progressFormat,
			}) && (
				<span className="text-sm text-muted-foreground">
					Restante:{" "}
					{formatProgressRemaining(
						values.progressCurrent,
						values.progressTotal,
						{ type: obra.type, format: progressFormat },
					)}
				</span>
			)}
			{(obra.type === "series" || obra.type === "anime") &&
				values.progressSeasons.length > 0 && (
					<span className="text-sm font-medium text-foreground">
						{formatSeasonProgress(
							values.progressSeasons,
							values.progressCurrent,
						)}
					</span>
				)}
		</div>
	);
}
