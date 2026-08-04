import { useConvexAuth } from "@convex-dev/auth/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ReadingAuthGate({ children }: { children: ReactNode }) {
	const { isAuthenticated, isLoading } = useConvexAuth();

	if (isLoading) {
		return (
			<div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
				<Skeleton className="h-10 w-48 rounded-none" />
				<Skeleton className="h-32 w-full rounded-none" />
			</div>
		);
	}

	if (!isAuthenticated) {
		return (
			<div className="mx-auto max-w-6xl px-6 py-10">
				<div className="max-w-lg space-y-3 border border-border bg-card p-6">
					<h1 className="font-serif text-2xl font-semibold">Lectura</h1>
					<p className="text-sm text-muted-foreground">
						Inicia sesión para sincronizar tus anotaciones.
					</p>
					<Link to="/login" className="text-sm underline underline-offset-4">
						Ir a login
					</Link>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}

export function ReadingBreadcrumb({ current }: { current?: string }) {
	return (
		<nav
			aria-label="Ruta de navegación"
			className="flex items-center gap-2 text-sm"
		>
			<Link
				to="/lectura"
				className="text-muted-foreground transition-colors hover:text-foreground"
			>
				Lectura
			</Link>
			{current && (
				<>
					<span className="text-muted-foreground/60">/</span>
					<span>{current}</span>
				</>
			)}
		</nav>
	);
}

export function ReadingSubrouteLayout({
	current,
	title,
	description,
	children,
}: {
	current: string;
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<div className="min-h-[calc(100vh-4rem)]">
			<div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
				<header className="space-y-4 border-b border-border pb-5">
					<ReadingBreadcrumb current={current} />
					<div className="space-y-2">
						<p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
							KOReader
						</p>
						<h1 className="font-serif text-4xl font-semibold">{title}</h1>
						<p className="max-w-2xl text-sm text-muted-foreground">
							{description}
						</p>
					</div>
				</header>
				{children}
			</div>
		</div>
	);
}
