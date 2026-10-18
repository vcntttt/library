interface IdeasNoteListProps {
	ideas: ReadonlyArray<{ relativePath: string; title: string }> | undefined;
	selectedPath: string | null;
	disabled: boolean;
	onSelect: (relativePath: string) => void;
}

// Lista lateral de notas del vault; la selección se resuelve en el padre, que dispara la carga.
export function IdeasNoteList({
	ideas,
	selectedPath,
	disabled,
	onSelect,
}: IdeasNoteListProps) {
	return (
		<aside className="border border-border bg-card p-3">
			<p className="px-3 pb-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
				Notas ({ideas?.length ?? "…"})
			</p>
			<div className="space-y-1">
				{ideas?.map((idea) => (
					<button
						key={idea.relativePath}
						type="button"
						onClick={() => onSelect(idea.relativePath)}
						disabled={disabled}
						className={`w-full border-l-2 px-3 py-3 text-left text-sm transition-colors ${selectedPath === idea.relativePath ? "border-primary bg-muted" : "border-transparent hover:bg-muted/60"}`}
					>
						{idea.title}
					</button>
				))}
				{ideas?.length === 0 && (
					<p className="px-3 py-6 text-sm text-muted-foreground">
						Todavía no hay ideas.
					</p>
				)}
			</div>
		</aside>
	);
}
