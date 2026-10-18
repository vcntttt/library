"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
	formatProgressRemaining,
	formatProgressValue,
	getProgressUnitLabel,
	isAudiobook,
} from "@/lib/progress";
import type { Obra } from "@/lib/types";

interface ObraStatusProgressProps {
	obra: Obra;
	current: number;
	total: number;
	error: string | null;
	onProgressChange: (current: number, total: number) => void;
	onOpenSeasonEditor: () => void;
}

// Bloque de progreso dentro del picker de estado; recibe los valores ya mostrados (incluido borrador).
export function ObraStatusProgress({
	obra,
	current,
	total,
	error,
	onProgressChange,
	onOpenSeasonEditor,
}: ObraStatusProgressProps) {
	const unitLabel = getProgressUnitLabel(obra);
	const hasSeasons =
		(obra.type === "series" || obra.type === "anime") &&
		(obra.progressSeasons?.length ?? 0) > 0;

	return (
		<div className="px-4 py-3 space-y-3">
			<p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
				Progreso
			</p>
			{unitLabel && (
				<p className="text-xs text-muted-foreground">
					{formatProgressValue(current, obra)} /{" "}
					{formatProgressValue(total, obra)} {unitLabel}
				</p>
			)}
			{isAudiobook(obra) && (
				<p className="text-xs text-muted-foreground">
					Restante: {formatProgressRemaining(current, total, obra)}
				</p>
			)}
			<div className="flex items-center gap-2">
				<Button
					variant="outline"
					size="icon"
					aria-label="Restar progreso"
					className="h-7 w-7 rounded-none"
					onClick={() => onProgressChange(current - 1, total)}
				>
					<Minus className="size-3" />
				</Button>
				<Input
					type="number"
					min={0}
					value={current}
					onChange={(e) => onProgressChange(Number(e.target.value), total)}
					className="h-7 w-16 rounded-none text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
				/>
				<span className="text-sm text-muted-foreground">/</span>
				<Input
					type="number"
					min={0}
					value={total}
					onChange={(e) => onProgressChange(current, Number(e.target.value))}
					className="h-7 w-16 rounded-none text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
				/>
				<Button
					variant="outline"
					size="icon"
					aria-label="Sumar progreso"
					className="h-7 w-7 rounded-none"
					onClick={() => onProgressChange(current + 1, total)}
				>
					<Plus className="size-3" />
				</Button>
			</div>
			{total > 0 && (
				<Slider
					min={0}
					max={total}
					step={1}
					value={[Math.min(current, total)]}
					onValueChange={(nextValue) => {
						const value = Array.isArray(nextValue) ? nextValue[0] : nextValue;
						if (value !== undefined) onProgressChange(value, total);
					}}
				/>
			)}
			{error && <p className="text-xs text-destructive">{error}</p>}
			{hasSeasons && (
				<Button
					type="button"
					variant="outline"
					className="w-full rounded-none"
					onClick={onOpenSeasonEditor}
				>
					Progreso por temporadas
				</Button>
			)}
		</div>
	);
}
