import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { AddObraDialog } from "@/components/add-obra-dialog";
import { BibliotecaTable } from "@/components/biblioteca-table";
import { Skeleton } from "@/components/ui/skeleton";
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
		return <BibliotecaPageSkeleton />;
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

	return <BibliotecaAuthed />;
}

function BibliotecaPageSkeleton() {
	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="container mx-auto space-y-6 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<div className="space-y-3">
						<Skeleton className="h-3 w-28" />
						<Skeleton className="h-10 w-56 sm:w-72" />
						<Skeleton className="h-4 w-72 max-w-full" />
					</div>
					<Skeleton className="h-10 w-36 rounded-md" />
				</div>

				<BibliotecaTable obras={[]} isLoading />
			</div>
		</div>
	);
}

function BibliotecaAuthed() {
	const docs = useQuery(api.obras.list, {});
	const isLoading = docs === undefined;
	const obras = (docs ?? []).map(obraFromDoc);

	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="container mx-auto space-y-6 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<div className="space-y-3">
						<p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
							Colección
						</p>
						<h1 className="text-3xl font-semibold tracking-tight font-serif sm:text-4xl">
							Biblioteca
						</h1>
						<p className="text-sm text-muted-foreground">
							Busca, filtra y ordena todas tus obras.
						</p>
					</div>
					<AddObraDialog />
				</div>

				<BibliotecaTable obras={obras} isLoading={isLoading} />
			</div>
		</div>
	);
}
