import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccessiblePlatforms } from "@/lib/platforms";
import type { Obra } from "@/lib/types";

export function WatchAvailability({ obra }: { obra: Obra }) {
	const preferences = useQuery(api.platforms.getPreferences);
	if (obra.type !== "movie" && obra.type !== "series" && obra.type !== "anime")
		return null;
	const available = obra.metadata?.watchProviders;
	const matches = getAccessiblePlatforms(
		available,
		preferences?.providers ?? [],
	);

	return (
		<section className="space-y-3" aria-label="Dónde ver">
			<h2 className="text-sm font-medium">Dónde ver</h2>
			{preferences === undefined ? (
				<Skeleton className="h-8 w-48" />
			) : matches.length > 0 ? (
				<div className="flex flex-wrap gap-2">
					{matches.map((provider) => (
						<Badge key={provider} variant="secondary">
							{provider}
						</Badge>
					))}
				</div>
			) : (
				<>
					<p className="text-sm text-muted-foreground">
						{available === undefined
							? "Disponibilidad en Chile sin consultar."
							: "Sin coincidencias con tus plataformas en Chile."}
					</p>
					{preferences.stremioEnabled && (
						<a
							className={buttonVariants({ variant: "outline", size: "sm" })}
							href={`https://web.stremio.com/#/search?search=${encodeURIComponent(obra.title)}`}
							target="_blank"
							rel="noopener noreferrer"
						>
							Buscar en Stremio
						</a>
					)}
				</>
			)}
		</section>
	);
}
