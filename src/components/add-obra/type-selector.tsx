import { TypeIcons } from "@/components/icons";
import type { ObraType } from "@/lib/types";

const obraTypes: {
	value: ObraType;
	label: string;
	gradient: string;
	border: string;
}[] = [
	{
		value: "book",
		label: "Libro",
		gradient:
			"from-emerald-500/10 to-emerald-700/10 hover:from-emerald-500/20 hover:to-emerald-700/20",
		border: "hover:border-emerald-700/30",
	},
	{
		value: "movie",
		label: "Película",
		gradient:
			"from-slate-500/10 to-slate-700/10 hover:from-slate-500/20 hover:to-slate-700/20",
		border: "hover:border-slate-700/30",
	},
	{
		value: "series",
		label: "Serie",
		gradient:
			"from-amber-500/10 to-amber-700/10 hover:from-amber-500/20 hover:to-amber-700/20",
		border: "hover:border-amber-700/30",
	},
	{
		value: "anime",
		label: "Anime",
		gradient:
			"from-red-500/10 to-red-700/10 hover:from-red-500/20 hover:to-red-700/20",
		border: "hover:border-red-700/30",
	},
	{
		value: "manga",
		label: "Manga",
		gradient:
			"from-primary/10 to-primary/20 hover:from-primary/20 hover:to-primary/30",
		border: "hover:border-primary/30",
	},
	{
		value: "manhwa",
		label: "Manhwa",
		gradient:
			"from-sky-500/10 to-cyan-500/10 hover:from-sky-500/20 hover:to-cyan-500/20",
		border: "hover:border-sky-500/30",
	},
];

interface TypeSelectorProps {
	onSelect: (type: ObraType) => void;
}

export function TypeSelector({ onSelect }: TypeSelectorProps) {
	return (
		<div className="space-y-6 py-2">
			<div className="text-center space-y-1">
				<p className="text-sm text-muted-foreground">
					¿Qué tipo de obra quieres agregar?
				</p>
			</div>
			<div className="flex flex-wrap gap-3">
				{obraTypes.map((t) => {
					const Icon = TypeIcons[t.value];
					return (
						<button
							key={t.value}
							type="button"
							onClick={() => onSelect(t.value)}
							className={`group flex flex-1 min-w-[calc(50%-0.375rem)] sm:min-w-[calc(33.333%-0.5rem)] flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-gradient-to-br ${t.gradient} ${t.border} p-6 transition-all hover:shadow-md active:scale-[0.97]`}
						>
							<Icon className="h-8 w-8 text-foreground/70 transition-colors group-hover:text-foreground" />
							<span className="font-medium text-sm">{t.label}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
