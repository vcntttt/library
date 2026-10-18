import { ConvexAuthProvider } from "@convex-dev/auth/react";
import {
	createRootRoute,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "../components/Header";
import appCss from "../styles.css?url";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				name: "theme-color",
				content: "#F5F2EB",
			},
			{
				title: "Biblioteca",
			},
		],
		links: [
			{
				rel: "icon",
				type: "image/png",
				href: "/logo.png",
			},
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "manifest",
				href: "/manifest.json",
			},
		],
	}),

	shellComponent: RootDocument,
	notFoundComponent: NotFoundPage,
});

function NotFoundPage() {
	return (
		<main className="min-h-[calc(100vh-4rem)]">
			<div className="container mx-auto flex max-w-md flex-col items-center gap-4 p-4 py-16 text-center md:p-6">
				<h1 className="font-serif text-2xl font-semibold tracking-tight">
					Página no encontrada
				</h1>
				<p className="text-sm text-muted-foreground">
					La dirección no existe o fue movida.
				</p>
				<Button render={<Link to="/" />}>Volver al inicio</Button>
			</div>
		</main>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="es" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body suppressHydrationWarning>
				<ConvexAuthProvider client={convex}>
					<ThemeProvider>
						<TooltipProvider>
							<Header />
							{children}
						</TooltipProvider>
					</ThemeProvider>
				</ConvexAuthProvider>
				<Scripts />
			</body>
		</html>
	);
}
