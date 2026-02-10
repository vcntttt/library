import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { LayoutGrid, List } from "lucide-react";
import { useState } from "react";
import { AddObraDialog } from "@/components/add-obra-dialog";
import { DashboardSection } from "@/components/dashboard-section";
import { StatusIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
		return <DashboardPageSkeleton />;
	}

	if (session === null) {
		return (
			<div className="container mx-auto p-4 md:p-6">
				<div className="max-w-lg rounded-xl border border-border/60 bg-card/70 p-5 shadow-sm space-y-3">
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
			</div>
		);
	}

	return <DashboardAuthed />;
}

function DashboardPageSkeleton() {
	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="container mx-auto space-y-8 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<div className="space-y-3 max-w-2xl">
						<Skeleton className="h-3 w-32" />
						<Skeleton className="h-10 w-52 sm:w-64" />
						<Skeleton className="h-4 w-80 max-w-full" />
					</div>
					<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
						<Skeleton className="h-8 w-28 rounded-md" />
						<Skeleton className="h-10 w-36 rounded-md" />
					</div>
				</div>

				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{["s1", "s2", "s3"].map((key) => (
						<div
							key={key}
							className="rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm space-y-3"
						>
							<div className="flex items-start justify-between">
								<div className="space-y-2">
									<Skeleton className="h-3 w-24" />
									<Skeleton className="h-8 w-10" />
								</div>
								<Skeleton className="h-10 w-10 rounded-full" />
							</div>
							<Skeleton className="h-3 w-36" />
						</div>
					))}
				</div>

				<div className="space-y-3">
					<Skeleton className="h-5 w-24" />
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{["c1", "c2", "c3"].map((key) => (
							<div
								key={key}
								className="rounded-xl border border-border/60 bg-card/70 p-3"
							>
								<div className="flex items-start gap-3">
									<Skeleton className="h-16 w-12 rounded-md" />
									<div className="min-w-0 flex-1 space-y-2">
										<Skeleton className="h-4 w-3/4" />
										<Skeleton className="h-3 w-1/2" />
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

function DashboardAuthed() {
	const docs = useQuery(api.obras.list, {});
	const obras = (docs ?? []).map(obraFromDoc);
	const [view, setView] = useState<"list" | "grid">("list");
	const isGridView = view === "grid";

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
					<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
						<div className="inline-flex items-center overflow-hidden rounded-xl border border-border/60 bg-card/70 shadow-sm">
							<Button
								size="sm"
								variant="ghost"
								className={cn(
									"h-10 rounded-none border-r border-border/60 px-3 text-xs",
									view === "list"
										? "bg-foreground/10 text-foreground"
										: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
								)}
								onClick={() => setView("list")}
							>
								<List className="h-3.5 w-3.5" />
								Lista
							</Button>
							<Button
								size="sm"
								variant="ghost"
								className={cn(
									"h-10 rounded-none px-3 text-xs",
									view === "grid"
										? "bg-foreground/10 text-foreground"
										: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
								)}
								onClick={() => setView("grid")}
							>
								<LayoutGrid className="h-3.5 w-3.5" />
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
								className="rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm"
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
