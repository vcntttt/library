import { MoreHorizontal } from "lucide-react";
import type { GalleryEntry } from "@/components/reading/reading-gallery-model";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AnnotationCardProps {
	entry: GalleryEntry;
	obraTitles: ReadonlyMap<string, string>;
	isUpdating: boolean;
	onOpen: () => void;
	onReturnToInbox: () => void;
}

// Tarjeta de la galería. El cuerpo abre el detalle; el menú devuelve la anotación al inbox.
export function AnnotationCard({
	entry: { annotation, document },
	obraTitles,
	isUpdating,
	onOpen,
	onReturnToInbox,
}: AnnotationCardProps) {
	return (
		<article className="relative flex h-64 flex-col gap-3 overflow-hidden border border-border bg-card p-5 transition-colors hover:border-primary/60">
			<button
				type="button"
				className="flex min-h-0 flex-1 flex-col gap-5 pr-8 text-left"
				onClick={onOpen}
			>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
							{document?.title ?? "Documento sin título"}
						</p>
						{document?.obraId && (
							<p className="mt-1 text-xs text-muted-foreground">
								{obraTitles.get(document.obraId) ?? "Obra vinculada"}
							</p>
						)}
					</div>
					<div className="text-xs text-muted-foreground">
						{annotation.pageNumber ? `p. ${annotation.pageNumber}` : ""}
					</div>
				</div>
				<blockquote className="flex-1 overflow-hidden border-l-2 border-primary pl-4 font-serif text-base leading-relaxed">
					<span className="line-clamp-5">{annotation.text}</span>
				</blockquote>
				{annotation.note && (
					<p className="border-t border-border pt-3 text-sm text-muted-foreground">
						Nota: {annotation.note}
					</p>
				)}
				{annotation.comment && (
					<p className="border-t border-border pt-3 text-sm text-muted-foreground">
						Tu comentario: {annotation.comment}
					</p>
				)}
			</button>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="absolute top-3 right-3 rounded-none"
						/>
					}
				>
					<MoreHorizontal />
					<span className="sr-only">Acciones de la anotación</span>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem disabled={isUpdating} onClick={onReturnToInbox}>
						Devolver al inbox
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</article>
	);
}
