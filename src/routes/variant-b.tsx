import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { Obra, ObraStatus, ObraType } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";

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
];

const statusLabel: Record<ObraStatus, string> = {
	backlog: "PENDIENTE",
	"in-progress": "EN_PROGRESO",
	finished: "TERMINADA",
	dropped: "ABANDONADA",
};

const typeLabel: Record<ObraType, string> = {
	book: "LIBRO",
	movie: "PELICULA",
	series: "SERIE",
	anime: "ANIME",
	manga: "MANGA",
};

/* ─── Route ─── */
export const Route = createFileRoute("/variant-b")({
	ssr: false,
	component: VariantB,
});

function VariantB() {
	const [view, setView] = useState<"dashboard" | "biblioteca" | "detalle">(
		"dashboard",
	);
	const [selectedObra, setSelectedObra] = useState<Obra | null>(null);
	const [search, setSearch] = useState("");

	const filtered = mockObras.filter((o) =>
		o.title.toLowerCase().includes(search.toLowerCase()),
	);

	return (
		<div className="min-h-screen bg-[#0D0D0D] text-[#E8E8E8] font-mono selection:bg-[#FF6B00] selection:text-black">
			{/* Header */}
			<header className="border-b border-[#333]">
				<div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="text-[#FF6B00]">■</span>
						<span className="text-sm tracking-wider">LIBRARY_SYS</span>
						<span className="text-[#555] text-xs">v2.0.1</span>
					</div>
					<nav className="flex gap-1">
						{(
							[
								["dashboard", "DASHBOARD"],
								["biblioteca", "BIBLIOTECA"],
								["detalle", "DETALLE"],
							] as const
						).map(([key, label]) => (
							<button
								type="button"
								key={key}
								onClick={() => {
									setView(key);
									if (key !== "detalle") setSelectedObra(null);
								}}
								className={`px-3 py-1 text-xs tracking-widest border transition-colors ${
									view === key
										? "bg-[#FF6B00] text-black border-[#FF6B00]"
										: "border-[#333] text-[#888] hover:border-[#555] hover:text-[#E8E8E8]"
								}`}
							>
								{label}
							</button>
						))}
					</nav>
				</div>
			</header>

			<main className="mx-auto max-w-7xl px-4 py-6">
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

			{/* Footer status bar */}
			<footer className="fixed bottom-0 left-0 right-0 border-t border-[#333] bg-[#0D0D0D] px-4 py-1.5 flex items-center justify-between text-[10px] text-[#555]">
				<span>SYS: OK</span>
				<span>DB: CONNECTED</span>
				<span>{formatDateShort(Date.now())}</span>
			</footer>
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

	return (
		<div className="space-y-6 animate-in fade-in duration-300">
			{/* Stats grid */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				<StatBlock
					label="EN_PROGRESO"
					value={inProgress.length}
					accent="#FF6B00"
				/>
				<StatBlock label="PENDIENTES" value={backlog.length} accent="#00E5FF" />
				<StatBlock
					label="TERMINADAS"
					value={finished.length}
					accent="#4ADE80"
				/>
				<StatBlock label="TOTAL" value={obras.length} accent="#A78BFA" />
			</div>

			{/* Recent activity */}
			<div className="border border-[#333]">
				<div className="bg-[#1A1A1A] px-3 py-2 border-b border-[#333] flex items-center justify-between">
					<span className="text-xs tracking-widest text-[#888]">
						ACTIVIDAD_RECIENTE
					</span>
					<span className="text-[10px] text-[#555]">
						{obras.length} REGISTROS
					</span>
				</div>
				<div className="divide-y divide-[#222]">
					{obras.slice(0, 5).map((obra) => (
						<button
							type="button"
							key={obra.id}
							onClick={() => onSelect(obra)}
							className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-[#1A1A1A] transition-colors group"
						>
							<span
								className="w-2 h-2 shrink-0"
								style={{
									backgroundColor:
										obra.status === "in-progress"
											? "#FF6B00"
											: obra.status === "finished"
												? "#4ADE80"
												: "#00E5FF",
								}}
							/>
							<span className="text-xs text-[#555] w-20 shrink-0">
								{typeLabel[obra.type]}
							</span>
							<span className="text-sm text-[#E8E8E8] group-hover:text-[#FF6B00] transition-colors flex-1 truncate">
								{obra.title}
							</span>
							<span className="text-[10px] text-[#555]">
								{statusLabel[obra.status]}
							</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

function StatBlock({
	label,
	value,
	accent,
}: {
	label: string;
	value: number;
	accent: string;
}) {
	return (
		<div className="border border-[#333] bg-[#111] p-3">
			<p className="text-[10px] tracking-widest text-[#555] mb-1">{label}</p>
			<p className="text-3xl font-mono" style={{ color: accent }}>
				{value.toString().padStart(2, "0")}
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
	const [filterStatus, setFilterStatus] = useState<ObraStatus | "ALL">("ALL");
	const [filterType, setFilterType] = useState<ObraType | "ALL">("ALL");

	const rows = obras.filter((o) => {
		if (filterStatus !== "ALL" && o.status !== filterStatus) return false;
		if (filterType !== "ALL" && o.type !== filterType) return false;
		return true;
	});

	return (
		<div className="space-y-4 animate-in fade-in duration-300">
			{/* Toolbar */}
			<div className="border border-[#333] bg-[#111] p-3 flex flex-col md:flex-row gap-3">
				<input
					type="text"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="> BUSCAR..."
					className="bg-transparent border border-[#333] px-3 py-1.5 text-xs text-[#E8E8E8] placeholder:text-[#444] focus:border-[#FF6B00] focus:outline-none w-full md:w-64"
				/>
				<div className="flex gap-2">
					<select
						value={filterStatus}
						onChange={(e) =>
							setFilterStatus(e.target.value as ObraStatus | "ALL")
						}
						className="bg-[#0D0D0D] border border-[#333] text-xs text-[#888] px-2 py-1.5 focus:border-[#FF6B00] focus:outline-none"
					>
						<option value="ALL">ESTADO:_ALL</option>
						<option value="backlog">PENDIENTE</option>
						<option value="in-progress">EN_PROGRESO</option>
						<option value="finished">TERMINADA</option>
						<option value="dropped">ABANDONADA</option>
					</select>
					<select
						value={filterType}
						onChange={(e) => setFilterType(e.target.value as ObraType | "ALL")}
						className="bg-[#0D0D0D] border border-[#333] text-xs text-[#888] px-2 py-1.5 focus:border-[#FF6B00] focus:outline-none"
					>
						<option value="ALL">TIPO:_ALL</option>
						<option value="book">LIBRO</option>
						<option value="movie">PELICULA</option>
						<option value="series">SERIE</option>
						<option value="anime">ANIME</option>
						<option value="manga">MANGA</option>
					</select>
				</div>
			</div>

			{/* Table */}
			<div className="border border-[#333]">
				<div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 bg-[#1A1A1A] px-3 py-2 border-b border-[#333] text-[10px] tracking-widest text-[#555]">
					<span>TITULO</span>
					<span>TIPO</span>
					<span>ESTADO</span>
					<span>PROGRESO</span>
					<span className="text-right">ACCION</span>
				</div>
				<div className="divide-y divide-[#222]">
					{rows.map((obra) => (
						<div
							key={obra.id}
							className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 px-3 py-2 items-center hover:bg-[#1A1A1A] transition-colors group"
						>
							<button
								type="button"
								onClick={() => onSelect(obra)}
								className="text-left text-sm text-[#E8E8E8] group-hover:text-[#FF6B00] transition-colors truncate"
							>
								{obra.title}
							</button>
							<span className="text-xs text-[#888]">
								{typeLabel[obra.type]}
							</span>
							<span
								className="text-[10px] tracking-wider"
								style={{
									color:
										obra.status === "in-progress"
											? "#FF6B00"
											: obra.status === "finished"
												? "#4ADE80"
												: obra.status === "dropped"
													? "#EF4444"
													: "#00E5FF",
								}}
							>
								{statusLabel[obra.status]}
							</span>
							<span className="text-xs text-[#555]">
								{obra.progress
									? `${obra.progress.current}/${obra.progress.total}`
									: "—"}
							</span>
							<button
								type="button"
								onClick={() => onSelect(obra)}
								className="text-right text-[10px] text-[#555] hover:text-[#FF6B00] transition-colors"
							>
								[VER]
							</button>
						</div>
					))}
					{rows.length === 0 && (
						<div className="px-3 py-6 text-center text-xs text-[#555]">
							NO_HAY_REGISTROS
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

/* ─── Detalle ─── */
function Detalle({ obra, onBack }: { obra: Obra; onBack: () => void }) {
	return (
		<div className="animate-in fade-in duration-300">
			<button
				type="button"
				onClick={onBack}
				className="text-xs text-[#555] hover:text-[#FF6B00] transition-colors mb-4 tracking-widest"
			>
				&lt; VOLVER
			</button>

			<div className="border border-[#333]">
				{/* Header */}
				<div className="bg-[#1A1A1A] px-4 py-3 border-b border-[#333] flex items-center justify-between">
					<span className="text-xs tracking-widest text-[#888]">
						REGISTRO_DETALLE
					</span>
					<span className="text-[10px] text-[#555]">ID: {obra.id}</span>
				</div>

				<div className="p-4 grid gap-6 lg:grid-cols-[200px_1fr]">
					{/* Cover */}
					<div className="border border-[#333] bg-[#111] aspect-[2/3] overflow-hidden">
						{obra.coverUrl ? (
							<img
								src={obra.coverUrl}
								alt={obra.title}
								className="h-full w-full object-cover opacity-80"
							/>
						) : (
							<div className="h-full w-full flex items-center justify-center text-xs text-[#444]">
								NO_IMG
							</div>
						)}
					</div>

					{/* Data */}
					<div className="space-y-6">
						<div className="space-y-2">
							<div className="flex gap-2">
								<span className="text-[10px] border border-[#333] px-1.5 py-0.5 text-[#FF6B00]">
									{typeLabel[obra.type]}
								</span>
								<span
									className="text-[10px] border px-1.5 py-0.5"
									style={{
										borderColor:
											obra.status === "in-progress"
												? "#FF6B00"
												: obra.status === "finished"
													? "#4ADE80"
													: "#00E5FF",
										color:
											obra.status === "in-progress"
												? "#FF6B00"
												: obra.status === "finished"
													? "#4ADE80"
													: "#00E5FF",
									}}
								>
									{statusLabel[obra.status]}
								</span>
							</div>
							<h1 className="text-2xl text-[#E8E8E8] tracking-tight">
								{obra.title}
							</h1>
							{obra.creator && (
								<p className="text-xs text-[#888]">AUTOR: {obra.creator}</p>
							)}
							{obra.year && (
								<p className="text-xs text-[#555]">AÑO: {obra.year}</p>
							)}
						</div>

						{/* Progress */}
						{obra.progress && (
							<div className="border border-[#333] p-3 space-y-2">
								<div className="flex justify-between text-[10px] text-[#555] tracking-widest">
									<span>PROGRESO</span>
									<span>
										{obra.progress.current}/{obra.progress.total}
									</span>
								</div>
								<div className="h-3 bg-[#222] border border-[#333]">
									<div
										className="h-full bg-[#FF6B00]"
										style={{
											width: `${Math.min(100, (obra.progress.current / Math.max(1, obra.progress.total)) * 100)}%`,
										}}
									/>
								</div>
							</div>
						)}

						{/* Review */}
						{obra.review && (
							<div className="border border-[#333] p-3">
								<p className="text-[10px] tracking-widest text-[#555] mb-2">
									RESEÑA
								</p>
								<p className="text-sm text-[#CCC] leading-relaxed">
									{obra.review}
								</p>
							</div>
						)}

						{/* Notes */}
						{obra.notes && (
							<div className="border border-[#333] p-3">
								<p className="text-[10px] tracking-widest text-[#555] mb-2">
									NOTAS
								</p>
								<p className="text-sm text-[#888] leading-relaxed whitespace-pre-wrap">
									{obra.notes}
								</p>
							</div>
						)}

						{/* Tags */}
						<div className="flex flex-wrap gap-2">
							{obra.tags.map((tag) => (
								<span
									key={tag}
									className="text-[10px] text-[#555] border border-[#333] px-1.5 py-0.5"
								>
									{tag.toUpperCase()}
								</span>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
