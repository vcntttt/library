import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { AddObraDialog } from "@/components/add-obra-dialog";
import { BibliotecaTable } from "@/components/biblioteca-table";
import { authClient } from "@/lib/auth-client";
import { obraFromDoc } from "@/lib/obras";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/biblioteca")({
	ssr: false,
	component: BibliotecaPage,
});

function BibliotecaPage() {
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
				<h1 className="text-2xl font-semibold tracking-tight">Biblioteca</h1>
				<p className="text-sm text-muted-foreground">
					Inicia sesion para ver tu biblioteca.
				</p>
				<Link to="/login" className="text-sm underline underline-offset-4">
					Ir a login
				</Link>
			</div>
		);
	}

	return <BibliotecaAuthed />;
}

function BibliotecaAuthed() {
	const docs = useQuery(api.obras.list, {});
	const obras = (docs ?? []).map(obraFromDoc);

	return (
		<div className="container mx-auto p-4 md:p-6 space-y-6">
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight">Biblioteca</h1>
					<p className="text-sm text-muted-foreground">
						Busca, filtra y ordena todas tus obras.
					</p>
				</div>
				<AddObraDialog />
			</div>

			<BibliotecaTable obras={obras} />
		</div>
	);
}
