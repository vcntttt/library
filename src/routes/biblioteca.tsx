import { createFileRoute, Link } from "@tanstack/react-router";
import { AddObraDialog } from "@/components/add-obra-dialog";
import { BibliotecaTable } from "@/components/biblioteca-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/lib/api/client";
import { api } from "@/lib/api/definitions";
import { authClient } from "@/lib/auth-client";
import { obraFromDoc } from "@/lib/obras";

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

	return <BibliotecaAuthed />;
}

function BibliotecaPageSkeleton() {
	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="mx-auto max-w-6xl px-6 py-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between border-b border-border pb-4">
					<div className="space-y-3">
						<Skeleton className="h-3 w-28 rounded-none" />
						<Skeleton className="h-10 w-56 sm:w-72 rounded-none" />
						<Skeleton className="h-4 w-72 max-w-full rounded-none" />
					</div>
					<Skeleton className="h-10 w-36 rounded-none" />
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
			<div className="mx-auto max-w-6xl px-6 py-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between border-b border-[#D6D0C7] pb-4">
					<div className="space-y-3">
						<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
							Colección completa
						</p>
						<h1 className="text-3xl font-semibold tracking-tight font-serif sm:text-4xl">
							Biblioteca
						</h1>
						<p className="text-base text-muted-foreground sm:text-sm">
							Busca, filtra y ordena todas tus obras.
						</p>
					</div>
					<div className="hidden sm:block">
						<AddObraDialog />
					</div>
				</div>

				<BibliotecaTable obras={obras} isLoading={isLoading} />

				<div className="fixed bottom-5 right-4 z-40 sm:hidden">
					<AddObraDialog triggerMode="fab" />
				</div>
			</div>
		</div>
	);
}
