import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "@/components/theme-provider";
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
				type: "image/svg+xml",
				href: "/library.svg",
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
});

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
