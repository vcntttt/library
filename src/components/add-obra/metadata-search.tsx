import { ArrowLeft, Loader2, Search } from "lucide-react";
import { TypeIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MetadataSearchResult } from "@/lib/metadata/types";
import type { ObraType } from "@/lib/types";

const obraTypeLabels: Record<ObraType, string> = {
	book: "Libro",
	movie: "Película",
	series: "Serie",
	anime: "Anime",
	manga: "Manga",
	manhwa: "Manhwa",
};

interface MetadataSearchProps {
	type: ObraType;
	query: string;
	onQueryChange: (q: string) => void;
	results: MetadataSearchResult[];
	isSearching: boolean;
	error: string | null;
	onSelectResult: (result: MetadataSearchResult) => void;
	onSkip: () => void;
	onBack: () => void;
	sourceLabel: string;
}

export function MetadataSearch({
	type,
	query,
	onQueryChange,
	results,
	isSearching,
	error,
	onSelectResult,
	onSkip,
	onBack,
	sourceLabel,
}: MetadataSearchProps) {
	const Icon = TypeIcons[type];

	return (
		<div className="space-y-4 py-2">
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onBack}
					className="shrink-0"
				>
					<ArrowLeft className="h-4 w-4" />
					<span className="sr-only">Atrás</span>
				</Button>
				<div className="flex items-center gap-2">
					<Icon className="h-5 w-5 text-muted-foreground" />
					<h2 className="text-base font-semibold">
						Buscar {obraTypeLabels[type]}
					</h2>
				</div>
			</div>

			<div className="relative">
				<Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={query}
					onChange={(e) => onQueryChange(e.target.value)}
					placeholder={`Buscar en ${sourceLabel}...`}
					className="h-12 pl-10 text-base"
					autoFocus
				/>
				{isSearching && (
					<Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
				)}
			</div>

			{!isSearching && query.trim().length > 0 && query.trim().length < 3 && (
				<p className="text-sm text-muted-foreground">
					Escribe al menos 3 caracteres para buscar.
				</p>
			)}

			{error && <p className="text-sm text-destructive">{error}</p>}

			{results.length > 0 && (
				<div className="space-y-2 max-h-64 overflow-y-auto pr-1">
					{results.map((result) => (
						<button
							type="button"
							key={`${result.source}-${result.id}`}
							className="w-full text-left rounded-xl border border-border/60 bg-muted/40 px-3 py-3 transition hover:bg-muted/60 flex items-center gap-3 group"
							onClick={() => onSelectResult(result)}
						>
							{result.coverUrl ? (
								<img
									src={result.coverUrl}
									alt={`Portada de ${result.title}`}
									className="h-16 w-11 rounded-md object-cover flex-shrink-0"
									loading="lazy"
								/>
							) : (
								<div className="h-16 w-11 rounded-md bg-border/40 flex-shrink-0" />
							)}
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
									{result.title}
								</p>
								{(result.creator || result.year) && (
									<p className="text-xs text-muted-foreground truncate">
										{[result.creator, result.year].filter(Boolean).join(" • ")}
									</p>
								)}
								<p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
									{result.source}
								</p>
							</div>
						</button>
					))}
				</div>
			)}

			{!isSearching &&
				query.trim().length >= 3 &&
				results.length === 0 &&
				!error && (
					<div className="text-center py-6 space-y-3">
						<p className="text-sm text-muted-foreground">
							No se encontraron resultados.
						</p>
						<Button type="button" variant="outline" size="sm" onClick={onSkip}>
							Crear manualmente
						</Button>
					</div>
				)}

			{!isSearching &&
				!error &&
				(query.trim().length < 3 || results.length === 0) && (
					<div className="flex justify-center pt-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={onSkip}
							className="text-muted-foreground"
						>
							Saltar búsqueda y crear manualmente
						</Button>
					</div>
				)}
		</div>
	);
}
