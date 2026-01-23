import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { AddObraDialog } from "@/components/add-obra-dialog";
import { DashboardSection } from "@/components/dashboard-section";
import { authClient } from "@/lib/auth-client";
import { obraFromDoc } from "@/lib/obras";
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
			<div className="container mx-auto p-4 md:p-6 space-y-3">
				<h1 className="text-2xl font-semibold tracking-tight">Library</h1>
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

	return (
		<div className="container mx-auto p-4 md:p-6 space-y-8">
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight">Panel</h1>
					<p className="text-sm text-muted-foreground">
						Tu actividad reciente, lo que esta en progreso y lo que ya
						terminaste.
					</p>
				</div>
				<AddObraDialog />
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
	);
}
