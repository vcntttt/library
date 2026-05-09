import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutGrid, List } from "lucide-react";
import { useState } from "react";
import { AddObraDialog } from "@/components/add-obra-dialog";
import { DashboardSection } from "@/components/dashboard-section";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/lib/api/client";
import { api } from "@/lib/api/definitions";
import { authClient } from "@/lib/auth-client";
import { obraFromDoc } from "@/lib/obras";
import { cn } from "@/lib/utils";

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
			<div className="mx-auto max-w-6xl px-6 py-10">
				<div className="max-w-lg border border-border bg-card p-6 space-y-3">
					<h1 className="text-2xl font-semibold tracking-tight font-serif">
						Biblioteca
					</h1>
					<p className="text-sm text-muted-foreground">
						Inicia sesión para ver tu biblioteca.
					</p>
					<Link
						to="/login"
						className="text-sm underline underline-offset-4 text-[#B85C38]"
					>
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
			<div className="mx-auto max-w-6xl px-6 py-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between border-b border-border pb-4">
					<div className="space-y-3 max-w-2xl">
						<Skeleton className="h-3 w-32 rounded-none" />
						<Skeleton className="h-10 w-52 sm:w-64 rounded-none" />
						<Skeleton className="h-4 w-80 max-w-full rounded-none" />
					</div>
					<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
						<Skeleton className="h-8 w-28 rounded-none" />
						<Skeleton className="h-10 w-36 rounded-none" />
					</div>
				</div>

				<div className="grid grid-cols-3 gap-8">
					{["s1", "s2", "s3"].map((key) => (
						<div key={key} className="border-l border-border pl-6 space-y-1">
							<Skeleton className="h-3 w-24 rounded-none" />
							<Skeleton className="h-8 w-10 rounded-none" />
						</div>
					))}
				</div>

				<div className="space-y-4">
					<Skeleton className="h-5 w-24 rounded-none" />
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{["c1", "c2", "c3"].map((key) => (
							<div key={key} className="border border-border bg-card p-4">
								<div className="flex gap-4">
									<Skeleton className="h-24 w-16 rounded-none shrink-0" />
									<div className="min-w-0 flex-1 space-y-2">
										<Skeleton className="h-4 w-3/4 rounded-none" />
										<Skeleton className="h-3 w-1/2 rounded-none" />
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
	const backlog = obras
		.filter((w) => w.status === "backlog")
		.sort((a, b) => {
			return (
				Number(Boolean(b.recommendedBy)) - Number(Boolean(a.recommendedBy))
			);
		});
	const finished = obras.filter((w) => w.status === "finished");
	const recommended = obras.filter((w) => w.recommendedBy);

	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="mx-auto max-w-6xl px-6 py-10 space-y-14 animate-in fade-in slide-in-from-bottom-4 duration-700">
				{/* Hero stats */}
				<section className="space-y-6">
					<div className="flex items-end justify-between border-b border-border pb-4">
						<div className="space-y-2">
							<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
								Biblioteca privada
							</p>
							<h1 className="font-serif text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
								{inProgress.length} obras en progreso
							</h1>
						</div>
						<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
							<div className="inline-flex items-center overflow-hidden border border-border bg-card">
								<button
									type="button"
									className={cn(
										"inline-flex h-10 items-center gap-1.5 border-r border-border px-3 text-sm transition-colors",
										view === "list"
											? "bg-foreground text-background"
											: "text-muted-foreground hover:bg-muted hover:text-foreground",
									)}
									onClick={() => setView("list")}
								>
									<List className="size-3.5" />
									Lista
								</button>
								<button
									type="button"
									className={cn(
										"inline-flex h-10 items-center gap-1.5 px-3 text-sm transition-colors",
										view === "grid"
											? "bg-foreground text-background"
											: "text-muted-foreground hover:bg-muted hover:text-foreground",
									)}
									onClick={() => setView("grid")}
								>
									<LayoutGrid className="size-3.5" />
									Grid
								</button>
							</div>
							<AddObraDialog />
						</div>
					</div>

					<div
						className={cn(
							"grid gap-8",
							recommended.length > 0
								? "grid-cols-2 sm:grid-cols-4"
								: "grid-cols-3",
						)}
					>
						<div className="border-l border-border pl-6">
							<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
								Pendientes
							</p>
							<p className="font-serif text-3xl mt-1">{backlog.length}</p>
						</div>
						<div className="border-l border-border pl-6">
							<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
								Terminadas
							</p>
							<p className="font-serif text-3xl mt-1">{finished.length}</p>
						</div>
						<div className="border-l border-border pl-6">
							<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
								Total
							</p>
							<p className="font-serif text-3xl mt-1">{obras.length}</p>
						</div>
						{recommended.length > 0 && (
							<div className="border-l border-border pl-6">
								<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
									Recomendadas
								</p>
								<p className="font-serif text-3xl mt-1">{recommended.length}</p>
							</div>
						)}
					</div>
				</section>

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
