import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { AddObraDialog } from "@/components/add-obra-dialog";
import { DashboardSection } from "@/components/dashboard-section";
import { StatusIcons } from "@/components/icons";
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
					Inicia sesion para ver tu biblioteca.
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
							Tu actividad reciente, lo que esta en progreso y lo que ya
							terminaste.
						</p>
					</div>
					<AddObraDialog />
				</div>

				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{stats.map((stat) => {
						const Icon = stat.icon;
						return (
							<div
								key={stat.label}
								className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm"
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
					title="En progreso"
					obras={inProgress}
					variant="default"
					emptyMessage="Empieza algo nuevo agregando una obra."
				/>
				<DashboardSection
					title="Pendiente"
					obras={backlog}
					variant="compact"
					emptyMessage="No tienes nada pendiente."
				/>
				<DashboardSection
					title="Terminadas"
					obras={finished}
					variant="compact"
					emptyMessage="Aun no terminas nada."
				/>
			</div>
		</div>
	);
}
