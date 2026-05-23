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
		notes: "Capítulo 7: la descripción de las rosas.",
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
].map((obra) => ({ ...obra, quotes: [] }) as Obra);

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
	manhwa: "Manhwa",
};

/* ─── Route ─── */
export const Route = createFileRoute("/variant-c")({
	ssr: false,
	component: VariantC,
});

function VariantC() {
	const [view, setView] = useState<"dashboard" | "biblioteca" | "detalle">(
		"dashboard",
	);
	const [selectedObra, setSelectedObra] = useState<Obra | null>(null);
	const [search, setSearch] = useState("");

	const filtered = mockObras.filter((o) =>
		o.title.toLowerCase().includes(search.toLowerCase()),
	);

	return (
		<div
			className="min-h-screen bg-[#F0ECE2] text-[#2C3E2D] font-sans selection:bg-[#3A5A40] selection:text-[#F0ECE2]"
			style={{
				backgroundImage:
					"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E\")",
			}}
		>
			{/* Nav */}
			<header className="relative">
				<div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
					<div className="flex items-baseline gap-2">
						<h1 className="font-serif text-2xl font-medium tracking-tight text-[#2C3E2D]">
							Biblioteca
						</h1>
						<span className="text-[#BC6C25] text-lg">✦</span>
					</div>
					<nav className="flex gap-6">
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
								className={`text-sm transition-colors relative pb-1 ${
									view === key
										? "text-[#3A5A40] font-medium"
										: "text-[#8C8C7A] hover:text-[#2C3E2D]"
								}`}
							>
								{label}
								{view === key && (
									<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3A5A40] rounded-full" />
								)}
							</button>
						))}
					</nav>
				</div>
			</header>

			<main className="mx-auto max-w-6xl px-6 py-10">
				{view === "dashboard" && (
					<Dashboard
						obras={filtered}
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
	obras,
	onSelect,
}: {
	obras: Obra[];
	onSelect: (o: Obra) => void;
}) {
	const inProgress = obras.filter((o) => o.status === "in-progress");
	const backlog = obras.filter((o) => o.status === "backlog");
	const finished = obras.filter((o) => o.status === "finished");
	const recentNote = obras.find((o) => o.review);

	return (
		<div className="space-y-14 animate-in fade-in duration-700">
			{/* Welcome */}
			<section className="space-y-4">
				<h2 className="font-serif text-4xl md:text-5xl text-[#2C3E2D] leading-tight">
					Tu archivo personal de lecturas y visionados
				</h2>
				<p className="text-[#8C8C7A] max-w-xl leading-relaxed">
					Un jardín de papel donde cada obra es una semilla. Aquí no importa el
					número, sino lo que te dejó.
				</p>
			</section>

			{/* Stats cards */}
			<section className="grid gap-4 sm:grid-cols-3">
				<StatCard
					label="En progreso"
					value={inProgress.length}
					color="#3A5A40"
				/>
				<StatCard label="Pendientes" value={backlog.length} color="#BC6C25" />
				<StatCard label="Terminadas" value={finished.length} color="#4A4E69" />
			</section>

			{/* Recent note */}
			{recentNote && (
				<section className="space-y-4">
					<div className="flex items-center gap-2">
						<span className="text-[#BC6C25]">✦</span>
						<h3 className="font-serif text-xl">Última reflexión</h3>
					</div>
					<button
						type="button"
						onClick={() => onSelect(recentNote)}
						className="block w-full text-left bg-[#F5F2EB] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-[#E5E1D6]"
					>
						<p className="font-serif text-lg text-[#2C3E2D] leading-relaxed mb-3">
							“{recentNote.review}”
						</p>
						<div className="flex items-center gap-2 text-sm text-[#8C8C7A]">
							<span className="w-1.5 h-1.5 rounded-full bg-[#3A5A40]" />
							{recentNote.title}
							<span className="text-[#BC6C25]">—</span>
							{recentNote.creator}
						</div>
					</button>
				</section>
			)}

			{/* In progress */}
			<section className="space-y-4">
				<h3 className="font-serif text-xl flex items-center gap-2">
					<span className="text-[#3A5A40]">✦</span> En progreso
				</h3>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{inProgress.map((obra) => (
						<button
							type="button"
							key={obra.id}
							onClick={() => onSelect(obra)}
							className="text-left bg-[#F5F2EB] rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all border border-[#E5E1D6]"
						>
							<div className="flex gap-4">
								<div className="h-20 w-14 shrink-0 rounded-lg overflow-hidden bg-[#E5E1D6]">
									{obra.coverUrl ? (
										<img
											src={obra.coverUrl}
											alt={obra.title}
											className="h-full w-full object-cover"
										/>
									) : (
										<div className="h-full w-full flex items-center justify-center text-[10px] text-[#8C8C7A]">
											Sin portada
										</div>
									)}
								</div>
								<div className="flex-1 min-w-0 space-y-1">
									<p className="text-[0.6rem] uppercase tracking-widest text-[#3A5A40]">
										{typeLabel[obra.type]}
									</p>
									<h4 className="font-serif text-base truncate">
										{obra.title}
									</h4>
									{obra.progress && (
										<div className="pt-1">
											<div className="h-1.5 w-full bg-[#E5E1D6] rounded-full overflow-hidden">
												<div
													className="h-full bg-[#3A5A40] rounded-full"
													style={{
														width: `${Math.min(100, (obra.progress.current / Math.max(1, obra.progress.total)) * 100)}%`,
													}}
												/>
											</div>
											<p className="text-[10px] text-[#8C8C7A] mt-1">
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
		</div>
	);
}

function StatCard({
	label,
	value,
	color,
}: {
	label: string;
	value: number;
	color: string;
}) {
	return (
		<div
			className="rounded-2xl p-5 border border-[#E5E1D6] bg-[#F5F2EB] shadow-sm"
			style={{ borderTopWidth: 3, borderTopColor: color }}
		>
			<p className="text-[0.65rem] uppercase tracking-widest text-[#8C8C7A]">
				{label}
			</p>
			<p className="font-serif text-3xl mt-1" style={{ color }}>
				{value}
			</p>
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
		<div className="space-y-8 animate-in fade-in duration-700">
			<div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
				<div className="space-y-2">
					<h2 className="font-serif text-4xl text-[#2C3E2D]">Biblioteca</h2>
					<p className="text-sm text-[#8C8C7A]">
						{obras.length} obras en tu colección
					</p>
				</div>
				<div className="relative">
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Buscar..."
						className="bg-[#F5F2EB] border border-[#E5E1D6] rounded-xl pl-4 pr-4 py-2 text-sm placeholder:text-[#B5B1A4] focus:outline-none focus:border-[#3A5A40] transition-colors w-full md:w-64"
					/>
				</div>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{obras.map((obra) => (
					<button
						type="button"
						key={obra.id}
						onClick={() => onSelect(obra)}
						className="text-left bg-[#F5F2EB] rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all border border-[#E5E1D6] group"
					>
						<div className="aspect-[4/5] w-full bg-[#E5E1D6] overflow-hidden">
							{obra.coverUrl ? (
								<img
									src={obra.coverUrl}
									alt={obra.title}
									className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
								/>
							) : (
								<div className="h-full w-full flex items-center justify-center text-xs text-[#8C8C7A]">
									Sin portada
								</div>
							)}
						</div>
						<div className="p-4 space-y-1">
							<div className="flex items-center gap-2">
								<span className="text-[0.6rem] uppercase tracking-widest text-[#3A5A40]">
									{typeLabel[obra.type]}
								</span>
								<span className="w-1 h-1 rounded-full bg-[#BC6C25]" />
								<span className="text-[0.6rem] uppercase tracking-widest text-[#8C8C7A]">
									{statusLabel[obra.status]}
								</span>
							</div>
							<h4 className="font-serif text-lg truncate">{obra.title}</h4>
							{obra.creator && (
								<p className="text-xs text-[#8C8C7A]">{obra.creator}</p>
							)}
						</div>
					</button>
				))}
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
				className="text-sm text-[#8C8C7A] hover:text-[#3A5A40] transition-colors mb-6 flex items-center gap-1"
			>
				← Volver
			</button>

			<div className="bg-[#F5F2EB] rounded-3xl border border-[#E5E1D6] shadow-sm overflow-hidden">
				<div className="grid gap-8 lg:grid-cols-[300px_1fr] p-6 md:p-10">
					{/* Cover */}
					<div className="space-y-4">
						<div className="rounded-2xl overflow-hidden shadow-md aspect-[2/3] bg-[#E5E1D6]">
							{obra.coverUrl ? (
								<img
									src={obra.coverUrl}
									alt={obra.title}
									className="h-full w-full object-cover"
								/>
							) : (
								<div className="h-full w-full flex items-center justify-center text-sm text-[#8C8C7A]">
									Sin portada
								</div>
							)}
						</div>
						{obra.progress && (
							<div className="bg-white rounded-xl p-4 border border-[#E5E1D6]">
								<div className="flex justify-between text-xs text-[#8C8C7A] mb-2">
									<span>Progreso</span>
									<span>
										{obra.progress.current} / {obra.progress.total}
									</span>
								</div>
								<div className="h-2 w-full bg-[#E5E1D6] rounded-full overflow-hidden">
									<div
										className="h-full bg-[#3A5A40] rounded-full"
										style={{
											width: `${Math.min(100, (obra.progress.current / Math.max(1, obra.progress.total)) * 100)}%`,
										}}
									/>
								</div>
							</div>
						)}
					</div>

					{/* Info */}
					<div className="space-y-8">
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<span className="bg-[#3A5A40] text-[#F0ECE2] text-[0.6rem] uppercase tracking-widest px-2.5 py-1 rounded-full">
									{typeLabel[obra.type]}
								</span>
								<span className="bg-[#E5E1D6] text-[#8C8C7A] text-[0.6rem] uppercase tracking-widest px-2.5 py-1 rounded-full">
									{statusLabel[obra.status]}
								</span>
							</div>
							<h1 className="font-serif text-4xl md:text-5xl text-[#2C3E2D] leading-tight">
								{obra.title}
							</h1>
							{obra.creator && (
								<p className="text-lg text-[#8C8C7A]">{obra.creator}</p>
							)}
							{obra.year && (
								<p className="text-sm text-[#BC6C25]">{obra.year}</p>
							)}
						</div>

						{obra.review && (
							<div className="bg-white rounded-2xl p-6 border border-[#E5E1D6] shadow-sm">
								<div className="flex items-center gap-2 mb-3">
									<span className="text-[#BC6C25]">✦</span>
									<p className="text-[0.65rem] uppercase tracking-widest text-[#8C8C7A]">
										Reseña
									</p>
								</div>
								<p className="font-serif text-xl leading-relaxed text-[#2C3E2D]">
									“{obra.review}”
								</p>
							</div>
						)}

						<div>
							<p className="text-[0.65rem] uppercase tracking-widest text-[#8C8C7A] mb-3">
								Etiquetas
							</p>
							<div className="flex flex-wrap gap-2">
								{obra.tags.map((tag) => (
									<span
										key={tag}
										className="text-xs text-[#3A5A40] bg-[#E5E1D6] px-3 py-1 rounded-full"
									>
										{tag}
									</span>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
