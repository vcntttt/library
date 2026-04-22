import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { Obra, ObraStatus, ObraType } from "@/lib/types";

/* ─── Mock data ─── */
const mockObras: Obra[] = [
	{
		id: "1",
		title: "La Casa de los Espíritus",
		type: "book",
		status: "finished",
		creator: "Isabel Allende",
		year: 1982,
		coverUrl: "https://placehold.co/400x600/B85C38/FFFFFF?text=Casa+Espíritus",
		tags: ["realismo mágico", "Chile", "familia"],
		review:
			"Una saga familiar que atraviesa la historia de Chile con el lenguaje más exuberante.",
		notes: 'Capítulo 7: la descripción de las rosas."',
		createdAt: Date.now() - 1_000_000_000,
		updatedAt: Date.now() - 500_000_000,
	},
	{
		id: "2",
		title: "Dune: Part Two",
		type: "movie",
		status: "finished",
		creator: "Denis Villeneuve",
		year: 2024,
		coverUrl: "https://placehold.co/400x600/1A1A1A/FFFFFF?text=Dune+II",
		tags: ["sci-fi", "épico"],
		review: "Visualmente abrumador. La banda sonora es un personaje más.",
		createdAt: Date.now() - 800_000_000,
		updatedAt: Date.now() - 200_000_000,
	},
	{
		id: "3",
		title: "Sousou no Frieren",
		type: "manga",
		status: "in-progress",
		creator: "Kanehito Yamada",
		year: 2020,
		coverUrl: "https://placehold.co/400x600/3A5A40/FFFFFF?text=Frieren",
		tags: ["fantasía", "melancolía"],
		progress: { current: 45, total: 120 },
		review:
			"Lento, deliberado, hermoso. Reflexión sobre el tiempo y la memoria.",
		createdAt: Date.now() - 600_000_000,
		updatedAt: Date.now() - 100_000_000,
	},
	{
		id: "4",
		title: "Shingeki no Kyojin",
		type: "anime",
		status: "finished",
		creator: "Hajime Isayama",
		year: 2013,
		coverUrl: "https://placehold.co/400x600/8C8279/FFFFFF?text=SNK",
		tags: ["acción", "drama"],
		review: "El final divide, pero el camino es inolvidable.",
		createdAt: Date.now() - 900_000_000,
		updatedAt: Date.now() - 300_000_000,
	},
	{
		id: "5",
		title: "The Bear",
		type: "series",
		status: "in-progress",
		creator: "Christopher Storer",
		year: 2022,
		coverUrl: "https://placehold.co/400x600/BC6C25/FFFFFF?text=The+Bear",
		tags: ["drama", "cocina"],
		progress: { current: 8, total: 18 },
		review:
			"Ansiedad televisiva de primer nivel. Episodio 7 es una obra maestra.",
		createdAt: Date.now() - 400_000_000,
		updatedAt: Date.now() - 50_000_000,
	},
	{
		id: "6",
		title: "Cien Años de Soledad",
		type: "book",
		status: "backlog",
		creator: "Gabriel García Márquez",
		year: 1967,
		coverUrl: "https://placehold.co/400x600/4A4E69/FFFFFF?text=100+Años",
		tags: ["realismo mágico", "clásico"],
		createdAt: Date.now() - 1_200_000_000,
		updatedAt: Date.now() - 700_000_000,
	},
	{
		id: "7",
		title: "Kagurabachi",
		type: "manga",
		status: "in-progress",
		creator: "Takeru Hokazono",
		year: 2023,
		coverUrl: "https://placehold.co/400x600/9A031E/FFFFFF?text=Kagurabachi",
		tags: ["acción", "katana"],
		progress: { current: 12, total: 0 },
		createdAt: Date.now() - 300_000_000,
		updatedAt: Date.now() - 20_000_000,
	},
	{
		id: "8",
		title: "Blade Runner 2049",
		type: "movie",
		status: "backlog",
		creator: "Denis Villeneuve",
		year: 2017,
		coverUrl: "https://placehold.co/400x600/1B263B/FFFFFF?text=BR+2049",
		tags: ["sci-fi", "noir"],
		createdAt: Date.now() - 1_100_000_000,
		updatedAt: Date.now() - 600_000_000,
	},
];

const statusLabel: Record<ObraStatus, string> = {
	backlog: "Pendiente",
	"in-progress": "En progreso",
	finished: "Terminada",
	dropped: "Abandonada",
};

const typeLabel: Record<ObraType, string> = {
	book: "Libro",
	movie: "Película",
	series: "Serie",
	anime: "Anime",
	manga: "Manga",
};

/* ─── Route ─── */
export const Route = createFileRoute("/variant-a")({
	ssr: false,
	component: VariantA,
});

function VariantA() {
	const [view, setView] = useState<"dashboard" | "biblioteca" | "detalle">(
		"dashboard",
	);
	const [selectedObra, setSelectedObra] = useState<Obra | null>(null);
	const [search, setSearch] = useState("");

	const filtered = mockObras.filter((o) =>
		o.title.toLowerCase().includes(search.toLowerCase()),
	);

	const inProgress = filtered.filter((o) => o.status === "in-progress");
	const backlog = filtered.filter((o) => o.status === "backlog");
	const finished = filtered.filter((o) => o.status === "finished");

	return (
		<div className="min-h-screen bg-[#F5F2EB] text-[#1A1A1A] font-sans selection:bg-[#B85C38] selection:text-white">
			{/* Navegación */}
			<header className="border-b border-[#D6D0C7]">
				<div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
					<div className="flex items-baseline gap-3">
						<h1 className="font-serif text-2xl font-semibold tracking-tight">
							Biblioteca
						</h1>
						<span className="text-[0.65rem] uppercase tracking-[0.3em] text-[#8C8279]">
							Archivo personal
						</span>
					</div>
					<nav className="flex gap-8">
						{(
							[
								["dashboard", "Panel"],
								["biblioteca", "Biblioteca"],
								["detalle", "Detalle"],
							] as const
						).map(([key, label]) => (
							<button
								type="button"
								key={key}
								onClick={() => {
									setView(key);
									if (key !== "detalle") setSelectedObra(null);
								}}
								className={`text-sm tracking-wide transition-colors pb-1 border-b-2 ${
									view === key
										? "border-[#B85C38] text-[#1A1A1A]"
										: "border-transparent text-[#8C8279] hover:text-[#1A1A1A]"
								}`}
							>
								{label}
							</button>
						))}
					</nav>
				</div>
			</header>

			<main className="mx-auto max-w-6xl px-6 py-10">
				{view === "dashboard" && (
					<Dashboard
						inProgress={inProgress}
						backlog={backlog}
						finished={finished}
						onSelect={(o) => {
							setSelectedObra(o);
							setView("detalle");
						}}
					/>
				)}
				{view === "biblioteca" && (
					<Biblioteca
						obras={filtered}
						search={search}
						setSearch={setSearch}
						onSelect={(o) => {
							setSelectedObra(o);
							setView("detalle");
						}}
					/>
				)}
				{view === "detalle" && (
					<Detalle
						obra={selectedObra ?? mockObras[2]}
						onBack={() => setView("biblioteca")}
					/>
				)}
			</main>
		</div>
	);
}

/* ─── Dashboard ─── */
function Dashboard({
	inProgress,
	backlog,
	finished,
	onSelect,
}: {
	inProgress: Obra[];
	backlog: Obra[];
	finished: Obra[];
	onSelect: (o: Obra) => void;
}) {
	return (
		<div className="space-y-16 animate-in fade-in duration-700">
			{/* Hero */}
			<section className="space-y-6">
				<div className="flex items-end justify-between border-b border-[#D6D0C7] pb-4">
					<div className="space-y-2">
						<p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#8C8279]">
							Estado actual
						</p>
						<h2 className="font-serif text-5xl font-medium tracking-tight text-[#1A1A1A]">
							{inProgress.length} obras en progreso
						</h2>
					</div>
					<p className="text-sm text-[#8C8279] max-w-xs text-right leading-relaxed">
						Reflexión sobre métricas. Las notas importan más que los números.
					</p>
				</div>
				<div className="grid grid-cols-3 gap-8">
					<div className="border-l border-[#D6D0C7] pl-6">
						<p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#8C8279]">
							Pendientes
						</p>
						<p className="font-serif text-3xl mt-1">{backlog.length}</p>
					</div>
					<div className="border-l border-[#D6D0C7] pl-6">
						<p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#8C8279]">
							Terminadas
						</p>
						<p className="font-serif text-3xl mt-1">{finished.length}</p>
					</div>
					<div className="border-l border-[#D6D0C7] pl-6">
						<p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#8C8279]">
							Total
						</p>
						<p className="font-serif text-3xl mt-1">{mockObras.length}</p>
					</div>
				</div>
			</section>

			{/* En progreso */}
			<section className="space-y-6">
				<div className="flex items-baseline justify-between">
					<h3 className="font-serif text-2xl">En progreso</h3>
					<span className="text-[0.65rem] uppercase tracking-[0.3em] text-[#8C8279]">
						{inProgress.length} obras
					</span>
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{inProgress.map((obra) => (
						<button
							type="button"
							key={obra.id}
							onClick={() => onSelect(obra)}
							className="group text-left bg-white border border-[#D6D0C7] p-4 transition-all hover:border-[#B85C38] hover:shadow-sm"
						>
							<div className="flex gap-4">
								<div className="h-24 w-16 shrink-0 overflow-hidden bg-[#F5F2EB]">
									{obra.coverUrl ? (
										<img
											src={obra.coverUrl}
											alt={obra.title}
											className="h-full w-full object-cover"
										/>
									) : (
										<div className="h-full w-full flex items-center justify-center text-xs text-[#8C8279]">
											Sin portada
										</div>
									)}
								</div>
								<div className="flex-1 min-w-0 space-y-1">
									<p className="text-[0.6rem] uppercase tracking-[0.25em] text-[#B85C38]">
										{typeLabel[obra.type]}
									</p>
									<h4 className="font-serif text-lg leading-tight group-hover:text-[#B85C38] transition-colors">
										{obra.title}
									</h4>
									{obra.creator && (
										<p className="text-xs text-[#8C8279]">{obra.creator}</p>
									)}
									{obra.progress && (
										<div className="pt-2">
											<div className="h-px w-full bg-[#D6D0C7]">
												<div
													className="h-full bg-[#B85C38]"
													style={{
														width: `${Math.min(100, (obra.progress.current / Math.max(1, obra.progress.total)) * 100)}%`,
													}}
												/>
											</div>
											<p className="text-[0.6rem] text-[#8C8279] mt-1">
												{obra.progress.current} / {obra.progress.total}
											</p>
										</div>
									)}
								</div>
							</div>
						</button>
					))}
				</div>
			</section>

			{/* Pendientes compacto */}
			<section className="space-y-6">
				<div className="flex items-baseline justify-between">
					<h3 className="font-serif text-2xl">Pendientes</h3>
					<span className="text-[0.65rem] uppercase tracking-[0.3em] text-[#8C8279]">
						{backlog.length} obras
					</span>
				</div>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{backlog.map((obra) => (
						<button
							type="button"
							key={obra.id}
							onClick={() => onSelect(obra)}
							className="group text-left border-b border-[#D6D0C7] pb-3 hover:border-[#B85C38] transition-colors"
						>
							<p className="text-[0.6rem] uppercase tracking-[0.25em] text-[#8C8279]">
								{typeLabel[obra.type]}
							</p>
							<h4 className="font-serif text-base group-hover:text-[#B85C38] transition-colors">
								{obra.title}
							</h4>
						</button>
					))}
				</div>
			</section>
		</div>
	);
}

/* ─── Biblioteca ─── */
function Biblioteca({
	obras,
	search,
	setSearch,
	onSelect,
}: {
	obras: Obra[];
	search: string;
	setSearch: (s: string) => void;
	onSelect: (o: Obra) => void;
}) {
	return (
		<div className="space-y-10 animate-in fade-in duration-700">
			<div className="flex items-end justify-between border-b border-[#D6D0C7] pb-4 gap-4">
				<div className="space-y-2">
					<p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#8C8279]">
						Colección completa
					</p>
					<h2 className="font-serif text-4xl">Biblioteca</h2>
				</div>
				<input
					type="text"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Buscar por título, autor..."
					className="bg-transparent border-b border-[#D6D0C7] pb-2 text-sm placeholder:text-[#8C8279] focus:outline-none focus:border-[#B85C38] transition-colors w-full max-w-xs"
				/>
			</div>

			<div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-fr">
				{obras.map((obra, i) => {
					const isLarge = i % 5 === 0;
					return (
						<button
							type="button"
							key={obra.id}
							onClick={() => onSelect(obra)}
							className={`group text-left bg-white border border-[#D6D0C7] p-3 transition-all hover:border-[#B85C38] hover:shadow-sm ${
								isLarge ? "col-span-2 row-span-2" : ""
							}`}
						>
							<div
								className={`w-full overflow-hidden bg-[#F5F2EB] mb-3 ${
									isLarge ? "aspect-[3/4]" : "aspect-[4/5]"
								}`}
							>
								{obra.coverUrl ? (
									<img
										src={obra.coverUrl}
										alt={obra.title}
										className="h-full w-full object-cover"
									/>
								) : (
									<div className="h-full w-full flex items-center justify-center text-xs text-[#8C8279]">
										Sin portada
									</div>
								)}
							</div>
							<p className="text-[0.6rem] uppercase tracking-[0.25em] text-[#B85C38]">
								{typeLabel[obra.type]} — {statusLabel[obra.status]}
							</p>
							<h4
								className={`font-serif leading-tight group-hover:text-[#B85C38] transition-colors ${
									isLarge ? "text-2xl" : "text-base"
								}`}
							>
								{obra.title}
							</h4>
							{obra.creator && (
								<p className="text-xs text-[#8C8279] mt-1">{obra.creator}</p>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}

/* ─── Detalle ─── */
function Detalle({ obra, onBack }: { obra: Obra; onBack: () => void }) {
	return (
		<div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
			<button
				type="button"
				onClick={onBack}
				className="text-sm text-[#8C8279] hover:text-[#B85C38] transition-colors mb-8 tracking-wide"
			>
				← Volver a la biblioteca
			</button>

			<div className="grid gap-10 lg:grid-cols-[320px_1fr]">
				{/* Portada */}
				<div className="space-y-4">
					<div className="aspect-[2/3] w-full bg-[#F5F2EB] border border-[#D6D0C7] overflow-hidden">
						{obra.coverUrl ? (
							<img
								src={obra.coverUrl}
								alt={obra.title}
								className="h-full w-full object-cover"
							/>
						) : (
							<div className="h-full w-full flex items-center justify-center text-sm text-[#8C8279]">
								Sin portada
							</div>
						)}
					</div>
					{obra.progress && (
						<div>
							<div className="flex justify-between text-[0.65rem] uppercase tracking-[0.2em] text-[#8C8279] mb-2">
								<span>Progreso</span>
								<span>
									{obra.progress.current} / {obra.progress.total}
								</span>
							</div>
							<div className="h-1 w-full bg-[#D6D0C7]">
								<div
									className="h-full bg-[#B85C38]"
									style={{
										width: `${Math.min(100, (obra.progress.current / Math.max(1, obra.progress.total)) * 100)}%`,
									}}
								/>
							</div>
						</div>
					)}
				</div>

				{/* Info */}
				<div className="space-y-10">
					<div className="space-y-4">
						<div className="flex flex-wrap gap-3">
							<span className="text-[0.6rem] uppercase tracking-[0.25em] text-[#B85C38] border border-[#B85C38] px-2 py-1">
								{typeLabel[obra.type]}
							</span>
							<span className="text-[0.6rem] uppercase tracking-[0.25em] text-[#8C8279] border border-[#D6D0C7] px-2 py-1">
								{statusLabel[obra.status]}
							</span>
						</div>
						<h1 className="font-serif text-5xl leading-[1.1]">{obra.title}</h1>
						{obra.creator && (
							<p className="text-lg text-[#8C8279]">{obra.creator}</p>
						)}
						{obra.year && <p className="text-sm text-[#8C8279]">{obra.year}</p>}
					</div>

					{obra.review && (
						<div className="border-l-2 border-[#B85C38] pl-6 py-1">
							<p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#8C8279] mb-2">
								Reseña
							</p>
							<p className="font-serif text-xl leading-relaxed text-[#1A1A1A]">
								“{obra.review}”
							</p>
						</div>
					)}

					{obra.notes && (
						<div className="bg-white border border-[#D6D0C7] p-6">
							<p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#8C8279] mb-3">
								Notas
							</p>
							<p className="text-sm leading-relaxed text-[#4A4A4A]">
								{obra.notes}
							</p>
						</div>
					)}

					<div className="space-y-2">
						<p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#8C8279]">
							Etiquetas
						</p>
						<div className="flex flex-wrap gap-2">
							{obra.tags.map((tag) => (
								<span
									key={tag}
									className="text-xs text-[#8C8279] border-b border-[#D6D0C7] pb-0.5"
								>
									{tag}
								</span>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
