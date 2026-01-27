import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useState } from "react";
import { AddObraDialog } from "@/components/add-obra-dialog";
import { DashboardSection } from "@/components/dashboard-section";
import { StatusIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { obraFromDoc } from "@/lib/obras";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({
	ssr: false,
	component: DashboardPage,
});

function DashboardPage() {
	const { data: session, isPending } = authClient.useSession();
	if (isPending || session === undefined) {
		return (
			<div className="container mx-auto p-4 md:p-6">
				<p className="text-sm text-muted-foreground">Cargando...</p>
			</div>
		);
	}

	if (session === null) {
		return (
			<div className="container mx-auto p-4 md:p-6 space-y-4">
				<h1 className="text-2xl font-semibold tracking-tight font-serif">
					Biblioteca
				</h1>
				<p className="text-sm text-muted-foreground">
					Inicia sesión para ver tu biblioteca.
				</p>
				<Link to="/login" className="text-sm underline underline-offset-4">
					Ir a login
				</Link>
			</div>
		);
	}

	return <DashboardAuthed />;
}

function DashboardAuthed() {
	const docs = useQuery(api.obras.list, {});
	const obras = (docs ?? []).map(obraFromDoc);
	const [view, setView] = useState<"list" | "grid">("list");
	const isGridView = view === "grid";
	const now = Date.now();
	const formatRecentLabel = (timestamp: number) => {
		const diffMs = now - timestamp;
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		if (diffDays <= 0) return "Actualizado hoy";
		if (diffDays === 1) return "Actualizado ayer";
		if (diffDays < 7) return `Actualizado hace ${diffDays} dias`;
		return `Actualizado ${new Date(timestamp).toLocaleDateString()}`;
	};
	const recent = [...obras]
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.slice(0, 6);

	const inProgress = obras.filter((w) => w.status === "in-progress");
	const backlog = obras.filter((w) => w.status === "backlog");
	const finished = obras.filter((w) => w.status === "finished");

	const stats = [
		{
			label: "En progreso",
			value: inProgress.length,
			helper: "Obras activas ahora",
			icon: StatusIcons["in-progress"],
			accent:
				"border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
		},
		{
			label: "Pendientes",
			value: backlog.length,
			helper: "Ideas en espera",
			icon: StatusIcons.backlog,
			accent:
				"border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-300",
		},
		{
			label: "Terminadas",
			value: finished.length,
			helper: "Logros archivados",
			icon: StatusIcons.finished,
			accent:
				"border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
		},
	];

	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="container mx-auto space-y-8 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<div className="space-y-3 max-w-2xl">
						<p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
							Biblioteca privada
						</p>
						<h1 className="text-3xl font-semibold tracking-tight font-serif sm:text-4xl">
							Panel
						</h1>
						<p className="text-sm text-muted-foreground">
							Tu actividad reciente, lo que está en progreso y lo que ya
							terminaste.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<div className="inline-flex items-center overflow-hidden rounded-lg border border-border/60 bg-card/70 shadow-sm">
							<Button
								size="sm"
								variant="ghost"
								className={cn(
									"h-8 rounded-none border-r border-border/60 px-3 text-xs",
									view === "list"
										? "bg-foreground/10 text-foreground"
										: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
								)}
								onClick={() => setView("list")}
							>
								Lista
							</Button>
							<Button
								size="sm"
								variant="ghost"
								className={cn(
									"h-8 rounded-none px-3 text-xs",
									view === "grid"
										? "bg-foreground/10 text-foreground"
										: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
								)}
								onClick={() => setView("grid")}
							>
								Grid
							</Button>
						</div>
						<AddObraDialog />
					</div>
				</div>

				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{stats.map((stat) => {
						const Icon = stat.icon;
						return (
							<div
								key={stat.label}
								className="rounded-lg border border-border/60 bg-card/70 p-4 shadow-sm"
							>
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
											{stat.label}
										</p>
										<p className="text-2xl font-semibold text-foreground font-serif">
											{stat.value}
										</p>
									</div>
									<span
										className={cn(
											"flex h-10 w-10 items-center justify-center rounded-full border",
											stat.accent,
										)}
									>
										<Icon className="h-4 w-4" />
									</span>
								</div>
								<p className="text-xs text-muted-foreground">{stat.helper}</p>
							</div>
						);
					})}
				</div>

				<DashboardSection
					title="Recientes"
					obras={recent}
					variant={isGridView ? "grid" : "compact"}
					emptyMessage="Aún no hay actividad reciente."
					getSecondaryText={(obra) => formatRecentLabel(obra.updatedAt)}
				/>

				<DashboardSection
					title="En progreso"
					obras={inProgress}
					variant={isGridView ? "grid" : "default"}
					emptyMessage="Empieza algo nuevo agregando una obra."
				/>
				<DashboardSection
					title="Pendiente"
					obras={backlog}
					variant={isGridView ? "grid" : "compact"}
					emptyMessage="No tienes nada pendiente."
				/>
				<DashboardSection
					title="Terminadas"
					obras={finished}
					variant={isGridView ? "grid" : "compact"}
					emptyMessage="Aún no terminas nada."
				/>
			</div>
		</div>
	);
}
